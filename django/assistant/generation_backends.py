from typing import List, Dict, Any
import time
from dataclasses import dataclass
from abc import ABC, abstractmethod
import openai
from openai import DefaultHttpxClient
import os


@dataclass
class ChatCompletionJob:
    model: str
    base_url: str
    messages: List[Dict[str, Any]]
    params: Dict[str, Any] = None


class Backend(ABC):
    def __init__(self):
        self.response = ""

    @abstractmethod
    def generate(self, job: ChatCompletionJob):
        pass


class DummyBackend(Backend):
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


class OpenAICompatibleBackend(Backend):

    def generate(self, job: ChatCompletionJob):
        http_client = self.get_http_client()

        timeout = 30 * 60 # 30 minutes
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
            extra_body={"cache_prompt": True}
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
                "http://": http_proxy,
                "https://": https_proxy,
            }
        else:
            proxies = None

        http_client = DefaultHttpxClient(
            proxies=proxies
        )
        
        return http_client


backends = {
    "dummy": DummyBackend,
    "dummy_coder": DummyCoderBackend,
    "openai_compatible": OpenAICompatibleBackend
}
