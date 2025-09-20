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

    # 通常のAuth0 Discord接続の場合
    if sub.startswith("oauth2|discord|"):
        user_id = sub.split("|")[2]
        return user_id

    # 別の形式も試してみる
    if "discord" in sub.lower():
        parts = sub.split("|")
        if len(parts) >= 3:
            user_id = parts[-1]  # 最後の部分をユーザーIDとして使用
            return user_id

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


    if not discord_bot_token or not discord_guild_id:
        print("[ERROR] Discord configuration not found in environment variables")
        return False

    url = f"https://discord.com/api/v10/guilds/{discord_guild_id}/members/{discord_user_id}"
    headers = {"Authorization": f"Bot {discord_bot_token}", "Content-Type": "application/json"}


    # まずBotの状態を確認
    bot_check_url = f"https://discord.com/api/v10/guilds/{discord_guild_id}"

    try:
        # Guild情報取得でBot権限をテスト
        bot_response = requests.get(bot_check_url, headers=headers, timeout=10)
        if bot_response.status_code == 403:
            print(f"[ERROR] Bot lacks guild access permissions")

        # メンバー情報取得
        response = requests.get(url, headers=headers, timeout=10)

        if response.status_code == 200:
            # ユーザーはサーバーメンバー
            return True
        elif response.status_code == 404:
            # ユーザーはサーバーメンバーではない
            return False
        elif response.status_code == 403:
            # 権限不足
            print(f"[ERROR] Discord API Permission denied - Bot may not have 'View Server Members' permission")
            return False
        else:
            # その他のエラー
            print(f"[ERROR] Discord API error: {response.status_code}")
            return False

    except requests.RequestException as e:
        print(f"[ERROR] Discord API request exception: {e}")
        return False


def lambda_handler(event, context):
    """
    Discord サーバー参加確認のLambdaハンドラー
    """

    # 環境変数の確認
    discord_bot_token = os.environ.get("DISCORD_BOT_TOKEN")
    discord_guild_id = os.environ.get("DISCORD_GUILD_ID")
    auth0_domain = os.environ.get("AUTH0_DOMAIN")
    auth0_audience = os.environ.get("AUTH0_AUDIENCE")


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

            user_info = get_user_info_from_token(token)

            if not user_info:
                return create_error_response(401, "Invalid token")

        except Exception as e:
            print(f"[ERROR] Token validation error: {e}")
            return create_error_response(401, "Invalid token")

        # Auth0プロファイルからDiscordユーザーIDを抽出
        discord_user_id = extract_discord_user_id(user_info)

        if not discord_user_id:
            return create_success_response(
                {
                    "is_member": False,
                    "reason": "discord_not_connected",
                    "message": "Discord account is not connected to this Auth0 profile",
                }
            )

        # Discordサーバー参加確認
        is_member = check_discord_server_membership(discord_user_id)

        discord_guild_id = os.environ.get("DISCORD_GUILD_ID", "unknown")

        response_data = {
            "is_member": is_member,
            "discord_user_id": discord_user_id,
            "guild_id": discord_guild_id,
            "message": "サーバーメンバーです" if is_member else "サーバーメンバーではありません",
        }

        return create_success_response(response_data)

    except Exception as e:
        print(f"[ERROR] Discord check error: {e}")
        return create_error_response(500, f"Discord server membership check failed: {str(e)}")
