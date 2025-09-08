#!/usr/bin/env python3
"""Test WebSocket connection directly"""

import asyncio
import websockets
import json

async def test_websocket():
    uri = "wss://t2ursu4hij.execute-api.ap-northeast-1.amazonaws.com/dev?user_id=889328415285600378"
    
    try:
        print(f"Connecting to {uri}")
        async with websockets.connect(uri) as websocket:
            print("Connected successfully!")
            
            # Send a ping message
            await websocket.send(json.dumps({"action": "ping"}))
            print("Sent ping message")
            
            # Wait for response
            response = await websocket.recv()
            print(f"Received: {response}")
            
    except Exception as e:
        print(f"Connection failed: {e}")
        print(f"Exception type: {type(e)}")

if __name__ == "__main__":
    asyncio.run(test_websocket())