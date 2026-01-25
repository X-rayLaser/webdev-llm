from typing import Optional
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

from contextlib import AsyncExitStack

MCP_SERVER_URL = "http://172.17.0.1:8000/mcp" 


class MCPClient:
    
    def __init__(self):
        self.session: Optional[ClientSession] = None
        self.exit_stack = AsyncExitStack()
        self.tools = []

    async def connect_to_server(self):
        """Connect to an MCP server"""

        transport = await self.exit_stack.enter_async_context(streamablehttp_client(MCP_SERVER_URL))

        print(transport)
        self.stdio, self.write, _ = transport
        self.session = await self.exit_stack.enter_async_context(ClientSession(self.stdio, self.write))

        await self.session.initialize()

        response = await self.session.list_tools()
        self.tools = response.tools
        print("\nConnected to server with tools:", [tool.name for tool in self.tools])

    async def call_function(self, tool_name, tool_args):
        return await self.session.call_tool(tool_name, tool_args)

    async def cleanup(self):
        """Clean up resources"""
        await self.exit_stack.aclose()
