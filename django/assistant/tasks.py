from dataclasses import dataclass
from django.utils import timezone
from celery import shared_task
from assistant.generation_backends import backends, ChatCompletionJob
from assistant.models import Chat, MultimediaMessage, Modality, Revision, Generation
from assistant.utils import process_raw_message, MessageSegment


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


def convert_modality(message, modality):
    if modality.modality_type == "text":
        content = [{ "type": "text", "text": modality.text}]
    elif modality.modality_type == "image":
        # todo: image to data uri
        data_uri = modality.image.url
        content = [{ "type": "image_url", "image_url": data_uri }]
    elif modality.modality_type == "code":
        path = modality.file_path
        assert message.active_revision is not None and message.active_revision.src_tree

        entries = [entry for entry in message.active_revision.src_tree
                   if entry["file_path"] == path]
        code = entries[0]["content"]

        content = [{ "type": "text", "text": f"```\n{code}\n```" }]
    elif modality.modality_type == "mixture":
        content = []
        for child in modality.mixture.all():
            content.extend(convert_modality(message, child))
    else:
        content = []

    return content


def convert(message):
    root_modality = message.content
    content = convert_modality(message, root_modality)
    return dict(role=message.role, content=content)


@shared_task
def generate_completion(completion_config: dict):
    config = CompletionConfig.from_dict(completion_config)
    message = config.get_message()
    chat = config.get_chat()

    history = message.get_history() if message is not None else []

    backend_class = backends[config.backend_name]
    generator = backend_class()

    system_msg = chat.configuration.system_message
    messages = [convert(msg_obj) for msg_obj in history]
    if system_msg:
        messages = [{ "role": "system", "content": system_msg }] + messages

    job = ChatCompletionJob(model=config.model_name, base_url=config.server_url,
                            messages=messages, params=config.params)
    for token in generator.generate(job):
        token
        # todo: process token

    segments, sources = process_raw_message(generator.response)
    
    mixture = Modality.objects.create(modality_type="mixture")
    # todo: extract image modalities
    modalities = [seg.create_modality(mixture) for seg in segments]

    role = "user" if len(history) % 2 == 0 else "assistant"

    new_message = MultimediaMessage(role=role, content=mixture)
    if message is not None:
        new_message.parent = message
    else:
        new_message.chat = chat
    new_message.save()

    if sources:
        revision = Revision.objects.create(src_tree=sources, message=new_message)
        new_message.active_revision = revision
        new_message.save()

    generation = Generation.objects.get(pk=config.task_id)
    generation.finished = True
    generation.stop_time = timezone.now()
    # todo: set response_metadata field of generation_metadata field
    generation.save()
