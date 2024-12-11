import random
import string
from abc import ABC, abstractmethod


class Backend(ABC):
    @abstractmethod
    def summarize(self, text):
        return text


class DummySummarizationBackend(Backend):
    def summarize(self, text):
        translator = str.maketrans('', '', string.punctuation)
        stripped_text = text.translate(translator)
        
        words = stripped_text.split()

        if len(words) < 4:
            sampled_words = words
        else:
            sampled_words = random.sample(words, 4)

        return ' '.join(sampled_words)


class NeuralBackend(Backend):
    def summarize(self, text):
        return text


backends = {
    "dummy": DummySummarizationBackend,
    "neural": NeuralBackend
}
