import json
import os
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

import boto3
from boto3.dynamodb.conditions import Key

from src.auth import get_user_from_event, jwt_required


def get_dynamodb() -> Any:
    """Get DynamoDB resource for local or AWS environment."""
    if os.environ.get("IS_OFFLINE"):
        return boto3.resource("dynamodb", endpoint_url="http://localhost:8000")
    return boto3.resource("dynamodb")


def get_user_table() -> Any:
    """Get users table from DynamoDB."""
    table_name = os.environ.get("USERS_TABLE_NAME", "unitemate-v2-users-dev")
    return get_dynamodb().Table(table_name)


@jwt_required
def get_me(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Get current user information."""
    try:
        user_info = get_user_from_event(event)
        auth0_user_id = user_info.get("sub")

        if not auth0_user_id:
            return {
                "statusCode": 400,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
                "body": json.dumps({"error": "Invalid user information"}),
            }

        table = get_user_table()

        response = table.query(
            IndexName="discord-id-index",
            KeyConditionExpression=Key("pk_constant").eq("USER") & Key("discord_id").eq(auth0_user_id),
        )

        if response["Items"]:
            user = response["Items"][0]
            return {
                "statusCode": 200,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
                "body": json.dumps(
                    {
                        "user_id": user["user_id"],
                        "discord_id": user["discord_id"],
                        "discord_username": user["discord_username"],
                        "discord_discriminator": user.get("discord_discriminator"),
                        "discord_avatar": user.get("discord_avatar"),
                        "rate": user["rate"],
                        "match_count": user["match_count"],
                        "win_count": user["win_count"],
                        "inqueue_status": user["inqueue_status"],
                        "created_at": user["created_at"],
                        "updated_at": user["updated_at"],
                    }
                ),
            }
        discord_info = _extract_discord_info_from_auth0(user_info)
        new_user = _create_new_user(auth0_user_id, discord_info)

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(new_user),
        }

    except Exception:  # noqa: BLE001
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps({"error": "Internal server error"}),
        }


def _extract_discord_info_from_auth0(user_info: dict[str, Any]) -> dict[str, Any]:
    nickname = user_info.get("nickname", "")
    name = user_info.get("name", "")
    picture = user_info.get("picture", "")

    discord_username = nickname or name or "Unknown User"

    if "#" in discord_username:
        username, discriminator = discord_username.split("#", 1)
        return {
            "discord_username": username,
            "discord_discriminator": discriminator,
            "discord_avatar": picture,
        }

    return {
        "discord_username": discord_username,
        "discord_discriminator": None,
        "discord_avatar": picture,
    }


def _create_new_user(auth0_user_id: str, discord_info: dict[str, Any]) -> dict[str, Any]:
    table = get_user_table()
    now = datetime.now(UTC).isoformat()
    user_id = str(uuid4())

    new_user = {
        "pk_constant": "USER",
        "user_id": user_id,
        "discord_id": auth0_user_id,
        "discord_username": discord_info["discord_username"],
        "discord_discriminator": discord_info.get("discord_discriminator"),
        "discord_avatar": discord_info.get("discord_avatar"),
        "rate": 1500,
        "match_count": 0,
        "win_count": 0,
        "inqueue_status": "out_of_queue",
        "created_at": now,
        "updated_at": now,
    }

    table.put_item(Item=new_user)

    return {
        "user_id": user_id,
        "discord_id": auth0_user_id,
        "discord_username": discord_info["discord_username"],
        "discord_discriminator": discord_info.get("discord_discriminator"),
        "discord_avatar": discord_info.get("discord_avatar"),
        "rate": 1500,
        "match_count": 0,
        "win_count": 0,
        "inqueue_status": "out_of_queue",
        "created_at": now,
        "updated_at": now,
    }
