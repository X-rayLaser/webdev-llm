import time
import os
import httpx
import openai
from openai import DefaultHttpxClient
from .base import CompletionBackend, ChatCompletionJob
from .adapters import CompletionBackendAdapter


class DummyBackend(CompletionBackend):
    tokens = ["The", "quick", "brown", "fox", "jumps", "over", "the", "lazy", "dog", "."]
    separator = " "

    def __init__(self, sleep_secs=0.5):
        super().__init__()
        self.sleep_secs = sleep_secs

    def generate(self, job: ChatCompletionJob):
        for token in self.tokens:
            time.sleep(self.sleep_secs)
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
