from typing import Union, List, Dict, Tuple
import uuid
import subprocess
import re
import os
import shutil
from collections import namedtuple
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from render import render_indexjs, render_webpack_config

app = FastAPI()

base_dir = "/data/builds"
index_html_path = "/app/index.html"


ReactAppSource = namedtuple("ReactAppSource", ["js_code", "css_code", "js_path", "css_path"])


def null_js_renderer(js_code, js_path, props):
    return js_code


def react_root_renderer(js_code, js_path, props):
    if js_path.endswith("index.js"):
        return js_code

    component_name = parse_name(js_code)
    props_str = props_to_string(props)
    index_js = render_indexjs(component_name=component_name, 
                              component_definition=js_code,
                              props_str=props_str)
    
    # todo: insert all hooks into index.js template; remove all hooks from user sent component file
    index_js = clear_imports(index_js, to_remove="ReactDOM")
    index_js = clear_imports(index_js, to_remove="React")
    
    return index_js


def preprocess(source_tree: List[Dict[str, str]], js_renderer=None) -> Tuple[str, str]:
    """Extract a javascript code and css code from an in-memory representation of source code files

    source_tree is a list of source files where each file is of the form:
    { "content": <the source code as string>, "file_path": <path of the source file> }

    Raises NoSourceFilesError exception for empty source_tree.

    Raises NoJsCodeError exception when source_tree does not contain any Javascript files.

    Raises EmptyJavascriptFileError exception when source_tree contains empty/blank Javascript file.

    Raises MalformedFileEntryError exception when source_tree contains 
    file with missing fields "content" or "file_path".
    
    Returns a named tuple of type ReactAppSource.

    If css code is missing, second item in the tuple will be an empty string.
    """
    if not source_tree:
        raise NoSourceFilesError

    js_renderer = js_renderer or null_js_renderer

    try:
        all_js_entries = [item for item in source_tree if item["file_path"].endswith(".js")]
        all_css_entries = [item for item in source_tree if item["file_path"].endswith(".css")]
    except KeyError as e:
        raise MalformedFileEntryError(*e.args)

    if not all_js_entries:
        raise NoJsCodeError

    js_entry = all_js_entries[0]
    js_path = js_entry["file_path"]

    try:
        js_code = js_entry["content"]
        css_code = all_css_entries[0]["content"] if all_css_entries else ""
        css_path = all_css_entries[0]["file_path"] if all_css_entries else ""
    except KeyError as e:
        raise MalformedFileEntryError(*e.args)

    if not js_code.strip():
        raise EmptyJavascriptFileError(js_path)

    js_code = fix_css_imports(js_code, all_css_entries)

    props = js_entry.get("props")
    js_code = js_renderer(js_code, js_path, props)
    return ReactAppSource(js_code, css_code, js_path, css_path)


def fix_css_imports(js_code, css_entries):
    if css_entries:
        file_path = css_entries[0]["file_path"]
        import_path = f"./{file_path}"
        css_import1 = f'import "{import_path}";\n'
        css_import2 = f"import '{import_path}';\n"
        has_css_import = css_import1 in js_code or css_import2 in js_code

        if not has_css_import:
            js_code = f'import "./{file_path}";\n' + js_code

    return js_code


def clear_bracket_imports(imports_str, to_remove):
    import_list = [name.strip() for name in imports_str.split(',')]
    import_list = [name for name in import_list if name and name != to_remove]
    return ', '.join(import_list) if import_list else ''


def clear_default_and_named_import(regex, text, to_remove):
    matches = re.findall(regex, text)
    default_import, imports_str, lib_str = matches[0]
    new_import_str = clear_bracket_imports(imports_str, to_remove)
    default_import = "" if default_import == to_remove else default_import

    if default_import and new_import_str:
        return 'import {}, {{ {} }} from {}'.format(default_import, new_import_str.strip(), lib_str)

    if default_import:
        return 'import {} from {}'.format(default_import, lib_str)
    
    if new_import_str:
        return 'import {{ {} }} from {}'.format(new_import_str, lib_str)
    
    return ""


def clear_default_with_namespace_import(regex, text, to_remove):
    matches = re.findall(regex, text)
    default_import, name_space, lib_str = matches[0]
    if default_import == to_remove:
        return f'import * as {name_space} from {lib_str}'
    return text


def clear_named_import(regex, text, to_remove):
    matches = re.findall(regex, text)
    imports_str, lib_str = matches[0]
    new_import_str = clear_bracket_imports(imports_str, to_remove)

    if not new_import_str:
        return ""

    return 'import {{ {} }} from {}'.format(new_import_str, lib_str)


def clear_default_import(regex, text, to_remove):
    matches = re.findall(regex, text)
    if matches and matches[0] == to_remove:
        return ""
    return text


