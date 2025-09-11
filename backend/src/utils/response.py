"""Common response utilities for Lambda functions."""

import json
import os
from decimal import Decimal
from typing import Any, Optional


class CustomJSONEncoder(json.JSONEncoder):
    """Custom JSON encoder to handle Decimal types."""

    def default(self, o: Any) -> Any:
        """Handle Decimal types by converting them to int or float."""
        if isinstance(o, Decimal):
            # Decimalをintに変換できるか試す
            if o % 1 == 0:
                return int(o)
            # できない場合はfloatに変換
            return float(o)
        return super().default(o)


def get_cors_origin(origin: Optional[str] = None) -> str:
    """Get appropriate CORS origin based on environment and request origin.
    
    Args:
        origin: The requesting origin from the request headers
        
    Returns:
        The appropriate Access-Control-Allow-Origin value
    """
    frontend_urls = os.getenv("FRONTEND_URL", "*")
    
    if frontend_urls == "*":
        return "*"
    
    # Parse comma-separated URLs
    allowed_urls = [url.strip() for url in frontend_urls.split(",")]
    
    # Check if the requesting origin is in the allowed list
    if origin and origin in allowed_urls:
        return origin
    
    # Default to first allowed URL if origin doesn't match
    return allowed_urls[0] if allowed_urls else "*"


def create_success_response(data: Any, status_code: int = 200, origin: Optional[str] = None) -> dict[str, Any]:
    """成功レスポンスの生成.

    Args:
        data (Any): レスポンスデータ.
        status_code (int): HTTPステータスコード. デフォルトは200.
        origin (Optional[str]): リクエスト元のOriginヘッダー.

    Returns:
        dict[str, Any]: AWS Lambdaプロキシ結果オブジェクト.

    """
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": get_cors_origin(origin),
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
            "Access-Control-Allow-Credentials": "true",
        },
        "body": json.dumps(data, cls=CustomJSONEncoder),
    }


def create_error_response(status_code: int, message: str, data: Any = None, origin: Optional[str] = None) -> dict[str, Any]:
    """エラーレスポンスの生成.

    Args:
        status_code (int): HTTPエラーステータスコード.
        message (str): エラーメッセージ.
        data (Any): 追加のエラーデータ.
        origin (Optional[str]): リクエスト元のOriginヘッダー.

    Returns:
        dict[str, Any]: AWS Lambdaプロキシエラーレスポンスオブジェクト.

    """
    error_body = {"error": message}
    if data:
        error_body.update(data)

    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": get_cors_origin(origin),
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
            "Access-Control-Allow-Credentials": "true",
        },
        "body": json.dumps(error_body, cls=CustomJSONEncoder),
    }
