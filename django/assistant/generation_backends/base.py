from typing import List, Dict, Any
from dataclasses import dataclass
from abc import ABC, abstractmethod


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
