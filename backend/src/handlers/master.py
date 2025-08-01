"""Lambda handlers for master data API endpoints."""

import os
from typing import TYPE_CHECKING, Any

import boto3
from boto3.dynamodb.conditions import Key

from src.utils.response import create_error_response, create_success_response

if TYPE_CHECKING:
    from mypy_boto3_dynamodb.resources import TableResource  # type: ignore[attr-defined]
    from mypy_boto3_dynamodb.service_resource import DynamoDBServiceResource  # type: ignore[attr-defined]
else:
    TableResource = Any
    DynamoDBServiceResource = Any


def get_dynamodb() -> "DynamoDBServiceResource":
    """Get a DynamoDB resource client.

    Returns:
        DynamoDBServiceResource: DynamoDBリソースクライアント.

    """
    if os.environ.get("IS_OFFLINE"):
        return boto3.resource(
            "dynamodb",
            endpoint_url="http://localhost:8000",
            region_name="ap-northeast-1",
        )
    return boto3.resource("dynamodb")


def get_master_data_table() -> "TableResource":
    """Get the DynamoDB table for master data.

    Returns:
        TableResource: DynamoDBマスターデータテーブル.

    """
    dynamodb: DynamoDBServiceResource = get_dynamodb()
    table_name = os.environ["MASTER_DATA_TABLE_NAME"]
    return dynamodb.Table(table_name)


def get_master_data(event: dict, _context: object) -> dict:
    """マスターデータ取得.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: マスターデータまたはエラーレスポンス.

    """
    table = get_master_data_table()

    try:
        # 各データタイプのマスターデータを取得
        master_data = {
            "pokemon": [],
            "badges": [],
            "roles": [],
            "seasons": []
        }

        # ポケモンデータを取得
        pokemon_response = table.query(
            KeyConditionExpression=Key("data_type").eq("POKEMON")
        )
        master_data["pokemon"] = pokemon_response.get("Items", [])

        # 勲章データを取得
        badges_response = table.query(
            KeyConditionExpression=Key("data_type").eq("BADGE")
        )
        master_data["badges"] = badges_response.get("Items", [])

        # ロールデータを取得
        roles_response = table.query(
            KeyConditionExpression=Key("data_type").eq("ROLE")
        )
        master_data["roles"] = roles_response.get("Items", [])

        # シーズンデータを取得
        seasons_response = table.query(
            KeyConditionExpression=Key("data_type").eq("SEASON")
        )
        master_data["seasons"] = seasons_response.get("Items", [])

        return create_success_response(master_data)

    except Exception as e:
        return create_error_response(500, f"マスターデータの取得に失敗しました: {e!s}")
