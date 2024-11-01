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

    js_segments = get_language_segments(segments, "javascript")
    python_segments = get_language_segments(segments, "python")
    css_segments = get_language_segments(segments, "css")

    python_sources = make_language_sources(python_segments, "main.py", "module_{}.css")
    css_sources = make_language_sources(css_segments, "styles.css", "styles_{}.css")

    js_sources = []
    if len(js_segments) == 1:
        idx, seg = js_segments[0]
        js_sources = [dict(index=idx, file_path="main.js", content=seg.content)]
    elif len(js_segments) == 2:
        (id1, segment1), (id2, segment2) = js_segments

        seg1_imports = extract_imports(segment1.content)
        seg2_imports = extract_imports(segment2.content)
        
        # if total # of imports != 1, either there are no imports or we have circular imports
        if len(seg1_imports) + len(seg2_imports) != 1:
            js_sources = [dict(index=id1, file_path="module1.js", content=segment1.content),
                          dict(index=id2, file_path="module2.js", content=segment2.content)]
        else:
            main_path = "main.js"
            if seg1_imports:
                imported_path = f"{seg1_imports[0]}.js"
                paths = (main_path, imported_path)
            else:
                imported_path = f"{seg2_imports[0]}.js"
                paths = (imported_path, main_path)

            path1, path2 = paths
            js_sources = [dict(index=id1, file_path=path1, content=segment1.content),
                        dict(index=id2, file_path=path2, content=segment2.content)]
    else:
        pass
        # todo: generic algorithm

    sources = js_sources + python_sources + css_sources

    sources.sort(key=lambda item: item["index"])
    return sources


def get_language_segments(segments, language):
    return [(idx, seg) for idx, seg in enumerate(segments)
            if seg.type == "code" and seg.metadata["language"] == language]


def make_language_sources(segments, main_path, main_template):
    if len(segments) == 1:
        idx, segment = segments[0]
        sources = [dict(index=idx, file_path=main_path, content=segment.content)]
    else:
        sources = [dict(index=idx, file_path=main_template.format(idx), content=seg.content)
                   for idx, seg in segments]
    return sources


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
