import time
import os
import json
import httpx
import requests
import openai
from openai import DefaultHttpxClient
from .base import CompletionBackend, ChatCompletionJob, ResponsesBackend
from .adapters import CompletionBackendAdapter
from .adapters import DataDict

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
    BASE_MCP_SERVICE_URL = "http://mcp:11854"

    def __init__(self) -> None:
        super().__init__()
        self.response = []

    def generate(self, job: ChatCompletionJob):
        client = self.get_openai_client(f"{job.base_url}/v1")
        params = self.prepare_params(job)

        tools = self.list_tools()

        self.response = []

        messages = self.prepare_oai_messages(job.messages)

        counter = 0

        while counter < 4:
            counter += 1
            stream = client.responses.create(
                model=job.model,
                input=messages + self.response,
                tools=tools,
                stream=True,
                extra_body={"cache_prompt": True},
                **params
            )

            got_func = False

            for event in stream:

                print('event', event)
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
                        "output_index": event.output_index,
                        "item": result_item
                    }
                    yield DataDict(func_result_event)


            if not got_func:
                break

    def list_tools(self):
        url = f"{self.BASE_MCP_SERVICE_URL}/tools"
        response = requests.get(url)
        response.raise_for_status()
        return response.json()

    def prepare_oai_messages(self, messages):
        items = []
        for msg in messages:
            items.extend(self.get_items(msg))
        return items

    def get_items(self, msg):
        role = msg["role"]

        if role in ["user", "system"]:
            return [self.make_user_item(msg)]

        return [self.make_non_user_item(entry, role) for entry in msg["content"]]

    def make_user_item(self, msg):
        content = []
        for entry in msg.get("content", []):
            if entry["type"] == "text":
                content.append({
                    "text": entry.get("text", ""),
                    "type": "input_text"
                })
            elif entry["type"] == "image_url":
                content.append({
                    "image_url": entry.get("image_url", ""),
                    "type": "input_image",
                    "detail": "auto"
                })

        return {
            "role": msg["role"],
            "type": "message",
            "content": content
        }

    def make_non_user_item(self, entry, role=None):
        if entry["type"] == "text":
            return {
                "type": "message",
                "role": role,
                "content": [{
                    "text": entry.get("text", ""),
                    "type": "output_text" if role == "assistant" else "input_text"
                }]
            }
        else:
            return dict(entry)

    def process_function_call(self, item):
        payload = {
            "name":  item.name,
            "args": json.loads(item.arguments)
        }
        
        url = f"{self.BASE_MCP_SERVICE_URL}/call_function"

        try:
            response = requests.post(url, json=payload, timeout=30)
            response.raise_for_status()
            resp_data = response.json()
            result_data = resp_data["result"]
            if 'isError' in result_data and result_data['isError']:
                error_text = result_data['content'][0]['text']
                raise Exception(error_text)

            result = str(result_data)
        except Exception as e:
            result = f"Function call failed: {str(e)}"

        return DataDict({
            "type": "function_call_output",
            "call_id": item.call_id,
            "output": result
        })


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
