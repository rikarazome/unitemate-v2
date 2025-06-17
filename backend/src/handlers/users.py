"""Lambda handlers for user-related API endpoints."""

import json
import os
from datetime import UTC, datetime
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError
from mypy_boto3_dynamodb.resources import TableResource
from mypy_boto3_dynamodb.service_resource import DynamoDBServiceResource

from src.auth import get_user_from_event, jwt_required


def get_dynamodb() -> DynamoDBServiceResource:
    """Get a DynamoDB resource client."""
    if os.environ.get("IS_OFFLINE"):
        return boto3.resource(
            "dynamodb",
            endpoint_url="http://localhost:8000",
            region_name="ap-northeast-1",
        )
    return boto3.resource("dynamodb")


def get_user_table() -> TableResource:
    """Get the DynamoDB table for users."""
    dynamodb = get_dynamodb()
    table_name = os.environ.get("USERS_TABLE_NAME", "unitemate-v2-users-dev")
    return dynamodb.Table(table_name)


@jwt_required
def get_me(event: dict[str, Any], _context: object) -> dict[str, Any]:
    """Retrieve current user information if it exists."""
    try:
        auth0_user_info = get_user_from_event(event)
        auth0_user_id = auth0_user_info.get("sub")

        if not auth0_user_id:
            return {
                "statusCode": 400,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
                "body": json.dumps({"error": "Invalid user information from token"}),
            }

        table = get_user_table()
        # Query GSI Auth0SubIndex using auth0_user_id (which is Auth0 'sub')
        response = table.query(
            IndexName="Auth0SubIndex",
            KeyConditionExpression=Key("auth0_sub").eq(auth0_user_id),
        )

        if not response["Items"]:
            # User not found
            return {
                "statusCode": 404,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
                "body": json.dumps({"error": "User not found"}),
            }

        user = response["Items"][0]
        # pk_constant is no longer used, so no need to pop it.
        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(user),
        }

    except ClientError as e:
        print(f"Error in get_me: {e}")  # Basic logging
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps({"error": "Internal server error"}),
        }


@jwt_required
def create_user(event: dict[str, Any], _context: object) -> dict[str, Any]:
    """Create a new user if one doesn't already exist."""
    try:
        auth0_token_info = get_user_from_event(event)
        auth0_user_id = auth0_token_info.get("sub")

        if not auth0_user_id:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "Auth0 user ID (sub) not found in token"}),
                "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            }

        # Request body from frontend (contains Auth0 user info)
        # Frontend should send the user profile information obtained from Auth0
        try:
            request_body = json.loads(event.get("body", "{}"))
        except json.JSONDecodeError:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "Invalid JSON in request body"}),
                "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            }

        # Extract Discord info primarily from the request_body sent by frontend,
        # or fall back to token info if necessary. The request_body is more likely
        # to have the rich profile information immediately after Auth0 login.
        discord_info = _extract_discord_info_from_auth0(request_body or auth0_token_info)

        table = get_user_table()
        # Check if user already exists using Auth0SubIndex and auth0_user_id (Auth0 'sub')
        existing_user_response = table.query(
            IndexName="Auth0SubIndex",
            KeyConditionExpression=Key("auth0_sub").eq(auth0_user_id),
        )
        if existing_user_response["Items"]:
            return {
                "statusCode": 409,  # Conflict
                "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": "User already exists"}),
            }

        # auth0_user_id is the Discord ID and will be used as the user_id (PK)
        new_user_data = _create_new_user_in_db(auth0_user_id, discord_info)

        return {
            "statusCode": 201,  # Created
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(new_user_data),
        }

    except ClientError as e:
        print(f"Error in create_user: {e}")  # Basic logging
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps({"error": "Internal server error"}),
        }


def _extract_discord_info_from_auth0(auth0_profile_info: dict[str, Any]) -> dict[str, Any]:
    """Extract Discord related information from Auth0 user profile information.

    This function assumes auth0_profile_info could be from id_token claims or
    the /userinfo endpoint. Auth0's 'nickname' might be Discord's
    username#discriminator. 'picture' is expected to be the Discord avatar URL.
    The accuracy of this function depends heavily on Auth0 IdP connection and rule settings.
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


def _create_new_user_in_db(discord_user_id: str, discord_info: dict[str, Any]) -> dict[str, Any]:
    """Create and put a new user item into DynamoDB and return the API-friendly user data."""
    table = get_user_table()
    now = datetime.now(UTC).isoformat()

    # discord_user_id (from Auth0 'sub') is the primary key for the table
    # and also stored in auth0_sub for GSI querying.
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

    # Return a representation of the user, similar to what get_me would return
    # pk_constant is no longer used.
    api_response_user_data = new_user_item.copy()
    return api_response_user_data
