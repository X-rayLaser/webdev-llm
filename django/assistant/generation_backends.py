from typing import List, Dict, Any
import time
import os
from dataclasses import dataclass
from abc import ABC, abstractmethod
import httpx
import openai
from openai import DefaultHttpxClient



@dataclass
class ChatCompletionJob:
    model: str
    base_url: str
    messages: List[Dict[str, Any]]
    params: Dict[str, Any] = None


class CompletionBackend(ABC):
    def __init__(self):
        self.response = ""

    @abstractmethod
    def generate(self, job: ChatCompletionJob):
        pass


class ResponsesBackend(ABC):
    @abstractmethod
    def generate(self, job: ChatCompletionJob):
        pass


class CompletionBackendAdapter(ResponsesBackend):
    def __init__(self, backend: CompletionBackend) -> None:
        super().__init__()

        self.event_factory = None
        self.backend = backend
        self.response = []

    def generate(self, job: ChatCompletionJob):
        from assistant.utils import ThinkingDetector

        self.event_factory = EventFactory()
        generator = self.backend.generate(job)

        buffer = next(
            yield_bufferred(generator, ThinkingDetector.max_open_tag_len())
        )

        leftover = buffer

        if ThinkingDetector.detect_thinking_start(buffer):
            leftover = yield from self.get_reasoning_events(generator, buffer)
        
        yield from self.get_text_output_events(generator, leftover)

    def get_reasoning_events(self, generator, buffer):
        from assistant.utils import ThinkingDetector

        initial_thoughts = ThinkingDetector.strip_tags(buffer)
        item_factory = ResponseItemFactory(item_type="reasoning")
        thoughts = initial_thoughts

        yield self.event_factory.output_item_added(item_factory)
        yield self.event_factory.content_part_added(item_factory.item_id, 0, part_type="reasoning_text")
        yield self.event_factory.reasoning_text_delta(item_factory.item_id, initial_thoughts)

        leftover = ""
        for buffer in yield_bufferred(generator, ThinkingDetector.max_open_tag_len() + 1):
            if not ThinkingDetector.detect_thinking_end(buffer):
                yield self.event_factory.reasoning_text_delta(item_factory.item_id, buffer)
                continue

            leftover = ThinkingDetector.get_text_after_tag(buffer)
            final_thoughts = ThinkingDetector.strip_tags(buffer)
            thoughts += final_thoughts

            if final_thoughts:
                yield self.event_factory.reasoning_text_delta(item_factory.item_id, final_thoughts)

            yield self.event_factory.reasoning_text_done(item_factory.item_id, thoughts)
            yield self.event_factory.content_part_done(
                item_factory.item_id, 0, part_type="reasoning_text", text=thoughts
            )

            complete_item = item_factory.make_complete_item("reasoning", thoughts)
            yield self.event_factory.output_item_done(complete_item)
            self.response.append(complete_item)
            break

        return leftover

    def get_text_output_events(self, generator, leftover):
        item_factory = None
        text = leftover

        for token in generator:
            if not item_factory:
                item_factory = ResponseItemFactory(item_type="message")
                yield self.event_factory.output_item_added(item_factory)
                yield self.event_factory.content_part_added(item_factory.item_id, 0, part_type="output_text")

                if leftover:
                    yield self.event_factory.output_text_delta(item_factory.item_id, 0, leftover)

            text += token
            yield self.event_factory.output_text_delta(item_factory.item_id, 0, token)
        
        yield self.event_factory.output_text_done(item_factory.item_id, text)

        yield self.event_factory.content_part_done(
            item_factory.item_id, 0, part_type="output_text", text=text
        )

        complete_item = item_factory.make_complete_item("output_text", text)
        yield self.event_factory.output_item_done(complete_item)

        self.response.append(complete_item)


