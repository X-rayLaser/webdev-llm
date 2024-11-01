import re
from typing import Tuple, List, Dict
from dataclasses import dataclass
from assistant.models import Modality


@dataclass
class MessageSegment:
    type: str
    content: str
    metadata: dict = None

    def __eq__(self, value: object) -> bool:
        return self.type == value.type and self.content == value.content and self.metadata == value.metadata

    def create_modality(self):
        pass


def parse_raw_message(text) -> List[MessageSegment]:
    pattern = re.compile("```(?P<lang>[a-zA-Z]+\n)?\s*(?P<code_block>.*?)```", flags=re.DOTALL)
    match = pattern.search(text)
    
    if not match:
        return [MessageSegment(type="text", content=text)]

    code = match.group("code_block")
    language = match.group("lang").strip().lower() if match.groupdict()["lang"] else None
    language = language or detect_language(code)

    start, end = match.span()

    text_block = text[:start]
    segments = []
    if text_block.strip():
        segments.append(MessageSegment(type="text", content=text_block))

    kwargs = dict(type="code", content=code)
    kwargs["metadata"] = dict(language=language)
    
    segments.append(MessageSegment(**kwargs))

    tail = text[end:]
    if tail.strip():
        tail_segments = parse_raw_message(tail)
        segments.extend(tail_segments)
    return segments


def detect_language(code):
    name_regex = "[a-zA-Z0-9]+"
    func_name_regex = f"(?P<func_name>{name_regex})"
    arrow_func_name_regex = f"(?P<arrow_func_name>{name_regex})"
    parentheses_regex = "\s*\(.*\)\s*"
    func_body_regex = "\{.*\}"
    arrow_func_def = "\s*=.*=>"

    func_regex = r"function\s+" + func_name_regex + parentheses_regex + func_body_regex
    arrow_regex = r"(const|let)\s+" + arrow_func_name_regex + arrow_func_def

    var_name = "[a-zA-Z][a-zA-Z0-9]*"
    const_var = f"const\s+{var_name}\s*=.*"
    let_var = f"let\s+{var_name}\s*=.*"

    regex = f"({func_regex}|{arrow_regex}|{const_var}|{let_var}|console.log)"

    m = re.search(regex, code, flags=re.DOTALL)
    if m:
        return "javascript"
    return "css"


def get_sources(segments) -> List[Dict[str, str]]:
    sources = []
    for idx, segment in enumerate(segments):
        if segment.type == "code":
            language = segment.metadata.get("language")

            if "javascript" in language.lower():
                path = "main.js"
            elif "python" in language.lower():
                path = "main.py"
            else:
                path = "styles.css"

            sources.append({ "index": idx, "file_path": path, "content": segment.content })

    return sources


def process_raw_message(text: str) -> Tuple[List[MessageSegment], List[Dict[str, str]]]:
    segments = parse_raw_message(text)
    sources = get_sources(segments)

    for src in sources:
        idx = src["index"]
        segments[idx].metadata["file_path"] = src["file_path"]

    return segments, sources
