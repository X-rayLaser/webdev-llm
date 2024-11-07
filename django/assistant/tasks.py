from dataclasses import dataclass
from django.utils import timezone
from celery import shared_task
from assistant.generation_backends import backends, ChatCompletionJob
from assistant.models import Chat, MultimediaMessage, Modality, Revision, Generation
from assistant.utils import process_raw_message, prepare_messages, MessageSegment


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


@shared_task
def generate_completion(completion_config: dict):
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
