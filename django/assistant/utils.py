import re
import os
from typing import Tuple, List, Dict
from dataclasses import dataclass
from collections import namedtuple
import base64
from django.core.files.storage import default_storage

from assistant.models import Modality


@dataclass
class MessageSegment:
    type: str
    content: str
    metadata: dict = None

    def __eq__(self, value: object) -> bool:
        return self.type == value.type and self.content == value.content and self.metadata == value.metadata

    def create_modality(self, parent=None):
        kwargs = dict(modality_type=self.type, mixed_modality=parent)

        if self.type == "text":
            kwargs.update(dict(text=self.content))
        elif self.type == "code":
            kwargs.update(dict(file_path=self.metadata["file_path"]))
        return Modality.objects.create(**kwargs)


NamedCodeSegment = namedtuple("NamedCodeSegment", "index segment candidate_name")


def process_raw_message(text: str) -> Tuple[List[MessageSegment], List[Dict[str, str]]]:
    segments = parse_raw_message(text)
    sources = get_sources(segments)

    for src in sources:
        idx = src["index"]
        segments[idx].metadata["file_path"] = src["file_path"]

    sources = [dict(content=src["content"], file_path=src["file_path"]) for src in sources]
    return segments, sources


def parse_raw_message(text) -> List[MessageSegment]:
    pattern = re.compile("```(?P<lang>[a-zA-Z]+\n)?\s*(?P<code_block>.*?)```", flags=re.DOTALL)
    match = pattern.search(text)

    if not match:
        return [MessageSegment(type="text", content=text)]

    code = match.group("code_block")
    language = match.group("lang").strip().lower() if match.groupdict()["lang"] else None
    language = language or detect_language(code)
    language = normalize_language(language)

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
    if detect_js(code):
        return "javascript"
    
    if detect_python(code):
        return "python"

    return "css"


def detect_python(code):
    regex = "(print)"
    return re.search(regex, code, flags=re.DOTALL)


def detect_js(code):
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

    return re.search(regex, code, flags=re.DOTALL)


def normalize_language(language):
    language = language.lower()
    JAVASCRIPT = 'javascript'
    PYTHON = 'python'
    CSS = 'css'

    mapping = {
        'js': JAVASCRIPT,
        'jsx': JAVASCRIPT,
        'javascript': JAVASCRIPT,
        'python': PYTHON
    }

    return mapping.get(language, language)


def get_sources(segments) -> List[Dict[str, str]]:
    code_segments = get_named_code_segments(segments)
    js_segments = get_language_segments(code_segments, "javascript")
    python_segments = get_language_segments(code_segments, "python")
    css_segments = get_language_segments(code_segments, "css")

    python_sources = make_language_sources(python_segments, "main.py", "module_{}.css")
    css_sources = make_language_sources(css_segments, "styles.css", "styles_{}.css")
    js_sources = make_js_sources(js_segments)
 
    sources = js_sources + python_sources + css_sources

    sources.sort(key=lambda item: item["index"])
    return sources


def make_js_sources(js_segments):
    js_sources = []
    if len(js_segments) == 1:
        idx, seg, _ = js_segments[0]
        js_sources = [make_source(index=idx, file_path="main.js", content=seg.content)]
    elif len(js_segments) == 2:
        js_sources = resolve_couple(js_segments)
    else:
        js_sources = []
        for idx, obj in enumerate(js_segments):
            index, segment, name = obj
            name = name or f"module_{idx}.js"
            js_sources.append(make_source(index, name, segment.content))

    return js_sources


def resolve_couple(js_segments):
    (id1, segment1, candidate_name1), (id2, segment2, candidate_name2) = js_segments
    candidate_name1 = candidate_name1 or "module1.js"
    candidate_name2 = candidate_name2 or "module2.js"

    # add more libraries to exclude
    exclude = ["react", "redux"]
    seg1_imports = extract_imports(segment1.content, exclude=exclude)
    seg2_imports = extract_imports(segment2.content, exclude=exclude)

    # if total # of imports != 1, either there are no imports or we have circular imports
    if len(seg1_imports) + len(seg2_imports) != 1:
        return [make_source(id1, candidate_name1, segment1.content),
                make_source(id2, candidate_name2, segment2.content)]

    main_path = "main.js"
    if seg1_imports:
        imported_path = f"{seg1_imports[0]}.js"
        paths = (main_path, imported_path)
    else:
        imported_path = f"{seg2_imports[0]}.js"
        paths = (imported_path, main_path)

    path1, path2 = paths
    return [make_source(id1, path1, segment1.content),
            make_source(id2, path2, segment2.content)]


