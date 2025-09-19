"""Lambda handlers for master data API endpoints."""

import json
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
        master_data = {"pokemon": [], "badges": [], "roles": [], "seasons": []}

        # ポケモンデータを取得
        pokemon_response = table.query(KeyConditionExpression=Key("data_type").eq("POKEMON"))
        master_data["pokemon"] = pokemon_response.get("Items", [])

        # 勲章データを取得
        badges_response = table.query(KeyConditionExpression=Key("data_type").eq("BADGE"))
        master_data["badges"] = badges_response.get("Items", [])

        # ロールデータを取得
        roles_response = table.query(KeyConditionExpression=Key("data_type").eq("ROLE"))
        master_data["roles"] = roles_response.get("Items", [])

        # シーズンデータを取得
        seasons_response = table.query(KeyConditionExpression=Key("data_type").eq("SEASON"))
        master_data["seasons"] = seasons_response.get("Items", [])

        # 設定データを取得
        settings_response = table.query(KeyConditionExpression=Key("data_type").eq("SETTING"))
        master_data["settings"] = settings_response.get("Items", [])

        # 10分間のキャッシュを設定（認証必要なのでやや短め）
        cache_control = "private, max-age=600, s-maxage=600"
        return create_success_response(master_data, cache_control=cache_control)

    except Exception as e:
        return create_error_response(500, f"マスターデータの取得に失敗しました: {e!s}")


def get_public_master_data(event: dict, _context: object) -> dict:
    """パブリック向けマスターデータ取得（勲章データのみ - ショップページ用）.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: パブリックマスターデータまたはエラーレスポンス.

    """
    # Originヘッダーを取得（CORS対応）
    origin = event.get("headers", {}).get("origin") or event.get("headers", {}).get("Origin")

    table = get_master_data_table()

    try:
        # 勲章データのみを取得（ショップページ用）
        badges_response = table.query(KeyConditionExpression=Key("data_type").eq("BADGE"))
        badges = badges_response.get("Items", [])

        master_data = {
            "badges": badges
        }

        # 1時間のキャッシュを設定 (コスト削減強化)
        cache_control = "public, max-age=3600, s-maxage=3600"
        return create_success_response(master_data, origin=origin, cache_control=cache_control)

    except Exception as e:
        return create_error_response(500, f"パブリックマスターデータの取得に失敗しました: {e!s}", origin=origin)


def get_public_system_data(event: dict, _context: object) -> dict:
    """パブリック向けシステムデータ取得（設定・お知らせ用 - メインページ用）.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: パブリックシステムデータまたはエラーレスポンス.

    """
    # Originヘッダーを取得（CORS対応）
    origin = event.get("headers", {}).get("origin") or event.get("headers", {}).get("Origin")

    table = get_master_data_table()

    try:
        # 設定データを取得（ルール・お知らせ・制限時間用）
        settings_response = table.query(KeyConditionExpression=Key("data_type").eq("SETTING"))
        settings = settings_response.get("Items", [])

        system_data = {
            "settings": settings
        }

        # 1時間のキャッシュを設定 (コスト削減強化)
        cache_control = "public, max-age=3600, s-maxage=3600"
        return create_success_response(system_data, origin=origin, cache_control=cache_control)

    except Exception as e:
        return create_error_response(500, f"パブリックシステムデータの取得に失敗しました: {e!s}", origin=origin)


def update_setting(event: dict, _context: object) -> dict:
    """設定マスターデータ更新.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 更新結果またはエラーレスポンス.

    """
    table = get_master_data_table()

    try:
        # リクエストボディを解析
        body_data = json.loads(event.get("body", "{}"))
        setting_id = body_data.get("id")
        setting_value = body_data.get("value")

        if not setting_id:
            return create_error_response(400, "設定IDが必要です")

        if setting_value is None:
            return create_error_response(400, "設定値が必要です")

        # 有効な設定IDかどうかチェック
        valid_settings = ["lobby_create_timeout", "lobby_join_timeout", "rules_content", "announcement_content"]

        if setting_id not in valid_settings:
            return create_error_response(400, f"無効な設定ID: {setting_id}")

        # データを更新
        table.put_item(Item={"data_type": "SETTING", "id": setting_id, "value": setting_value})

        return create_success_response({"message": "設定が更新されました", "id": setting_id, "value": setting_value})

    except json.JSONDecodeError:
        return create_error_response(400, "無効なJSONフォーマットです")
    except Exception as e:
        return create_error_response(500, f"設定の更新に失敗しました: {e!s}")
