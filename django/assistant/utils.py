import re
import os
import wave
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

JAVASCRIPT = 'javascript'
PYTHON = 'python'
CSS = 'css'


def process_raw_message(text: str) -> Tuple[List[MessageSegment], List[Dict[str, str]]]:
    # deprecated in favor of extract_modalities
    # todo: separate extraction of file names from follow preprocessing required for build process
    # todo: here only attempt to extract names given to files by LLM and save them to Modality and Revision
    segments = parse_raw_message(text)
    sources = get_sources(segments)
    return patch_segments_and_sources(segments, sources)


def extract_modalities(text: str, parent=None, extract_names=None) -> List[Modality]:
    segments, sources = extract_segments_with_sources(text, extract_names)
    modalities = [seg.create_modality(parent) for seg in segments]
    sources = finalize_sources(sources)
    return modalities, sources


def finalize_sources(sources):
    def has_shabang(content):
        shabangs = ['#!/bin/bash', '#!/bin/sh']
        lines = content.splitlines()
        if not lines:
            return False

        return any(s.strip() == lines[0].strip() for s in shabangs)
        
    def is_script(content):
        if has_shabang(content):
            return True

        bash_features = ["sudo", "pip", "npm", "apt", "apt-get", "wget", "curl"]
        for line in content.splitlines():
            words = line.split(' ')
            if any(w.strip() in bash_features for w in words):
                return True

        return False

    decorated_sources = []
    for src in sources:
        content = src['content']
        new_source = dict(src)

        is_untitled_script = is_script(content) and 'untitled' in src['file_path']

        if is_untitled_script and not has_shabang(content):
            new_source["snippet"] = True
        decorated_sources.append(new_source)

    return decorated_sources


def extract_segments_with_sources(text, extract_names=None):
    segments = parse_raw_message(text)

    if not extract_names:
        extract_names = get_named_code_segments

    decorated_segments = extract_names(segments)
    named_code_segments = [s for s in decorated_segments if s.candidate_name]
    unnamed_code_segments = [s for s in decorated_segments if not s.candidate_name]

    language_groups = {}

    lang_to_ext = {
        JAVASCRIPT: ".js",
        PYTHON: ".py",
        CSS: ".css"
    }

    for unnamed_seg in unnamed_code_segments:
        language = unnamed_seg.segment.metadata.get("language")
        extension = lang_to_ext.get(language, "")
        language_groups.setdefault(extension, []).append(unnamed_seg)

    sources = []
    for ext, segment_group in language_groups.items():
        sources = sources + make_language_sources(
            segment_group, f"untitled_0{ext}", "untitled_{}" + ext
        )

    sources = sources + make_language_sources(named_code_segments, "", "")
    sources.sort(key=lambda item: item["index"])
    return patch_segments_and_sources(segments, sources)


def patch_segments_and_sources(segments, sources):
    for src in sources:
        idx = src["index"]
        segments[idx].metadata["file_path"] = src["file_path"]

    sources = [dict(content=src["content"], file_path=src["file_path"]) for src in sources]
    return segments, sources


def parse_raw_message(text) -> List[MessageSegment]:
    pattern = re.compile("```(?P<lang>[a-zA-Z\+]+\n)?\s*(?P<code_block>.*?)```", flags=re.DOTALL)
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

    code_segments = parse_code_segments(code, language)
    segments.extend(code_segments)

    tail = text[end:]
    if tail.strip():
        tail_segments = parse_raw_message(tail)
        segments.extend(tail_segments)
    return segments


def parse_code_segments(code: str, language: str) -> List[MessageSegment]:
    code = code or ""

    fallback = [MessageSegment(type="code", content=code, metadata={"language": language})]

    if not language:
        return fallback

    lines = code.splitlines()
    marker_regex = get_marker_regex(language)
    
    marker_positions = []
    for i, line in enumerate(lines):
        match = marker_regex.match(line)
        if match:
            filename = match.group(1)
            marker_positions.append((i, filename))
    
    if not marker_positions:
        return fallback
    
    first_non_empty_index = next((i for i, line in enumerate(lines) if line.strip()), None)
    if first_non_empty_index is None or first_non_empty_index != marker_positions[0][0]:
        return fallback
    
    segments = []
    marker_positions.append((len(lines), None))
    
    for idx in range(len(marker_positions) - 1):
        start_index, filename = marker_positions[idx]
        next_index, _ = marker_positions[idx + 1]
        file_content = "\n".join(lines[start_index: next_index]).rstrip()
        segments.append(
            MessageSegment(
                type="code",
                content=file_content,
                metadata={"language": language}
            )
        )
    
    return segments


