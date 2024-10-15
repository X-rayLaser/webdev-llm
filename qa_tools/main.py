from typing import Union
import uuid
import subprocess
import re
import os
import shutil
from fastapi import FastAPI
from render import render_indexjs, render_webpack_config

app = FastAPI()

base_dir = "/data/builds"
index_html_path = "/app/index.html"


def preprocess(src_tree):
    files = src_tree["files"]
    js_file = files[0]
    js_code = fix_imports(js_file["source"])
    css_file = files[1]
    css_code = css_file["source"]
    return js_code, css_code


def fix_import_line(match):
    text = match.group(0)
    text = text.replace(', React', "").replace('React,', "").replace('React', "")
    text = text.replace("  ", " ")
    if text.startswith('import from'):
        return ""
    return text


def fix_imports(code):
    pattern = re.compile('import .* from .*')
    return pattern.sub(fix_import_line, code)


class BadSourceCodeError(Exception):
    pass


class NoSourceFilesError(BadSourceCodeError):
    pass


class NoJsCodeError(BadSourceCodeError):
    pass


def parse_name(code):
    return 'MainComponent'


def props_to_string(props: dict) -> str:
    props = props or {}
    return " ".join(f'{k}="{v}"' for k, v in props.items())


class SimpleReactBuilder:
    def __init__(self, build_directory):
        self.build_directory = build_directory

    def build(self, js_code, css_code="", props=None):
        component_name = parse_name(js_code)
        props_str = props_to_string(props)
        index_js = render_indexjs(component_name=component_name,
                                  component_definition=js_code,
                                  props_str=props_str)

        self._prepare_source_dir(index_js)
        self._prepare_output_dir(css_code)
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

    def _prepare_source_dir(self, index_js):
        source_dir = os.path.join(self.build_directory, "source")
        indexjs_path = os.path.join(source_dir, "index.js")
        os.makedirs(source_dir)

        save_to_file(indexjs_path, index_js)

        webpack_config = render_webpack_config(build_path=self.build_directory)
        webpack_config_path = os.path.join(source_dir, "webpack.config.js")
        save_to_file(webpack_config_path, webpack_config)

    def _prepare_output_dir(self, css_code):
        os.makedirs(self.output_dir)
        index_html_output_path = os.path.join(self.output_dir, "index.html")
        shutil.copyfile(index_html_path, index_html_output_path)

        css_path = os.path.join(self.output_dir, "styles.css")
        save_to_file(css_path, css_code)

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
    
    js_code, css_code = preprocess(src_tree)

    stdout, stderr = builder.build(js_code, css_code)

    artifacts = builder.load_artifacts()
    return {
        'stdout': stdout,
        'stderr': stderr,
        'artifacts': artifacts
    }
