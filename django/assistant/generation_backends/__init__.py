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
        client = self.get_openai_client(f"{job.base_url}/v1")
        params = self.prepare_params(job)

        self.response = []

        messages = [self.adapt_message(msg) for msg in job.messages]

        counter = 0

        while counter < 4:
            counter += 1
            stream = client.responses.create(
                model=job.model,
                input=messages + self.response,
                #tools=tools,
                stream=True,
                extra_body={"cache_prompt": True},
                **params
            )

            got_func = False

            for event in stream:

                print('event', event, 'type', type(event))
                yield event

                if event.type == "response.output_item.done":
                    self.response.append(event.item)

                if event.type == "response.output_item.done" and event.item.type == "function_call":

                    item = event.item
                    result_item = self.process_function_call(item)
                    self.response.append(result_item)
                    got_func = True
                    func_result_event = {
                        "type": "response.custom_type.function_call_result",
                        "output_index": item.output_index,
                        "item": result_item
                    }
                    yield func_result_event


            if not got_func:
                break

    def adapt_message(self, message):
        """
        Adapt the converted message for downstream consumption by assigning input/output text types.
        """
        role = message.get("role")
        content = message.get("content") or []
        new_content = []
        if role in ["user", "system"]:
            for entry in content:
                new_entry = dict(entry)
                new_entry["type"] = "input_text"
                new_content.append(new_entry)
        elif role == "assistant":
            for entry in content:
                new_entry = dict(entry)
                new_entry["type"] = "output_text"
                new_content.append(new_entry)
        else:
            new_content = [dict(entry) for entry in content]

        if role == "assistant":
            import uuid

            return dict(
                id=str(uuid.uuid4()),
                status="completed",
                type="message",
                role=role,
                content=new_content
            )
        return dict(role=role, content=new_content)

    def process_function_call(self, item):
        func_name = item.name
        func_args = json.loads(item.arguments)

        import time

        time.sleep(5)

        result = 42 # call function and get result
        
        return {
            "type": "function_call_output",
            "call_id": item.call_id,
            "output": str(result)
        }


def prepare_backend(backend):
    if isinstance(backend, CompletionBackend):
        return CompletionBackendAdapter(backend)
    return backend


backends = {
    "dummy": DummyBackend,
    "dummy_coder": DummyCoderBackend,
    "openai_compatible": OpenAICompatibleBackend,
    "openai_compatible_mcp": OpenAICompatibleResponsesBackend
}
