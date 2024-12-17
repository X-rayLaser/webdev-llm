from dataclasses import dataclass
import json
import uuid
import os
from typing import Dict
import requests
from django.utils import timezone
from celery import shared_task
import redis
from django.conf import settings
from django.core.files.base import ContentFile
from assistant.generation_backends import backends, ChatCompletionJob
from assistant import summary_backends
from assistant import text2image_backends
from assistant.models import (
    Chat, MultimediaMessage, Modality, Revision, Generation,
    OperationSuite, Build
)
from assistant.utils import process_raw_message, prepare_messages, MessageSegment
from assistant import serializers


@dataclass
class CompletionConfig:
    backend_name: str
    task_id: str
    server_url: str
    model_name: str = None
    params: dict = None
    chat_id: int = None
    message_id: int = None

    def to_dict(self):
        return dict(self.__dict__)

    def get_message(self):
        if self.message_id is None:
            return None
        return MultimediaMessage.objects.get(pk=self.message_id)

    def get_chat(self):
        if self.chat_id is None:
            return self.get_message().get_root()
        return Chat.objects.get(pk=self.chat_id)

    @classmethod
    def from_dict(cls, data: dict):
        return cls(**data)


def create_response_message(raw_response, role, parent=None, chat=None):
    segments, sources = process_raw_message(raw_response)
    
    mixture = Modality.objects.create(modality_type="mixture")
    # todo: extract image modalities
    modalities = [seg.create_modality(mixture) for seg in segments]

    new_message = MultimediaMessage(role=role, content=mixture)
    if parent is not None:
        new_message.parent = parent
    else:
        new_message.chat = chat
    new_message.save()

    if sources:
        revision = Revision.objects.create(src_tree=sources, message=new_message)
        new_message.active_revision = revision
        new_message.save()

    return new_message


class RedisEventEmitter:
    main_events_stream = "main_events_stream"

    def __init__(self, socket_session_id):
        self.redis_object = redis.Redis(settings.REDIS_HOST)
        self.channel = f'{self.main_events_stream}:{socket_session_id}'

    def __call__(self, event_type, data=None):
        event = dict(event_type=event_type, data=data)
        self.redis_object.publish(self.channel, json.dumps(event))


@shared_task
def generate_completion(completion_config: dict, socket_session_id: int):
    config = CompletionConfig.from_dict(completion_config)
    message = config.get_message()
    chat = config.get_chat()

    backend_class = backends[config.backend_name]
    generator = backend_class()

    system_msg = chat.configuration.system_message
    history = message.get_history() if message is not None else []
    messages = prepare_messages(history, system_msg)

    job = ChatCompletionJob(model=config.model_name, base_url=config.server_url,
                            messages=messages, params=config.params)

    emitter = RedisEventEmitter(socket_session_id)

    emitter(event_type="generation_started", data=dict(task_id=config.task_id))

    for token in generator.generate(job):
        emitter(event_type="token_arrived", data=dict(token=token, task_id=config.task_id))

    role = "user" if len(history) % 2 == 0 else "assistant"
    new_message = create_response_message(generator.response, role, parent=message, chat=chat)

    generation = Generation.objects.get(task_id=config.task_id)
    generation.finished = True
    generation.stop_time = timezone.now()
    # todo: set response_metadata field of generation_metadata field
    generation.save()

    event_data = {
        "message": serializers.MultimediaMessageSerializer(new_message).data,
        "generation": serializers.GenerationSerializer(generation).data,
        "task_id": config.task_id
    }
    emitter(event_type="generation_ended", data=event_data)


@shared_task
def summarize_text(text, chat_id, backend_name, socket_session_id):
    chat = get_chat(chat_id)
    if chat is None:
        print("Chat not found:", chat_id)
        return

    gen_obj = create_generation(chat, "chat_title")
    emitter = RedisEventEmitter(socket_session_id)
    emitter(event_type="chat_title_generation_started", data=dict(task_id=gen_obj.task_id))

    backend_class = summary_backends.backends[backend_name]
    summarizer = backend_class()
    summary = summarizer.summarize(text)

    chat.refresh_from_db()
    chat.name = summary
    chat.save() # todo: catch unique constraint violation and retry (or add uuid)
    finish_generation(gen_obj)
    emitter(event_type="chat_title_generation_ended", data=dict(task_id=gen_obj.task_id))


