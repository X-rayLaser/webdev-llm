from fastapi import FastAPI

from fastapi import Request
from fastapi.responses import JSONResponse
from mcp_client import MCPClient

app = FastAPI()

mcp_client = MCPClient()


async def init_client():
    if mcp_client.session is None:
        await mcp_client.connect_to_server()


@app.get("/tools")
async def tools():
    await init_client()

    available_tools = [{
        "name": tool.name,
        "description": tool.description,
        "parameters": tool.inputSchema
    } for tool in mcp_client.tools]

    return available_tools


@app.post("/call_function")
async def call_function(request: Request):
    await init_client()
    
    payload = await request.json()
    name = payload.get("name")
    args = payload.get("args", {})

    result = await mcp_client.call_function(name, args)
    return {"result": result}