class EventFactory:
    def __init__(self):
        self.seq_num = 0
        self.output_index = 0

    def output_item_added(self, item_factory):
        event = self.make_event(
            "response.output_item.added",
            item=item_factory.make_initial_item()
        )

        self.output_index += 1
        return event

    def content_part_added(self, item_id, content_index, part_type):
        return self.make_event(
            "response.content_part.added",
            item_id=item_id,
            content_index=content_index,
            part={
                "type": part_type,
                "text": "",
                "annotations": []
            }
        )

    def content_part_done(self, item_id, content_index, part_type, text):
        return self.make_event(
            "response.content_part.done",
            item_id=item_id,
            content_index=content_index,
            part={
                "type": part_type,
                "text": text,
                "annotations": []
            }
        )

    def reasoning_text_delta(self, item_id, delta):
        return self.make_event(
            "response.reasoning_text.delta",
            item_id=item_id,
            content_index=0,
            delta=delta
        )

    def reasoning_text_done(self, item_id, text):
        return self.make_event(
            "response.reasoning_text.done",
            item_id=item_id,
            content_index=0,
            text=text
        )

    def output_text_delta(self, item_id, content_index, delta):
        return self.make_event(
            "response.output_text.delta",
            item_id=item_id,
            content_index=content_index,
            delta=delta,
        )

    def output_text_done(self, item_id, text):
        return self.make_event(
            "response.output_text.done",
            item_id=item_id,
            content_index=0,
            text=text
        )

    def output_item_done(self, complete_item):
        return self.make_event(
            "response.output_item.done",
            item=complete_item
        )

    def make_event(self, event_type, **kwargs):
        self.seq_num += 1

        return {
            "type": event_type,
            "output_index": self.output_index,
            "sequence_number": self.seq_num,
            **kwargs
        }


class ResponseItemFactory:
    def __init__(self, item_type="message"):
        self.item_id = 323
        self.item_type = item_type

    def make_item(self, status, content):
        return {
            "id": self.item_id,
            "status": status,
            "type": self.item_type,
            "role": "assistant",
            "content": content
        }

    def make_initial_item(self):
        return self.make_item("in_progress", [])

    def make_complete_item(self, content_type, text):
        content = [{
            "type": content_type,
            "text": text,
            "annotations": []
        }]
        return self.make_item("complete", content)


def yield_bufferred(gen, bufsize):
    buffer = ""
    for s in gen:
        buffer += s
        if len(buffer) >= bufsize:
            ret = buffer
            buffer = ""
            yield ret

    if buffer:
        yield buffer


class DummyBackend(CompletionBackend):
    tokens = ["The", "quick", "brown", "fox", "jumps", "over", "the", "lazy", "dog", "."]
    separator = " "
    def generate(self, job: ChatCompletionJob):
        for token in self.tokens:
            sleep_secs = 0.5
            time.sleep(sleep_secs)
            chunk = token + self.separator
            self.response += chunk
            yield chunk


class DummyCoderBackend(DummyBackend):
    tokens = ["```", "javascript", "\n",
              "console", ".", "log", "(", "'", "hello, ", "world", "'", ")",
              "```"]
    separator = ""


class OpenAICompatibleBackend(CompletionBackend):

    def generate(self, job: ChatCompletionJob):
        http_client = self.get_http_client()

        timeout = 30 * 60 # 30 minutes

        params = self.prepare_params(job)

        client = openai.OpenAI(
            base_url=f"{job.base_url}/v1",
            api_key="sk-no-key-required",
            timeout=timeout,
            http_client=http_client
        )

        stream = client.chat.completions.create(
            model=job.model,
            messages=job.messages,
            stream=True,
            extra_body={"cache_prompt": True},
            **params
        )

        for chunk in stream:
            chunk_text = chunk.choices[0].delta.content or ""
            self.response += chunk_text
            yield chunk_text

    def get_http_client(self):
        http_proxy = os.environ.get("http_proxy_url")
        https_proxy = os.environ.get("https_proxy_url", http_proxy)

        if http_proxy or https_proxy:
            proxies = {
                "http://": httpx.HTTPTransport(proxy=http_proxy),
                "https://": httpx.HTTPTransport(proxy=https_proxy),
            }
        else:
            proxies = None

        http_client = DefaultHttpxClient(mounts=proxies)
        
        return http_client

    def prepare_params(self, job: ChatCompletionJob):
        mapping = {
            "temperature": "temperature",
            "top_p": "top_p",
            "repeat_penalty": "frequency_penalty",
            "n_predict": "max_tokens"
        }
        return {mapping[name]:value for name, value in job.params.items() if name in mapping}


backends = {
    "dummy": DummyBackend,
    "dummy_coder": DummyCoderBackend,
    "openai_compatible": OpenAICompatibleBackend
}
