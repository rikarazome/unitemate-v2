"""Simple WebSocket test handlers."""

import json
from typing import Any

def test_connect(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    """Simple test WebSocket connection handler."""
    print(f"[TEST] WebSocket connect called")
    print(f"[TEST] Event: {json.dumps(event, default=str)}")
    
    return {"statusCode": 200}

def test_disconnect(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    """Simple test WebSocket disconnect handler."""
    print(f"[TEST] WebSocket disconnect called")
    return {"statusCode": 200}

def test_message(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    """Simple test WebSocket message handler."""
    print(f"[TEST] WebSocket message called")
    return {"statusCode": 200}