def get_marker_regex(language: str):
    comment_patterns = {
        "javascript": r'^\s*//\s*(\S+)\s*$',
        "python": r'^\s*#\s*(\S+)\s*$',
        "css": r'^\s*/\*\s*(\S+)\s*\*/$',
        "html": r'^\s*<!--\s*(\S+)\s*-->$',
    }
    return re.compile(comment_patterns.get(language.lower(), r'^\s*//\s*(\S+)\s*$'))


def detect_language(code):
    if detect_js(code):
        return "javascript"
    
    if detect_python(code):
        return "python"

    if detect_css(code):
        return "css"
    return ""


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


def detect_css(code):
    # todo: implement
    return False


def normalize_language(language):
    language = language.lower()

    mapping = {
        'js': JAVASCRIPT,
        'jsx': JAVASCRIPT,
        'javascript': JAVASCRIPT,
        'css': CSS,
        'css3': CSS,
        'python': PYTHON
    }

    return mapping.get(language, language)


def prepare_build_files(source_files):
    code_segments = []
    for idx, file in enumerate(source_files):
        content = file.get("content", "")
        language = file.get("language", CSS)
        file_path = file.get("file_path")
        metadata = dict(language=language, file_path=file_path)
        segment = MessageSegment(type="code", content=content, metadata=metadata)
        code_segments.append(NamedCodeSegment(idx, segment, file_path))

    sources =  get_source_tree(code_segments)
    return [dict(content=src["content"], file_path=src["file_path"]) for src in sources]


def get_sources(segments) -> List[Dict[str, str]]:
    code_segments = get_named_code_segments(segments)
    return get_source_tree(code_segments)


def get_source_tree(code_segments):
    js_segments = get_language_segments(code_segments, JAVASCRIPT)
    python_segments = get_language_segments(code_segments, PYTHON)
    css_segments = get_language_segments(code_segments, CSS)
    other_segments = get_other_segments(code_segments, [JAVASCRIPT, CSS, PYTHON])

    python_sources = make_language_sources(python_segments, "main.py", "module_{}.css")
    css_sources = make_language_sources(css_segments, "styles.css", "styles_{}.css")
    js_sources = make_js_sources(js_segments)
    other_sources = make_language_sources(other_segments, "untitled", "untitled_{}")
 
    sources = js_sources + python_sources + css_sources + other_sources

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


def get_named_code_segments(segments, extra_guess=True):
    candidates = []
    res = []

    for idx, seg in enumerate(segments):
        if seg.type == "text":
            candidates = find_files(seg.content)
        elif seg.type == "code":
            candidate_name = extract_name_from_comment(seg)

            if not candidate_name:
                candidate_name = select_candidate(candidates, seg)

            if extra_guess and not candidate_name:
                candidate_name = candidates and candidates[-1]
            res.append(NamedCodeSegment(idx, seg, candidate_name))
            candidates = []
    return res


def extract_name_from_comment(segment):
    """Tries to find a name of a given segment in the first non empty comment string"""
    lines = segment.content.split('\n') or []
    lines = [line for line in lines if line.strip()]
    comment_openers = ["//", "/*", "#"]
    if lines and any(lines[0].startswith(openner) for openner in comment_openers):
        comment_line = lines[0]
        if comment_line.startswith("//") or comment_line.startswith("/*"):
            comment_line = comment_line[2:]

        candidates = find_files(comment_line)
        return candidates and candidates[-1]


def select_candidate(candidates, segment):
    """Attempts to guess name of the last file written in a programming language of a segment"""
    lang2extensions = {
        CSS: [".css"],
        JAVASCRIPT: [".js", ".jsx"],
        PYTHON: [".py"]
    }

    if not segment.metadata:
        return

    candidates = [c for c in candidates if c]

    language = segment.metadata.get("language")
    if language:
        extensions = lang2extensions.get(language, [])
        matches = [s for s in reversed(candidates) if any(s.endswith(ext) for ext in extensions)]
        return matches and matches[0]


