"""Common response utilities for Lambda functions."""

import json
from typing import Any


def create_success_response(data: Any, status_code: int = 200) -> dict[str, Any]:
    """成功レスポンスの生成."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        },
        "body": json.dumps(data),
    }


def create_error_response(status_code: int, message: str) -> dict[str, Any]:
    """エラーレスポンスの生成."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        },
        "body": json.dumps({"error": message}),
    }
