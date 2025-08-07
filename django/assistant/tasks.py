from dataclasses import dataclass
import json
import uuid
import time
import os
import io
import re
import tarfile
import zipfile
import shutil
from typing import Dict
import traceback
import requests
from django.utils import timezone
from celery import shared_task
import redis
from django.conf import settings
from django.core.files.base import ContentFile
from assistant.generation_backends import backends, ChatCompletionJob
from assistant import summary_backends
from assistant import text2image_backends
from assistant import tts_backends
from assistant import rag_backends
from assistant.models import (
    Chat, MultimediaMessage, Modality, Revision, Generation,
    OperationSuite, Build, Server, SpeechSample, Resource, reduce_source_tree
)
from assistant.utils import (
    process_raw_message, extract_modalities, prepare_messages, prepare_build_files,
    MessageSegment, get_named_code_segments, NamedCodeSegment, get_multimedia_message_text,
    get_wave_duration, join_wavs, ThinkingDetector
)
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
    system_message: str = None

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


def generate_file_names(raw_response, config):
    backend_class = backends[config.backend_name]
    generator = backend_class()

    prompt = """
Process the following document, find all the source files in it and extract their names.
Output format should be a dictionary mapping first (non-blank) line of each file to it's name.
For example, {{"var x = 0": "some_js_file.js", "a = [1,2,3]": "some_python_file.py"}}
Please, output only the resulting JSON and nothing else.

START OF DOCUMENT
{}
END OF DOCUMENT
""".format(raw_response)
    messages = [dict(role="user", content=prompt)]
    params = dict(temperature=0.1, top_p=1)

    job = ChatCompletionJob(model=config.model_name, base_url=config.server_url,
                            messages=messages, params=params)

    tokens = list(generator.generate(job))

    try:
        entries = json.loads(generator.response)
        return {str(k).strip():str(v).strip() for k, v in entries.items() if k and v}
    except ValueError:
        print(traceback.format_exc())
        return {}


def extract_first_non_empty_line(named_segment):
    lines = named_segment.segment.content.split('\n') or []
    lines = [line for line in lines if line.strip()]
    return (lines and lines[0].strip()) or ""


def _extract_names_with_llm_fallback(raw_response, config):

    def extract_names(segments):
        decorated_segments = get_named_code_segments(segments, extra_guess=False)
        generated_names = generate_file_names(raw_response, config)
        print('generated_names', generated_names)
        res = []

        for seg in decorated_segments:
            first_line = extract_first_non_empty_line(seg)

            if seg.candidate_name:
                res.append(seg)
            else:
                candidate_name = generated_names.get(first_line)
                res.append(NamedCodeSegment(seg.index, seg.segment, candidate_name))

        return res

    return extract_names


def create_response_message(raw_response, config, role, parent=None, chat=None):
    thinking_part, spoken_part = ThinkingDetector.split_thinking(raw_response)

    mixture = Modality.objects.create(modality_type="mixture")
    # todo: extract image modalities

    if settings.LLM_BASED_NAME_EXTRACTION:
        extract_fn = _extract_names_with_llm_fallback(spoken_part, config)
    else:
        extract_fn = get_named_code_segments

    modalities, sources = extract_modalities(spoken_part, parent=mixture, extract_names=extract_fn)

    new_message = MultimediaMessage(role=role, content=mixture)

    if thinking_part:
        new_message.thoughts = thinking_part

    if parent is not None:
        parent.child_index = parent.replies.count()
        parent.save()
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


def include_zip_resources(chat):
    allowed_extensions = ['.jpg', '.jpeg', '.png', '.gif']

    with zipfile.ZipFile(chat.zipfile.path, 'r') as myzip:
        for fileinfo in myzip.infolist():
            path = fileinfo.filename
            _, ext = os.path.splitext(path)

            if fileinfo.is_dir() or ext.lower() not in allowed_extensions:
                continue

            content = myzip.read(path)
            file = ContentFile(content, name=path)

            # todo: extract extra info from images, resolution, caption, etc.
            Resource.objects.create(chat=chat, dest_path=path, file=file)
    chat.zipfile = None  # prevents repeated extraction
    chat.save()


def patch_messages(messages):
    rag_backend_cls = rag_backends.backends[settings.RAG_BACKEND['name']]
    rag_kwargs = settings.RAG_BACKEND.get('kwargs', {})
    rag_backend = rag_backend_cls(**rag_kwargs)

    *prefix, last_msg = messages
    text_prompt = '\n'.join([d['text'] for d in last_msg['content'] if d['type'] == 'text'])

    docs_text = rag_backend.retrieve_for(text_prompt)

    if docs_text:
        last_msg['content'] = [{'type': 'text', 'text': docs_text}] + last_msg['content']
    return prefix + [last_msg]


