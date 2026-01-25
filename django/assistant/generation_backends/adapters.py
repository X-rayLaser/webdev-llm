from collections import UserDict
from assistant.utils import ThinkingDetector
from .base import ResponsesBackend, CompletionBackend, ChatCompletionJob


class CompletionBackendAdapter(ResponsesBackend):
    def __init__(self, backend: CompletionBackend) -> None:
        super().__init__()

        self.event_factory = None
        self.backend = backend
        self.response = []

    def generate(self, job: ChatCompletionJob):
        self.event_factory = EventFactory()
        generator = self.backend.generate(job)

        try:
            bufsize = ThinkingDetector.max_open_tag_len()
            buffer = next(
                yield_bufferred(generator, bufsize)
            )

        except StopIteration:
            return

        leftover = buffer

        if ThinkingDetector.detect_thinking_start(buffer):
            leftover = yield from self.get_reasoning_events(generator, buffer)
        
        yield from self.get_text_output_events(generator, leftover)

        yield self.event_factory.response_completed(self.response)

    def get_reasoning_events(self, generator, buffer):
        initial_thoughts = ThinkingDetector.strip_tags(buffer)
        item_factory = ResponseItemFactory(item_type="reasoning")
        thoughts = initial_thoughts

        yield self.event_factory.output_item_added(item_factory)
        yield self.event_factory.content_part_added(item_factory.item_id, 0, part_type="reasoning_text")
        yield self.event_factory.reasoning_text_delta(item_factory.item_id, initial_thoughts)

        leftover = ""
        bufsize = (ThinkingDetector.max_open_tag_len() + 1)
        prev_buffer = buffer
        for buffer in yield_bufferred(generator, bufsize):
            concat = prev_buffer + buffer
            
            if not ThinkingDetector.detect_thinking_end(concat):
                thoughts += buffer
                prev_buffer = buffer
                yield self.event_factory.reasoning_text_delta(item_factory.item_id, buffer)
                continue

            leftover = ThinkingDetector.get_text_after_tag(buffer)
            final_thoughts = buffer
    
            thoughts += buffer
            thoughts = ThinkingDetector.get_text_before_closing_tag(thoughts)

            if final_thoughts:
                yield self.event_factory.reasoning_text_delta(item_factory.item_id, final_thoughts)

            yield self.event_factory.reasoning_text_done(item_factory.item_id, thoughts)
            yield self.event_factory.content_part_done(
                item_factory.item_id, 0, part_type="reasoning_text", text=thoughts
            )

            complete_item = item_factory.make_complete_item("reasoning_text", thoughts)
            yield self.event_factory.output_item_done(complete_item)
            self.response.append(complete_item)
            break

        return leftover

    def get_text_output_events(self, generator, leftover):
        item_factory = None
        text = leftover

        for token in generator:
            if not item_factory:
                item_factory = ResponseItemFactory(item_type="message")
                yield self.event_factory.output_item_added(item_factory)
                yield self.event_factory.content_part_added(item_factory.item_id, 0, part_type="output_text")

                if leftover:
                    yield self.event_factory.output_text_delta(item_factory.item_id, 0, leftover)

            text += token
            yield self.event_factory.output_text_delta(item_factory.item_id, 0, token)
        
        if not item_factory and not leftover:
            return
        
        if not item_factory:
            item_factory = ResponseItemFactory(item_type="message")
            yield self.event_factory.output_item_added(item_factory)
            yield self.event_factory.content_part_added(item_factory.item_id, 0, part_type="output_text")

            yield self.event_factory.output_text_delta(item_factory.item_id, 0, leftover)

        yield self.event_factory.output_text_done(item_factory.item_id, text)

        yield self.event_factory.content_part_done(
            item_factory.item_id, 0, part_type="output_text", text=text
        )

        complete_item = item_factory.make_complete_item("output_text", text)
        yield self.event_factory.output_item_done(complete_item)

        self.response.append(complete_item)


class DataDict(UserDict):
    """
    A convenience dictionary supporting both key-based (`dict['foo']`)
    and attribute-based (`dict.foo`) access.
    """
    def __getattr__(self, name):
        try:
            return self.data[name]
        except KeyError:
            raise AttributeError(f"'DataDict' object has no attribute '{name}'")
    
    def __setattr__(self, name, value):
        if name == "data":
            super().__setattr__(name, value)
        else:
            self.data[name] = value
    
    def __delattr__(self, name):
        try:
            del self.data[name]
        except KeyError:
            raise AttributeError(f"'DataDict' object has no attribute '{name}'")

    def model_dump(self, **kwargs):
        """Recursively convert DataDict to a plain dict."""
        def convert(val):
            if isinstance(val, DataDict):
                return val.model_dump()
            elif isinstance(val, dict):
                return {k: convert(v) for k, v in val.items()}
            elif isinstance(val, list):
                return [convert(item) for item in val]
            elif isinstance(val, tuple):
                return [convert(item) for item in val]
            else:
                return val

        return {k: convert(v) for k, v in self.data.items()}


class EventFactory:
    def __init__(self):
        self.seq_num = 0
        self.output_index = 0

    def output_item_added(self, item_factory):
        event = self.make_event(
            "response.output_item.added",
            item=item_factory.make_initial_item()
        )

        return event

    def content_part_added(self, item_id, content_index, part_type):
        return self.make_event(
            "response.content_part.added",
            item_id=item_id,
            content_index=content_index,
            part={
                "type": part_type,
                "text": "",
                "annotations": []
            }
        )

    def content_part_done(self, item_id, content_index, part_type, text):
        return self.make_event(
            "response.content_part.done",
            item_id=item_id,
            content_index=content_index,
            part={
                "type": part_type,
                "text": text,
                "annotations": []
            }
        )

    def reasoning_text_delta(self, item_id, delta):
        return self.make_event(
            "response.reasoning_text.delta",
            item_id=item_id,
            content_index=0,
            delta=delta
        )

    def reasoning_text_done(self, item_id, text):
        return self.make_event(
            "response.reasoning_text.done",
            item_id=item_id,
            content_index=0,
            text=text
        )

    def output_text_delta(self, item_id, content_index, delta):
        return self.make_event(
            "response.output_text.delta",
            item_id=item_id,
            content_index=content_index,
            delta=delta,
        )

    def output_text_done(self, item_id, text):
        return self.make_event(
            "response.output_text.done",
            item_id=item_id,
            content_index=0,
            text=text
        )

    def output_item_done(self, complete_item):
        event = self.make_event(
            "response.output_item.done",
            item=complete_item
        )
        self.output_index += 1
        return event

    def response_completed(self, complete_items):
        self.seq_num += 1

        return DataDict({
            "type": "response.completed",
            "response": {
                "object": "response",
                "status": "completed",
                "error": None,
                "output": complete_items
            },
            "sequence_number": self.seq_num
        })

    def make_event(self, event_type, **kwargs):
        self.seq_num += 1

        return DataDict({
            "type": event_type,
            "output_index": self.output_index,
            "sequence_number": self.seq_num,
            **kwargs
        })


class ResponseItemFactory:
    def __init__(self, item_type="message"):
        self.item_id = 323
        self.item_type = item_type

    def make_item(self, status, content):
        return DataDict({
            "id": self.item_id,
            "status": status,
            "type": self.item_type,
            "role": "assistant",
            "content": content
        })

    def make_initial_item(self):
        return self.make_item("in_progress", [])

    def make_complete_item(self, content_type, text):
        content = [DataDict({
            "type": content_type,
            "text": text,
            "annotations": []
        })]
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
