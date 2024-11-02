import re
from typing import Tuple, List, Dict
from dataclasses import dataclass
from collections import namedtuple
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


NamedCodeSegment = namedtuple("NamedCodeSegment", "index segment candidate_name")


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


def get_sources(segments) -> List[Dict[str, str]]:
    code_segments = get_named_code_segments(segments)
    js_segments = get_language_segments(code_segments, "javascript")
    python_segments = get_language_segments(code_segments, "python")
    css_segments = get_language_segments(code_segments, "css")

    python_sources = make_language_sources(python_segments, "main.py", "module_{}.css")
    css_sources = make_language_sources(css_segments, "styles.css", "styles_{}.css")

    js_sources = []
    if len(js_segments) == 1:
        idx, seg, _ = js_segments[0]
        js_sources = [make_source(index=idx, file_path="main.js", content=seg.content)]
    elif len(js_segments) == 2:
        (id1, segment1, candidate_name1), (id2, segment2, candidate_name2) = js_segments
        candidate_name1 = candidate_name1 or "module1.js"
        candidate_name2 = candidate_name2 or "module2.js"

        seg1_imports = extract_imports(segment1.content)
        seg2_imports = extract_imports(segment2.content)
        
        # if total # of imports != 1, either there are no imports or we have circular imports
        if len(seg1_imports) + len(seg2_imports) != 1:
            js_sources = [make_source(id1, candidate_name1, segment1.content),
                          make_source(id2, candidate_name2, segment2.content)]
        else:
            main_path = "main.js"
            if seg1_imports:
                imported_path = f"{seg1_imports[0]}.js"
                paths = (main_path, imported_path)
            else:
                imported_path = f"{seg2_imports[0]}.js"
                paths = (imported_path, main_path)

            path1, path2 = paths
            js_sources = [make_source(id1, path1, segment1.content),
                          make_source(id2, path2, segment2.content)]
    else:
        js_sources = []
        for idx, obj in enumerate(js_segments):
            index, segment, name = obj
            name = name or f"module_{idx}.js"
            js_sources.append(make_source(index, name, segment.content))
 
    sources = js_sources + python_sources + css_sources

    sources.sort(key=lambda item: item["index"])
    return sources


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
    found_files = []

    def _find(s):
        regex = "(?P<path>[/a-zA-Z0-9_-]*\.(js|css)):?$"
        match = re.search(regex, s, flags=re.MULTILINE)
        if match:
            path = match.group("path")
            found_files.append(path)
            start, end = match.span()
            _find(s[end:])
    
    _find(text)
    return found_files


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


def extract_imports(js_code):
    # todo: exclude imports from libraries
    name_capture = "[\"'](?P<{}>[a-zA-Z0-9]+)[\"']"
    import_regex = f"import.*from\s+{name_capture.format('name1')}"
    side_effect_import_regex = f"import\s+{name_capture.format('name2')}"
    regex = f"({import_regex}|{side_effect_import_regex})"

    imports = []
    def extract(code):
        match = re.search(regex, code, flags=re.DOTALL)
        if match:
            start, end = match.span()
            if match.groupdict("name1"):
                name = match.group("name1")
            elif match.groupdict("name2"):
                name = match.group("name2")
            imports.append(name)
            extract(code[end:])

    extract(js_code)
    return imports


def process_raw_message(text: str) -> Tuple[List[MessageSegment], List[Dict[str, str]]]:
    segments = parse_raw_message(text)
    sources = get_sources(segments)

    for src in sources:
        idx = src["index"]
        segments[idx].metadata["file_path"] = src["file_path"]

    return segments, sources
