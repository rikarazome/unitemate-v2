"""Common response utilities for Lambda functions."""

import json
from typing import Any


def create_success_response(data: Any, status_code: int = 200) -> dict[str, Any]:
    """成功レスポンスの生成.

    Args:
        data (Any): レスポンスデータ.
        status_code (int): HTTPステータスコード. デフォルトは200.

    Returns:
        dict[str, Any]: AWS Lambdaプロキシ結果オブジェクト.

    """
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
    """エラーレスポンスの生成.

    Args:
        status_code (int): HTTPエラーステータスコード.
        message (str): エラーメッセージ.

    Returns:
        dict[str, Any]: AWS Lambdaプロキシエラーレスポンスオブジェクト.

    """
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
