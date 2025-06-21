"""Lambda handlers for user-related API endpoints."""

import json
import os
from datetime import UTC, datetime
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


def get_dynamodb() -> "DynamoDBServiceResource":  # Changed to double quotes
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


def get_user_table() -> "TableResource":  # Changed to double quotes
    """Get the DynamoDB table for users.

    Returns:
        TableResource: DynamoDBユーザーテーブル.

    """
    dynamodb: DynamoDBServiceResource = get_dynamodb()  # Changed to double quotes
    table_name = os.environ["USERS_TABLE_NAME"]
    return dynamodb.Table(table_name)


def get_me(event: dict, _context: object) -> dict:
    """ユーザー情報取得(認証済み前提).

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: ユーザー情報またはエラーレスポンス.

    """
    # オーソライザーから渡されたユーザー情報
    auth0_user_id = event["requestContext"]["authorizer"]["lambda"]["user_id"]
    if not auth0_user_id:
        return create_error_response(400, "User ID not found in context")

    # DynamoDBからユーザー情報を取得
    table = get_user_table()
    response = table.query(
        IndexName="Auth0SubIndex",
        KeyConditionExpression=Key("auth0_sub").eq(auth0_user_id),
    )

    if not response["Items"]:
        return create_error_response(404, "User not found")

    return create_success_response(response["Items"][0])


def create_user(event: dict, _context: object) -> dict:
    """新しいユーザーを作成(認証済み前提).

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 作成されたユーザー情報またはエラーレスポンス.

    """
    # オーソライザーから渡されたユーザー情報
    auth0_user_id = event["requestContext"]["authorizer"]["lambda"]["user_id"]
    discord_info = _extract_discord_info_from_auth0(json.loads(event["body"]))

    table = get_user_table()
    # 既存ユーザーの確認
    existing_user_response = table.query(
        IndexName="Auth0SubIndex",
        KeyConditionExpression=Key("auth0_sub").eq(auth0_user_id),
    )
    if existing_user_response["Items"]:
        return create_error_response(409, "User already exists")

    # 新しいユーザーを作成
    new_user_data = _create_new_user_in_db(auth0_user_id, discord_info)

    return create_success_response(new_user_data, 201)


def _extract_discord_info_from_auth0(auth0_profile_info: dict) -> dict:
    """Extract Discord related information from Auth0 user profile information.

    This function assumes auth0_profile_info could be from id_token claims or
    the /userinfo endpoint. Auth0's 'nickname' might be Discord's
    username#discriminator. 'picture' is expected to be the Discord avatar URL.
    The accuracy of this function depends heavily on Auth0 IdP connection and rule settings.

    Args:
        auth0_profile_info (dict): Auth0プロファイル情報.

    Returns:
        dict: 抽出されたDiscord情報.

    """
    # Try to get username, discriminator, and avatar from common Auth0 fields.
    # These fields might be directly available or nested within 'identities' or custom claims.
    nickname = auth0_profile_info.get("nickname", "")  # Often holds username#discriminator for Discord
    name = auth0_profile_info.get("name", "")  # Can be a fallback
    picture = auth0_profile_info.get("picture", "")  # Usually the avatar

    # Example of accessing nested data if Discord info is in identities array:
    # identities = auth0_profile_info.get("identities", [])
    # discord_identity_data = next((idt for idt in identities if idt.get("provider") == "discord"), None)
    # if discord_identity_data:
    #     nickname = discord_identity_data.get("profileData", {}).get("username", nickname)
    #     picture = discord_identity_data.get("profileData", {}).get("avatar_url", picture)

    discord_username_field = nickname or name

    # Handle new Discord usernames (no discriminator) vs. old (username#discriminator)
    if "#" in discord_username_field:
        username, discriminator = discord_username_field.split("#", 1)
        # Ensure discriminator is not empty if # is present
        discriminator = discriminator if discriminator else None
    else:
        username = discord_username_field
        discriminator = None  # For new Discord usernames or if not available

    if not username:  # If username is still empty, use a default
        username = "Unknown User"

    return {
        "discord_username": username,
        "discord_discriminator": discriminator,
        "discord_avatar_url": picture,  # Renamed for clarity
    }


def _create_new_user_in_db(discord_user_id: str, discord_info: dict) -> dict:
    """Create and put a new user item into DynamoDB and return the API-friendly user data.

    Args:
        discord_user_id (str): DiscordユーザーID.
        discord_info (dict): Discordユーザー情報.

    Returns:
        dict: 作成されたユーザーデータ.

    """
    table = get_user_table()
    now = int(datetime.now(UTC).timestamp())

    new_user_item = {
        "user_id": discord_user_id,  # PK: Discord's native ID (from Auth0 'sub')
        "auth0_sub": discord_user_id,  # GSI PK: Auth0 'sub' (same as user_id here)
        "discord_username": discord_info["discord_username"],
        "discord_discriminator": discord_info.get("discord_discriminator"),
        "discord_avatar_url": discord_info.get("discord_avatar_url"),  # Renamed
        "app_username": discord_info["discord_username"],  # Initial app username
        "created_at": now,
        "updated_at": now,
    }

    table.put_item(Item=new_user_item)
    return new_user_item