def find_files(text):

    def remove_urls(text):
        processed_lines = []
        url_features = ['//', '.com/', 'www', '&', '?', '=']
        for line in text.splitlines():
            parts = line.split(' ')
            filtered_parts = [p for p in parts if not any(f in p for f in url_features)]
            processed_lines.append(' '.join(filtered_parts))
        return '\n'.join(processed_lines)

    text = remove_urls(text)

    extensions = ["js", "jsx", "ts", "css", "py", "rb", "html", "c\+\+", "c", "cpp", "hpp", "h", "sh", "json"]
    re_ext = "|".join(extensions)
    pattern = re.compile("(\"|\')?(?P<path>(\./)?[/a-zA-Z0-9_\-]*(\.[a-zA-Z0-9_\-]+)?\.({}))(\"|\')?:?".format(re_ext),
                         flags=re.MULTILINE)
    paths = find_all(pattern, text, lambda match: match.group("path"))
    return [path[2:] if path.startswith('./') else path for path in paths]


def get_language_segments(named_segments, language):
    return [obj for obj in named_segments
            if obj.segment.metadata["language"] == language]


def get_other_segments(named_segments, exclude_list):
    return [obj for obj in named_segments
            if obj.segment.metadata["language"] not in exclude_list]


def make_language_sources(segments, main_path, main_template):
    if len(segments) == 1:
        idx, segment, name = segments[0]
        name = name or main_path
        sources = [make_source(idx, name, segment.content)]
    else:
        sources = [make_source(idx, (name or main_template.format(src_file_no)), seg.content)
                   for src_file_no, (idx, seg, name) in enumerate(segments)]
    return sources


def make_source(index, file_path, content):
    return dict(index=index, file_path=file_path, content=content)


def extract_imports(js_code, exclude=None):
    exclude = exclude or []
    name_capture = "[\"'](\./)?(?P<{}>[/a-zA-Z0-9_\-]+)[\"'];?$"

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


def get_multimedia_message_text(multimedia_message):
    dict_entry = convert(multimedia_message)
    content = dict_entry.get("content")
    if not content:
        return ""

    strings = []
    for entry in content:
        if entry["type"] != "text":
            continue

        try:
            text = entry[entry["type"]]
            strings.append(text)
        except KeyError as e:
            print('Error:', repr(e))

    return '\n'.join(strings)


def fix_newlines(text):
    """Convert line breaks to Markdown line breaks"""
    if text:
        text = re.sub('\r\n', '\n', text)
        text = re.sub('\n', '\n\n', text)
    return text


class ThinkingDetector:
    candidate_tags = ['think', 'thinking', 'thoughts', 'cot', 'reason', 'reasoning']

    @classmethod
    def split_thinking(cls, text):
        thinking_start = 0
        thinking_end = 0

        for tag_name in cls.candidate_tags:
            tag = f'<{tag_name}>'
            close_tag = f'</{tag_name}>'
            idx = cls.find_tag(text, tag)
            if idx >= 0:
                thinking_start = idx
                thinking_end = text.find(close_tag)
                if thinking_end == -1:
                    thinking_end = 0
                else:
                    thinking_end += len(close_tag)
                break

        thinking_text = text[thinking_start:thinking_end]
        spoken_text = text[thinking_end:]
        return thinking_text, spoken_text

    @classmethod
    def detect_thinking_start(cls, text):
        tags = [f'<{tag_name}>' for tag_name in cls.candidate_tags]
        return any(cls.contains_tag(text, tag) for tag in tags)

    @classmethod
    def detect_thinking_end(cls, text):
        tags = [f'</{tag_name}>' for tag_name in cls.candidate_tags]
        return any(cls.contains_tag(text, tag) for tag in tags)

    @classmethod
    def find_tag(cls, text, tag):
        return text.lower().find(tag)

    @classmethod
    def contains_tag(cls, text, tag):
        return cls.find_tag(text, tag) >= 0


def join_wavs(samples, result_path):
    data= []
    params = None

    for sample in samples:
        file_field = sample.audio
        w = wave.open(file_field.path, 'rb')
        params = w.getparams()
        data.append(w.readframes(w.getnframes()))
        w.close()

    with wave.open(result_path, 'wb') as output:
        output.setparams(params)
        for row in data:
            output.writeframes(row)

    with open(result_path, 'rb') as f:
        res = f.read()
    
    os.remove(result_path)
    return res


def get_wave_duration(file_path):
    with wave.open(file_path, mode="rb") as f:
        frames = f.getnframes()
        rate = f.getframerate()
        duration = frames / rate
    return duration
