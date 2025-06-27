import requests


class RagBackend:
    def retrieve_for(self, text):
        raise NotImplementedError


class NullRagBackend(RagBackend):
    def retrieve_for(self, text):
        return ""


class SimpleRagServer(RagBackend):
    def __init__(self, url, method='post', payload_key='prompt'):
        self.url = url
        self.method = method
        self.payload_key = payload_key

    def retrieve_for(self, text):
        # todo: handle content-type json in response
        # todo: handle connection errors
        data = {self.payload_key: text}
        headers = {'Content-Type': 'application/json'}
        method = getattr(requests, self.method)
        resp = method(self.url, json=data, headers=headers)
        if resp:
            return resp.text


backends = {
    "norag": NullRagBackend,
    "simple": SimpleRagServer,
}
