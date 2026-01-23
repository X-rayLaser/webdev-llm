import time
import os
import json
import httpx
import openai
from openai import DefaultHttpxClient
from .base import CompletionBackend, ChatCompletionJob, ResponsesBackend
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


class OpenaiHelperMixin:
    def get_openai_client(self, url):
        http_client = self.get_http_client()

        timeout = 30 * 60 # 30 minutes

        return openai.OpenAI(
            base_url=url,
            api_key="sk-no-key-required",
            timeout=timeout,
            http_client=http_client
        )

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


class OpenAICompatibleBackend(OpenaiHelperMixin, CompletionBackend):

    def generate(self, job: ChatCompletionJob):
        params = self.prepare_params(job)

        client = self.get_openai_client(f"{job.base_url}/v1")

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


class OpenAICompatibleResponsesBackend(OpenaiHelperMixin, ResponsesBackend):
    def __init__(self) -> None:
        super().__init__()
        self.response = []

    def generate(self, job: ChatCompletionJob):
        client = self.get_openai_client(job.url)
        params = self.prepare_params(job)

        self.response = []

        while True:
            stream = client.responses.create(
                model=job.model,
                inputs=job.messages + self.response,
                stream=True,
                extra_body={"cache_prompt": True},
                **params
            )

            got_func = False

            for event in stream:
                item = event.item
                if event.type == "response.output_item.done":
                    self.response.append(item)

                if event.type == "response.output_item.done" and item.type == "function_call":
                    self.process_function_call(item)
                    got_func = True

                yield event
            
            if not got_func:
                break

    def process_function_call(self, item):
        func_name = item.name
        func_args = json.loads(item.arguments)

        result = 32 # call function and get result
        self.response.append({
            "type": "function_call_output",
            "call_id": item.call_id,
            "output": str(result)
        })


backends = {
    "dummy": DummyBackend,
    "dummy_coder": DummyCoderBackend,
    "openai_compatible": OpenAICompatibleBackend
}
