import json
from typing import Any


def hello(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Lambdaハンドラー関数"""
    body = {
        "message": "Go Serverless v4.0! Your function executed successfully!",
    }

    response = {"statusCode": 200, "body": json.dumps(body)}

    return response