def get_named_code_segments(segments):
    candidate_name = None
    res = []
    for idx, seg in enumerate(segments):
        if seg.type == "text":
            candidates = find_files(seg.content)
            candidate_name = candidates and candidates[-1]
        elif seg.type == "code":
            res.append(NamedCodeSegment(idx, seg, candidate_name))
            candidate_name = None
    return res


def find_files(text):
    pattern = re.compile("(\"|\')?(?P<path>[/a-zA-Z0-9_-]*\.(js|css))(\"|\')?:?$",
                         flags=re.MULTILINE)
    return find_all(pattern, text, lambda match: match.group("path"))


def get_language_segments(named_segments, language):
    return [obj for obj in named_segments
            if obj.segment.metadata["language"] == language]


def make_language_sources(segments, main_path, main_template):
    if len(segments) == 1:
        idx, segment, name = segments[0]
        name = name or main_path
        sources = [make_source(idx, name, segment.content)]
    else:
        sources = [make_source(idx, (name or main_template.format(idx)), seg.content)
                   for idx, seg, name in segments]
    return sources


def make_source(index, file_path, content):
    return dict(index=index, file_path=file_path, content=content)


def extract_imports(js_code, exclude=None):
    exclude = exclude or []
    name_capture = "[\"'](?P<{}>[a-zA-Z0-9]+)[\"'];?$"

    import_regex = f"import\s[^'^\"]*from\s+{name_capture.format('name1')}"
    side_effect_import_regex = f"import\s+{name_capture.format('name2')}"
    regex = f"({import_regex}|{side_effect_import_regex})"

    pattern = re.compile(regex, flags=re.DOTALL | re.MULTILINE)

    def parse_match(match):
        return match.group("name1") if match.group("name1") else match.group("name2")
  
    imports = find_all(pattern, js_code, parse_match)
    return [name for name in imports if name not in exclude]


def find_all(regex_pattern, text, parse_match):
    res = []

    def _find(s):
        match = regex_pattern.search(s)
        if match:
            start, end = match.span()
            res.append(parse_match(match))
            s = s[end:]
            _find(s)

    _find(text)
    return res


def image_field_to_data_uri(image_field, mime_type=None):
    """
    Converts an ImageField file into a data URI.

    :param image_field: The ImageField instance from a Django model.
    :param mime_type: The MIME type of the image (default is 'image/*').
    :return: A data URI string or None if no file is available.
    """
    if not image_field or not image_field.name:
        return None

    if not mime_type:
        _, extension = os.path.splitext(image_field.name)
        subtype = extension[1:].lower()
        if subtype == "jpg":
            subtype = "jpeg"
        mime_type = f'image/{subtype}'
    try:
        print("mime type :", mime_type)
        with default_storage.open(image_field.name, 'rb') as f:
            image_data = f.read()

        base64_data = base64.b64encode(image_data).decode('utf-8')

        return f"data:{mime_type};base64,{base64_data}"

    except Exception as e:
        print(f"Error converting image to data URI: {e}")
        return None



def convert_modality(message, modality):
    if modality.modality_type == "text":
        content = [{ "type": "text", "text": modality.text}]
    elif modality.modality_type == "image":
        # todo: image to data uri
        data_uri = image_field_to_data_uri(modality.image)
        content = [{ "type": "image_url", "image_url": data_uri }]
    elif modality.modality_type == "code":
        path = modality.file_path
        assert message.active_revision is not None and message.active_revision.src_tree

        entries = [entry for entry in message.active_revision.src_tree
                   if entry["file_path"] == path]
        code = entries[0]["content"]

        content = [{ "type": "text", "text": f"```\n{code}\n```" }]
    elif modality.modality_type == "mixture":
        content = []
        for child in modality.mixture.all():
            content.extend(convert_modality(message, child))
    else:
        content = []

    return content


def convert(message):
    root_modality = message.content
    content = convert_modality(message, root_modality)
    return dict(role=message.role, content=content)


def prepare_messages(history, system_message=None):
    messages = [convert(msg_obj) for msg_obj in history]
    if system_message:
        messages = [{ "role": "system", "content": system_message }] + messages
    return messages


def fix_newlines(text):
    """Convert line breaks to Markdown line breaks"""
    if text:
        text = re.sub('\r\n', '\n', text)
        text = re.sub('\n', '\n\n', text)
    return text
