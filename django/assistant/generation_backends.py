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

        self.seq_num = 0
        self.backend = backend
        self.response = []

    def generate(self, job: ChatCompletionJob):
        from assistant.utils import ThinkingDetector

        self.seq_num = 0

        generator = self.backend.generate(job)

        buffer = next(
            yield_bufferred(generator, ThinkingDetector.max_open_tag_len())
        )

        text = ""
        thoughts = ""
        leftover = ""

        if ThinkingDetector.detect_thinking_start(buffer):
            initial_thoughts = ThinkingDetector.strip_tags(buffer)

            item_factory = ResponseItemFactory(item_type="reasoning")

            thoughts += initial_thoughts

            yield from self.notify_reasoning_started(item_factory, initial_thoughts)

            for buffer in yield_bufferred(generator, ThinkingDetector.max_open_tag_len() + 1):
                if ThinkingDetector.detect_thinking_end(buffer):

                    leftover = ThinkingDetector.get_text_after_tag(buffer)
                    yield from self.notify_reasoning_ended(item_factory, thoughts, buffer)

                    text += leftover
                    break

                yield self.make_event(
                    "response.reasoning_text.delta",
                    item_id=item_factory.item_id,
                    content_index=0,
                    delta=buffer
                )

        item_factory = None

        for token in generator:
            if not item_factory:
                item_factory = ResponseItemFactory(item_type="message")
                yield self.make_event(
                    "response.output_item.added", 
                    item=item_factory.make_initial_item()
                )

                yield self.make_event(
                    "response.output_text.delta",
                    item_id=item_factory.item_id,
                    content_index=0,
                    delta=leftover,
                )

            text += token
            yield self.make_event(
                "response.output_text.delta",
                item_id=item_factory.item_id,
                content_index=0,
                delta=token,
            )
        
        yield self.make_event(
            "response.output_text.done",
            item_id=item_factory.item_id,
            content_index=0,
            text=text
        )

        complete_item = item_factory.make_complete_item("output_text", text)
        yield self.make_event(
            "response.output_item.done",
            item=complete_item
        )

        self.response.append(complete_item)

    def notify_reasoning_started(self, item_factory, initial_thoughts):
        yield self.make_event(
            "response.output_item.added", 
            item=item_factory.make_initial_item()
        )

        yield self.make_event(
            "response.reasoning_text.delta",
            item_id=item_factory.item_id,
            content_index=0,
            delta=initial_thoughts
        )

    def notify_reasoning_ended(self, item_factory, thoughts, buffer):
        from assistant.utils import ThinkingDetector

        final_thoughts = ThinkingDetector.strip_tags(buffer)
    
        yield self.make_event(
            "response.reasoning_text.delta",
            item_id=item_factory.item_id,
            content_index=0,
            delta=final_thoughts
        )

        yield self.make_event(
            "response.reasoning_text.done",
            item_id=item_factory.item_id,
            content_index=0,
            text=thoughts + final_thoughts
        )

        complete_item = item_factory.make_complete_item("reasoning", thoughts + final_thoughts)

        yield self.make_event(
            "response.output_item.done",
            item=complete_item
        )

        self.response.append(complete_item)

    def make_event(self, event_type, **kwargs):
        self.seq_num += 1

        return {
            "type": event_type,
            "output_index": len(self.response),
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
