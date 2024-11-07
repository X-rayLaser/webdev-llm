from dataclasses import dataclass
import json
from django.utils import timezone
from celery import shared_task
import redis
from django.conf import settings
from assistant.generation_backends import backends, ChatCompletionJob
from assistant.models import Chat, MultimediaMessage, Modality, Revision, Generation
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

    emitter(event_type="generation_started")

    for token in generator.generate(job):
        emitter(event_type="token_arrived", data=token)

    role = "user" if len(history) % 2 == 0 else "assistant"
    new_message = create_response_message(generator.response, role, parent=message, chat=chat)

    generation = Generation.objects.get(pk=config.task_id)
    generation.finished = True
    generation.stop_time = timezone.now()
    # todo: set response_metadata field of generation_metadata field
    generation.save()

    event_data = {
        "message": serializers.MultimediaMessageSerializer(new_message).data,
        "generation": serializers.GenerationSerializer(generation).data
    }
    emitter(event_type="generation_ended", data=event_data)
