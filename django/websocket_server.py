import asyncio
import json
import argparse
import websockets
import redis.asyncio as redis


main_events_stream = "main_events_stream"


async def handler(websocket):
    async with r.pubsub() as pubsub:
        socket_session_id = await websocket.recv()
        print(f"<<< Got web socket session id: {socket_session_id}")

        listening_channel = f'{main_events_stream}:{socket_session_id}'

        await pubsub.subscribe(listening_channel)
        
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True)

            if not message:
                await asyncio.sleep(0.1)
                continue

            payload = message["data"].decode()
            channel = message["channel"].decode()

            if channel != listening_channel:
                print("Unknown channel:", channel)
                continue

            try:
                await websocket.send(payload)
            except (websockets.ConnectionClosed, websockets.ConnectionClosedOK):
                print("Connection closed by the client. Quitting")
                break


async def main(host, port):
    async with websockets.serve(handler, host, port):
        await asyncio.Future()  # run forever


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Start websockets server")
    parser.add_argument("--host", type=str, default="0.0.0.0")
    parser.add_argument("--port", type=int, default=9000)
    parser.add_argument("--redis-host", type=str, default="localhost")
    args = parser.parse_args()

    redis_host = args.redis_host
    print("REDIS_HOST", redis_host)

    redis_host = "redis"

    r = redis.from_url(f"redis://{redis_host}")

    asyncio.run(main(args.host, args.port))
