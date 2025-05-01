import os
import shutil
import subprocess
import uuid
import tarfile
import io
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


def exclude_config(member, path):
    if os.path.basename(member.name).endswith('webpack.config.js'):
        return None
    return tarfile.tar_filter(member, path)


class SimpleReactBuilder:
    def __init__(self, repo_directory):
        self.repo_directory = repo_directory

    def build(self, tar):
        self._prepare_source_dir(tar)
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

    def _prepare_source_dir(self, tar):
        source_dir = os.path.join(self.repo_directory, "source")
        os.makedirs(source_dir)

        index_path = self._get_indexjs(source_dir, tar)
        #todo: exlude config (filter only available in Python 3.12)
        tar.extractall(path=source_dir)
        tar.close()

        webpack_config = render_webpack_config(
            build_path=self.repo_directory, index_path=index_path
        )
        webpack_config_path = os.path.join(source_dir, "webpack.config.js")
        save_to_file(webpack_config_path, webpack_config)

    def _get_indexjs(self, source_dir, tar):
        index_relative_path = "index.js"

        for member in tar.getmembers():
            path = member.name
            if path.endswith('index.js'):
                index_relative_path = path

        index_path = os.path.join(source_dir, index_relative_path)
        return os.path.normpath(index_path)

    def _prepare_output_dir(self):
        os.makedirs(self.output_dir)

    def _build_artifacts(self):
        cwd = os.path.join(self.repo_directory, "source")
        proc = subprocess.run(["npx", "webpack"], cwd=cwd, capture_output=True)
        return proc.stdout, proc.stderr

    @property
    def output_dir(self):
        return os.path.join(self.repo_directory, "artifacts")


def build(tar, props=None):
    build_id = uuid.uuid4().hex
    repo_directory = os.path.join(base_dir, build_id)
    builder = SimpleReactBuilder(repo_directory)
    
    stdout, stderr = builder.build(tar)

    stdout = stdout.decode(encoding="utf-8")
    stderr = stderr.decode(encoding="utf-8")
    success = "successfully" in stdout.lower()

    return {
        'success': success,
        'stdout': stdout,
        'stderr': stderr,
        'build_id': build_id
    }


def get_artifacts(build_id):
    root_folder = os.path.join(base_dir, build_id)
    path = os.path.join(root_folder, 'artifacts')
    arcname = os.path.basename(path)

    f = io.BytesIO()

    with tarfile.open(fileobj=f, mode='w') as tar:
        tar.add(path, arcname=arcname, recursive=True)
    
    f.seek(0)
    return f.read()
