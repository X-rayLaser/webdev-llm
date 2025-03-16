from typing import List, Dict
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from app.builders import build


app = FastAPI()


class BuildSpec(BaseModel):
    source_tree: List[Dict[str, str]]


@app.post("/build-component/")
async def build_component(spec: BuildSpec):
    src_tree = spec.source_tree
    return build(src_tree)