def _generate(config, emitter):
    message = config.get_message()
    chat = config.get_chat()

    backend_class = backends[config.backend_name]
    generator = backend_class()

    # use system message override regardless of coding_mode value if it's set
    # otherwise use system message for conversation mode and coder system message for coding mode
    if config.system_message is None:
        system_msg = chat.get_system_message()
    else:
        system_msg = config.system_message

    print("using system message")
    print(system_msg)
    
    history = message.get_history() if message is not None else []
    messages = prepare_messages(history, system_msg)
    messages = patch_messages(messages)

    job = ChatCompletionJob(model=config.model_name, base_url=config.server_url,
                            messages=messages, params=config.params)

    buffer = ""
    for token in generator.generate(job):
        buffer += token
        if ThinkingDetector.detect_thinking_start(buffer):
            emitter(event_type="thinking_started", data=dict(task_id=config.task_id))
            buffer = ""
        elif ThinkingDetector.detect_thinking_ended(buffer):
            emitter(event_type="thinking_ended", data=dict(task_id=config.task_id))
            buffer = ""

        emitter(event_type="token_arrived", data=dict(token=token, task_id=config.task_id))

    role = "user" if len(history) % 2 == 0 else "assistant"
    return create_response_message(generator.response, config, role, parent=message, chat=chat)


def split_into_sentences(text):
    def split_by(line, values):
        res = []

        if not values:
            return [line]

        for ln in line.split(values[0]):
            res.extend(split_by(ln, values[1:]))

        return [s.strip() for s in res if s.strip()]

    return split_by(text, "\n.?!")


def synthesize_speech(synthesizer, text, voice_id=None):
    speech_data = synthesizer.synthesize(text, voice_id)
    if not speech_data:
        raise NoSpeechSampleError()
    
    sample = SpeechSample()

    name = f'tts_{uuid.uuid4().hex}.wav'
    audio_file = ContentFile(speech_data, name=name)
    sample.audio = audio_file
    sample.text = text
    sample.save()
    return sample


class NoSpeechSampleError(Exception):
    pass


def generate_speech(response_message, synthesizer, emitter):
    text = get_multimedia_message_text(response_message)

    # todo: more robust text cleaning
    cleaned_text = re.sub("[^a-zA-Z\s!\?\.']", '', text).strip()
    sentences = split_into_sentences(cleaned_text)

    if not sentences:
        return

    event_data = { "message_id": response_message.id }
    emitter(event_type="tts_started", data=event_data)

    audio_samples = []

    for sentence in sentences:
        t0 = time.time()
        try:
            sample = synthesize_speech(synthesizer, sentence)
            audio_samples.append(sample)
        except Exception as e:
            traceback.print_exc()
        else:
            url = sample.get_absolute_url()
            sample_id = sample.pk
            duration = get_wave_duration(sample.audio.path)
            elapsed = time.time() - t0
            event_data = dict(
                text=sentence, url=url, gen_time_seconds=elapsed,
                message_id=response_message.id, id=sample_id, duration=duration
            )
            emitter(event_type="speech_sample_arrived", data=event_data)

    if audio_samples:
        output_name = f'{uuid.uuid4().hex}.wav'
        output_path = os.path.join(settings.MEDIA_ROOT, output_name)
        audio_data = join_wavs(audio_samples, output_path)
        response_message.audio = ContentFile(audio_data, name="tts-audio-file.wav")
        response_message.save()

    event_data = { "message_id": response_message.id }
    emitter(event_type="end_of_speech", data=event_data)


@shared_task
def generate_completion(completion_config: dict, socket_session_id: int):

    config = CompletionConfig.from_dict(completion_config)

    print("full system msg", config.system_message)
    emitter = RedisEventEmitter(socket_session_id)

    errors = None
    response_message = None

    try:
        emitter(event_type="generation_started", data=dict(task_id=config.task_id))
        response_message = _generate(config, emitter)
    except Exception as e:
        print(traceback.format_exc())
        errors = ["Unxpected error during message generation"]
    finally:
        generation = Generation.objects.get(task_id=config.task_id)
        generation.finished = True
        generation.stop_time = timezone.now()
        generation.errors = errors
        # todo: set response_metadata field of generation_metadata field
        generation.save()

        event_data = {
            "generation": serializers.GenerationSerializer(generation).data,
            "task_id": config.task_id
        }
        emitter(event_type="generation_ended", data=event_data)

    try:
        backend_name = settings.TTS_BACKEND["name"]
        backend_conf = settings.TTS_BACKEND.get("kwargs", {})
        backend_class = tts_backends.backends[backend_name]
        synthesizer = backend_class(**backend_conf)
    except KeyError:
        return

    if response_message:
        generate_speech(response_message, synthesizer, emitter)


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
def launch_operation_suite(revision_id, socket_session_id, builder_id=None, **build_params):
    revision = Revision.objects.get(pk=revision_id)
    message = revision.message
    suite = OperationSuite.objects.create(revision=revision)

    final_src_tree = prepare_build_files(reduce_source_tree(revision))

    #data = {
    #    "source_tree": final_src_tree
    #}
    #data.update(build_params)

    chat = message.get_root().chat
    resources = chat.resources.all()
    build_servers = chat.configuration.build_servers.all()
    
    class BuiltInServer:
        url = "http://builder:8888"

    server = Server.objects.filter(pk=builder_id).first()
    if server is not None:
        build_servers = [server]
    else:
        build_servers = [BuiltInServer]

    emitter = RedisEventEmitter(socket_session_id)
    artifacts_root = settings.ARTIFACTS_ROOT

    for server in build_servers:
        build = Build.objects.create(operation_suite=suite)
        event_data = dict(build=serializers.BuildSerializer(build).data, revision_id=revision_id)
        emitter(event_type="build_started", data=event_data)

        url = f'{server.url}/build-spa/'

        try:
            response_json = post_tar(url, final_src_tree, resources)
            build.success = response_json["success"]
            logs = {}
            logs["stdout"] = response_json["stdout"]
            logs["stderr"] = response_json["stderr"]
            build.logs = logs


            build_id = response_json["build_id"]
            tar_url = f'{server.url}/app_files/{build_id}/'

            artifacts_location = download_artifacts(tar_url, artifacts_root)
            build.url = f'{settings.ARTIFACTS_URL}/{artifacts_location}/index.html'
            break
        except Exception as e:
            print(traceback.format_exc())
            build.success = False
            build.errors = ["Operation was not completed correctly"]
        finally:
            build.finished = True
            build.end_time = timezone.now()
            build.save()
            event_data = dict(build=serializers.BuildSerializer(build).data, revision_id=revision_id)
            emitter(event_type="build_finished", data=event_data)


