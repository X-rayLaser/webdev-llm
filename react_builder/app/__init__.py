from typing import List, Dict
import tarfile
from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.responses import FileResponse
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.builders import build, get_artifacts

app = FastAPI()


@app.get("/app_files/{build_id}/")
def app_files(build_id: str):
    tar_data = get_artifacts(build_id)
    return StreamingResponse(iter([tar_data]))


@app.post("/build-spa/")
def build_spa(src: UploadFile):
    # todo: create link for artifacts tar
    tar = tarfile.open(mode="r", fileobj=src.file)
    return build(tar)
