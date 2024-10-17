from typing import Union, List, Dict, Tuple
from collections import namedtuple
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from app.builders import build
from app.exceptions import BadSourceCodeError
app = FastAPI()


class BuildSpec(BaseModel):
    source_tree: List[Dict[str, str]]


@app.post("/build-component/")
async def build_component(spec: BuildSpec):
    src_tree = spec.source_tree
    try:
        return build(src_tree)
    except BadSourceCodeError as e:
        raise HTTPException(status_code=400, detail=e.detail())