def clear_imports(code, to_remove="React"):

    def fix_import_line(match):
        text = match.group(0).strip()

        default_and_named_import = 'import\s+([a-zA-Z]+)\s*,\s*{(.*)}\s+from\s+(.*)'

        if re.search(default_and_named_import, text):
            return clear_default_and_named_import(default_and_named_import, text, to_remove)

        default_and_namespace_import = 'import\s+([a-zA-Z]+)\s*,\s*\* as ([a-zA-Z]+)\s+from\s+(.*)'

        if re.search(default_and_namespace_import, text):
            return clear_default_with_namespace_import(default_and_namespace_import, text, to_remove)

        named_import = 'import\s+{(.*)}\s+from\s+(.*)'
        
        if re.search(named_import, text):
            return clear_named_import(named_import, text, to_remove)

        default_import = 'import\s+([a-zA-Z]+)\s+from'
        if re.search(default_import, text):
            return clear_default_import(default_import, text, to_remove)

        return text

    pattern = re.compile('\s*import .* from .*')
    return pattern.sub(fix_import_line, code)


class BadSourceCodeError(Exception):
    def detail(self):
        return "Bad format of source_tree"


class NoSourceFilesError(BadSourceCodeError):
    def detail(self):
        return "No source files provided"


class NoJsCodeError(BadSourceCodeError):
    def detail(self):
        return 'Expected at least one file entry with ".js" extension'


class EmptyJavascriptFileError(BadSourceCodeError):
    def detail(self):
        return f'Found blank file: "{self.args[0]}"'


class MalformedFileEntryError(BadSourceCodeError):
    def detail(self):
        return f'Malformed file entry: missing required field "{self.args[0]}"'


def parse_name(code):
    return 'MainComponent'


def props_to_string(props: dict) -> str:
    props = props or {}
    return " ".join(f'{k}="{v}"' for k, v in props.items())


class SimpleReactBuilder:
    def __init__(self, build_directory):
        self.build_directory = build_directory

    def build(self, source: ReactAppSource):
        self._prepare_source_dir(source)
        self._prepare_output_dir(source)
        return self._build_artifacts()

    def load_artifacts(self):
        artifacts = {}
        for file_name in os.listdir(self.output_dir):
            path = os.path.join(self.output_dir, file_name)
            try:
                artifacts[file_name] = load_file(path)
            except FileNotFoundError:
                print(f'Failed to load non-existing file "{file_name}"')

        return artifacts

    def _prepare_source_dir(self, source: ReactAppSource):
        source_dir = os.path.join(self.build_directory, "source")
        indexjs_path = os.path.join(source_dir, "index.js")
        os.makedirs(source_dir)

        save_to_file(indexjs_path, source.js_code)

        if source.css_code:
            css_path = os.path.join(source_dir, source.css_path or "main.css")
            save_to_file(css_path, source.css_code)

        webpack_config = render_webpack_config(build_path=self.build_directory)
        webpack_config_path = os.path.join(source_dir, "webpack.config.js")
        save_to_file(webpack_config_path, webpack_config)

    def _prepare_output_dir(self, source: ReactAppSource):
        os.makedirs(self.output_dir)

        if not source.css_code:
            css_path = os.path.join(self.output_dir, "main.css")
            save_to_file(css_path, "")

        index_html_output_path = os.path.join(self.output_dir, "index.html")
        shutil.copyfile(index_html_path, index_html_output_path)

    def _build_artifacts(self):
        cwd = os.path.join(self.build_directory, "source")
        proc = subprocess.run(["npx", "webpack"], cwd=cwd, capture_output=True)
        return proc.stdout, proc.stderr

    @property
    def output_dir(self):
        return os.path.join(self.build_directory, "artifacts")


def save_to_file(path, content):
    with open(path, "w") as f:
        f.write(content)


def load_file(path):
    with open(path) as f:
        return f.read()


def build(src_tree, props=None):
    build_id = uuid.uuid4().hex
    build_directory = os.path.join(base_dir, build_id)
    builder = SimpleReactBuilder(build_directory)
    
    source = preprocess(src_tree, js_renderer=react_root_renderer)

    stdout, stderr = builder.build(source)

    artifacts = builder.load_artifacts()

    stdout = stdout.decode(encoding="utf-8")
    stderr = stderr.decode(encoding="utf-8")
    success = "successfully" in stdout.lower()

    return {
        'success': success,
        'stdout': stdout,
        'stderr': stderr,
        'artifacts': artifacts
    }


class BuildSpec(BaseModel):
    source_tree: List[Dict[str, str]]


@app.post("/build-component/")
async def build_component(spec: BuildSpec):
    src_tree = spec.source_tree
    try:
        return build(src_tree)
    except BadSourceCodeError as e:
        raise HTTPException(status_code=400, detail=e.detail())
