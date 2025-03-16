import os
import shutil
import subprocess
import uuid
from typing import Union, List, Dict, Tuple
from collections import namedtuple
from app.render import render_webpack_config


base_dir = "/data/builds"

def save_to_file(path, content):
    with open(path, "w") as f:
        f.write(content)


def load_file(path):
    with open(path) as f:
        return f.read()


class SimpleReactBuilder:
    def __init__(self, build_directory):
        self.build_directory = build_directory

    def build(self, src_tree):
        self._prepare_source_dir(src_tree)
        self._prepare_output_dir()
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

    def _prepare_source_dir(self, src_tree):
        source_dir = os.path.join(self.build_directory, "source")
        os.makedirs(source_dir)

        index_relative_path = "index.js"

        for file in src_tree:
            rel_path = file['file_path']

            if rel_path.startswith('./'):
                rel_path = rel_path[2:]

            path = os.path.join(source_dir, rel_path)

            if path.endswith('index.js'):
                index_relative_path = path

            if not path.endswith('webpack.config.js'):
                dir_path, _ = os.path.split(path)
                os.makedirs(dir_path, exist_ok=True)
                save_to_file(path, file['content'])

        index_path = os.path.join(source_dir, index_relative_path)
        webpack_config = render_webpack_config(
            build_path=self.build_directory, index_path=index_path
        )
        webpack_config_path = os.path.join(source_dir, "webpack.config.js")
        save_to_file(webpack_config_path, webpack_config)

    def _prepare_output_dir(self):
        os.makedirs(self.output_dir)

    def _build_artifacts(self):
        cwd = os.path.join(self.build_directory, "source")
        proc = subprocess.run(["npx", "webpack"], cwd=cwd, capture_output=True)
        return proc.stdout, proc.stderr

    @property
    def output_dir(self):
        return os.path.join(self.build_directory, "artifacts")


def build(src_tree, props=None):
    build_id = uuid.uuid4().hex
    build_directory = os.path.join(base_dir, build_id)
    builder = SimpleReactBuilder(build_directory)
    
    stdout, stderr = builder.build(src_tree)

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
