import json
import requests
import time


class BaseTtsBackend:
    def synthesize(self, text, voice_id=None):
        return None


class NullTtsBackend(BaseTtsBackend):
    pass


class DummyTtsBackend(BaseTtsBackend):
    def __init__(self, audio_file, delay=10):
        self.audio_file = audio_file
        self.delay = delay

    def synthesize(self, text, voice_id=None):
        time.sleep(self.delay)

        with open(self.audio_file, "rb") as f:
            data = f.read()
        return data        


class RemoteTtsBackend(BaseTtsBackend):
    endpoint = "/tts/"

    def __init__(self, host, port, default_voice, use_tls=True, proxies=None):
        self.host = host
        self.port = port
        self.default_voice = default_voice
        self.use_tls = use_tls
        self.proxies = proxies or {}

    def synthesize(self, text, voice_id=None):
        body = {
            "text": text,
            "sample_name": voice_id or self.default_voice
        }
        resp = self.make_request(self.endpoint, requests.post, data=json.dumps(body))

        audio = None
        if resp.status_code == 200:
            audio = resp.content
        else:
            # log this
            pass

        return audio

    def make_request(self, endpoint, method=None, data=None):
        method = method or requests.get
        url = self.make_url(endpoint)
        headers = {'Content-Type': 'application/json'}
        return method(url, data, headers=headers, proxies=self.proxies)

    def make_url(self, path):
        protocol = "http"
        if self.use_tls:
            protocol += "s"
        
        return f"{protocol}://{self.host}:{self.port}{path}"


backends = {
    "notts": NullTtsBackend,
    "dummy": DummyTtsBackend,
    "remote_tts": RemoteTtsBackend
}
