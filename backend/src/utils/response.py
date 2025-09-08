"""Common response utilities for Lambda functions."""

import json
from decimal import Decimal
from typing import Any


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
        "body": json.dumps(data, cls=CustomJSONEncoder),
    }


def create_error_response(status_code: int, message: str, data: Any = None) -> dict[str, Any]:
    """エラーレスポンスの生成.

    Args:
        status_code (int): HTTPエラーステータスコード.
        message (str): エラーメッセージ.
        data (Any): 追加のエラーデータ.

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
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        },
        "body": json.dumps(error_body, cls=CustomJSONEncoder),
    }
