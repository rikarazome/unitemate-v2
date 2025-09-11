"""
Discord サーバー参加確認 API Handler
"""

import json
import os
import requests
import traceback
from typing import Dict, Any
from src.utils.response import create_success_response, create_error_response
from src.utils.auth0_management import get_user_info_from_token


def extract_discord_user_id(auth0_profile: Dict[str, Any]) -> str | None:
    """
    Auth0プロファイルからDiscordユーザーIDを抽出
    Auth0のsubjectは oauth2|discord|{discord_user_id} の形式
    """
    sub = auth0_profile.get("sub", "")
    print(f"extract_discord_user_id - Processing sub: {sub}")

    # 通常のAuth0 Discord接続の場合
    if sub.startswith("oauth2|discord|"):
        user_id = sub.split("|")[2]
        print(f"extract_discord_user_id - Extracted from oauth2|discord|: {user_id}")
        return user_id

    # 別の形式も試してみる
    if "discord" in sub.lower():
        parts = sub.split("|")
        print(f"extract_discord_user_id - Found discord in sub, parts: {parts}")
        if len(parts) >= 3:
            user_id = parts[-1]  # 最後の部分をユーザーIDとして使用
            print(f"extract_discord_user_id - Using last part as user_id: {user_id}")
            return user_id

    print(f"extract_discord_user_id - No Discord user ID found in sub: {sub}")
    return None


def check_discord_server_membership(discord_user_id: str) -> bool:
    """
    DiscordユーザーがサーバーのメンバーかどうかをDiscord APIで確認

    Args:
        discord_user_id: DiscordのユーザーID

    Returns:
        bool: サーバーメンバーの場合True、それ以外はFalse
    """
    # 環境変数から取得
    discord_bot_token = os.environ.get("DISCORD_BOT_TOKEN")
    discord_guild_id = os.environ.get("DISCORD_GUILD_ID")

    print(f"check_discord_server_membership - discord_user_id: {discord_user_id}")
    print(f"check_discord_server_membership - guild_id: {discord_guild_id}")
    print(f"check_discord_server_membership - bot_token present: {'yes' if discord_bot_token else 'no'}")

    if not discord_bot_token or not discord_guild_id:
        print("check_discord_server_membership - Discord configuration not found in environment variables")
        return False

    url = f"https://discord.com/api/v10/guilds/{discord_guild_id}/members/{discord_user_id}"
    headers = {"Authorization": f"Bot {discord_bot_token}", "Content-Type": "application/json"}

    print(f"check_discord_server_membership - Making request to: {url}")
    print(f"check_discord_server_membership - Headers: {headers}")

    # まずBotの状態を確認
    bot_check_url = f"https://discord.com/api/v10/guilds/{discord_guild_id}"
    print(f"check_discord_server_membership - Checking bot access to guild: {bot_check_url}")

    try:
        # Guild情報取得でBot権限をテスト
        bot_response = requests.get(bot_check_url, headers=headers, timeout=10)
        print(f"check_discord_server_membership - Bot guild access status: {bot_response.status_code}")
        if bot_response.status_code == 200:
            guild_info = bot_response.json()
            print(f"check_discord_server_membership - Guild info: {guild_info.get('name', 'Unknown')}")
        elif bot_response.status_code == 403:
            print(f"check_discord_server_membership - Bot lacks guild access permissions")

        # メンバー情報取得
        response = requests.get(url, headers=headers, timeout=10)
        print(f"check_discord_server_membership - Member check response status: {response.status_code}")

        if response.status_code == 200:
            # ユーザーはサーバーメンバー
            member_data = response.json()
            print(f"check_discord_server_membership - User {discord_user_id} is a member: {member_data}")
            return True
        elif response.status_code == 404:
            # ユーザーはサーバーメンバーではない
            print(f"check_discord_server_membership - User {discord_user_id} is NOT a member (404)")
            print(f"check_discord_server_membership - Discord API 404 response: {response.text}")
            return False
        elif response.status_code == 403:
            # 権限不足
            print(f"check_discord_server_membership - Permission denied (403)")
            print(f"check_discord_server_membership - Response: {response.text}")
            print(f"check_discord_server_membership - Bot may not have 'View Server Members' permission")
            return False
        else:
            # その他のエラー
            print(f"check_discord_server_membership - Discord API error: {response.status_code}")
            print(f"check_discord_server_membership - Response text: {response.text}")
            return False

    except requests.RequestException as e:
        print(f"check_discord_server_membership - Request exception: {e}")
        traceback.print_exc()
        return False


def lambda_handler(event, context):
    """
    Discord サーバー参加確認のLambdaハンドラー
    """
    print(f"discord_check received event: {event}")

    # 環境変数の確認
    discord_bot_token = os.environ.get("DISCORD_BOT_TOKEN")
    discord_guild_id = os.environ.get("DISCORD_GUILD_ID")
    auth0_domain = os.environ.get("AUTH0_DOMAIN")
    auth0_audience = os.environ.get("AUTH0_AUDIENCE")

    print(f"discord_check - Environment variables:")
    print(f"  DISCORD_BOT_TOKEN: {'present' if discord_bot_token else 'missing'}")
    print(f"  DISCORD_GUILD_ID: {discord_guild_id}")
    print(f"  AUTH0_DOMAIN: {auth0_domain}")
    print(f"  AUTH0_AUDIENCE: {auth0_audience}")

    try:
        # CORS対応
        if event.get("httpMethod") == "OPTIONS":
            return create_success_response({}, status_code=200)

        # 認証チェック
        auth_header = event.get("headers", {}).get("Authorization") or event.get("headers", {}).get("authorization")
        if not auth_header:
            return create_error_response(401, "Missing Authorization header")

        # トークンからユーザー情報を取得
        try:
            token = auth_header.replace("Bearer ", "")
            print(f"discord_check - Processing token: {token[:50]}...")

            user_info = get_user_info_from_token(token)
            print(f"discord_check - User info result: {user_info}")

            if not user_info:
                print("discord_check - get_user_info_from_token returned None")
                return create_error_response(401, "Invalid token")

        except Exception as e:
            print(f"Token validation error: {e}")
            traceback.print_exc()
            return create_error_response(401, "Invalid token")

        # Auth0プロファイルからDiscordユーザーIDを抽出
        print(f"discord_check - Full user_info: {user_info}")
        discord_user_id = extract_discord_user_id(user_info)
        print(f"discord_check - Extracted discord_user_id: {discord_user_id}")

        if not discord_user_id:
            print(f"discord_check - Failed to extract Discord user ID from sub: {user_info.get('sub', 'N/A')}")
            return create_success_response(
                {
                    "is_member": False,
                    "reason": "discord_not_connected",
                    "message": "Discord account is not connected to this Auth0 profile",
                }
            )

        # Discordサーバー参加確認
        print(f"discord_check - About to check membership for user_id: {discord_user_id}")
        is_member = check_discord_server_membership(discord_user_id)
        print(f"discord_check - Membership check result: {is_member}")

        discord_guild_id = os.environ.get("DISCORD_GUILD_ID", "unknown")

        response_data = {
            "is_member": is_member,
            "discord_user_id": discord_user_id,
            "guild_id": discord_guild_id,
            "message": "サーバーメンバーです" if is_member else "サーバーメンバーではありません",
        }
        print(f"discord_check - Returning response: {response_data}")

        return create_success_response(response_data)

    except Exception as e:
        print(f"Discord check error: {e}")
        traceback.print_exc()
        return create_error_response(500, f"Discord server membership check failed: {str(e)}")