def post_tar(url, source_tree, resources):
    f = io.BytesIO()

    text_files = []
    for entry in source_tree:
        path = entry["file_path"]
        content = entry["content"].encode("utf-8")
        text_files.append((path, content))

    res_files = []
    for res in resources:
        with open(res.file.path, "rb") as rf:
            content = rf.read()
        res_files.append((res.dest_path, content))

    all_files = text_files + res_files

    with tarfile.open(fileobj=f, mode='w') as tar:
        for path, content in all_files:
            tarinfo = tarfile.TarInfo(name=path)
            temp_file = io.BytesIO(content)
            tarinfo.size = temp_file.getbuffer().nbytes
            tar.addfile(tarinfo, temp_file)

    f.seek(0)
    files = {'src': f}
    response = requests.post(url, files=files)

    if response:
        return response.json()
    raise Exception(f'Bad status code: {response.status_code}. Response: {response.json()}')


def download_artifacts(url, save_root_dir):
    # todo: get rid of hardcoded subfolder names
    artifacts_folder = "artifacts"
    subfolder_name, subfolder_path = create_unique_subfolder(save_root_dir)
    full_save_path = os.path.join(subfolder_path, artifacts_folder)

    response = requests.get(url)
    if response:
        fileobj = io.BytesIO(response.content)
        with tarfile.open(fileobj=fileobj, mode="r") as tar:
            # expects tar to contain "artifacts" folder
            tar.extractall(path=subfolder_path)
            return os.path.join(subfolder_name, artifacts_folder)
    raise Exception(f'Bad status code: {response.status_code}. Response: {response.json()}')


def save_artifacts_with_resources(root_folder: str, artifacts: Dict[str, str], resources) -> str:
    """
    Saves each artifact as a file in a subfolder with a random UUID4 name. Save resouces as well

    Args:
        root_folder (str): The root folder where the subfolder will be created.
        artifacts (Dict[str, str]): A mapping of file names to file content.
        resources: Queryset of Resource objects
    Returns:
        str: The name of the created subfolder.
    """

    subfolder_name, subfolder_path = create_unique_subfolder(root_folder)

    for file_name, file_content in artifacts.items():
        file_path = os.path.join(subfolder_path, file_name)
        with open(file_path, "w", encoding="utf-8") as file:
            file.write(file_content)

    for res in resources:
        try:
            save_resource(subfolder_path, res)
        except Exception:
            traceback.print_exc()

    return subfolder_name


def create_unique_subfolder(root_folder):
    while True:
        subfolder_name = str(uuid.uuid4())
        subfolder_path = os.path.join(root_folder, subfolder_name)
        if not os.path.exists(subfolder_path):
            os.makedirs(subfolder_path, exist_ok=True)
            return subfolder_name, subfolder_path


def save_resource(root, resource):
    # todo: validate path
    dest_path = os.path.normpath(resource.dest_path)

    if not dest_path:
        print("Ignoring resource: empty path")
        return

    dir_path = os.path.dirname(dest_path)
    full_dir_path = os.path.join(root, dir_path)

    if full_dir_path:
        os.makedirs(full_dir_path, exist_ok=True)

    dest_name = os.path.basename(resource.dest_path)
    full_dest_path = os.path.join(full_dir_path, dest_name)
    shutil.copyfile(resource.file.path, full_dest_path)


def post_json(url, data):
    headers = {
        'Content-type': 'application/json'
    }
    response = requests.post(url, data=json.dumps(data), headers=headers)
    if response:
        return response.json()
    raise Exception(f'Bad status code: {response.status_code}. Response: {response.json()}')



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