@shared_task
def generate_chat_picture(text, chat_id, backend_name, socket_session_id):
    chat = get_chat(chat_id)
    if chat is None:
        print("Chat not found:", chat_id)
        return

    gen_obj = create_generation(chat, "chat_picture")
    emitter = RedisEventEmitter(socket_session_id)
    emitter(event_type="chat_image_generation_started", data=dict(task_id=gen_obj.task_id))

    backend_class = text2image_backends.backends[backend_name]
    backend = backend_class()
    image_data = backend.generate_image(text)

    file_name = f'{uuid.uuid4().hex}.png'
    content_file = ContentFile(image_data, name=file_name)

    chat.refresh_from_db()
    chat.image = content_file
    chat.save()
    finish_generation(gen_obj)
    emitter(event_type="chat_image_generation_ended", data=dict(task_id=gen_obj.task_id))


@shared_task
def launch_operation_suite(revision_id, socket_session_id):
    revision = Revision.objects.get(pk=revision_id)
    message = revision.message
    suite = OperationSuite.objects.create(revision=revision)

    data = {
        "source_tree": revision.src_tree
    }
    build_servers = message.get_root().chat.configuration.build_servers.all()
    
    class BuiltInServer:
        url = "http://builder:8888"

    if not build_servers.exists():
        build_servers = [BuiltInServer]

    emitter = RedisEventEmitter(socket_session_id)
    artifacts_root = settings.ARTIFACTS_ROOT

    for server in build_servers:
        build = Build.objects.create(operation_suite=suite)
        event_data = dict(build=serializers.BuildSerializer(build).data, revision_id=revision_id)
        emitter(event_type="build_started", data=event_data)

        url = f'{server.url}/build-component/'

        try:
            response_json = post_json(url, data)
            build.success = response_json["success"]
            logs = {}
            logs["stdout"] = response_json["stdout"]
            logs["stderr"] = response_json["stderr"]
            build.logs = logs

            folder_name = save_artifacts(artifacts_root, response_json["artifacts"])
            build.url = f'{settings.ARTIFACTS_URL}/{folder_name}/index.html'
            break
        except Exception as e:
            build.success = False
            build.errors = ["Operation was not completed correctly"]
        finally:
            build.finished = True
            build.end_time = timezone.now()
            build.save()
            event_data = dict(build=serializers.BuildSerializer(build).data, revision_id=revision_id)
            emitter(event_type="build_finished", data=event_data)


def save_artifacts(root_folder: str, artifacts: Dict[str, str]) -> str:
    """
    Saves each artifact as a file in a subfolder with a random UUID4 name.

    Args:
        root_folder (str): The root folder where the subfolder will be created.
        artifacts (Dict[str, str]): A mapping of file names to file content.

    Returns:
        str: The name of the created subfolder.
    """

    while True:
        subfolder_name = str(uuid.uuid4())
        subfolder_path = os.path.join(root_folder, subfolder_name)
        if not os.path.exists(subfolder_path):
            break

    os.makedirs(subfolder_path, exist_ok=True)

    for file_name, file_content in artifacts.items():
        file_path = os.path.join(subfolder_path, file_name)
        with open(file_path, "w", encoding="utf-8") as file:
            file.write(file_content)

    return subfolder_name


def post_json(url, data):
    headers = {
        'Content-type': 'application/json'
    }
    response = requests.post(url, data=json.dumps(data), headers=headers)
    if response:
        return response.json()
    raise Exception(f'Bad status code: {response.status_code}')



def get_chat(id):
    chats = Chat.objects.filter(pk=id)
    return chats.first() if chats.exists() else None

def create_generation(chat, generation_type):
    task_id = uuid.uuid4().hex
    return Generation.objects.create(
        task_id=task_id, chat=chat, generation_type=generation_type
    )


def finish_generation(generation):
    generation.finished = True
    generation.stop_time = timezone.now()
    generation.save()