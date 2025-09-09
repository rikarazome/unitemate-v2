"""
ダミー認証ハンドラー

テスト用ダミーアカウントでのログイン機能を提供する。
Discord認証をバイパスして、テストユーザーとしてログインできるようにする。
"""

import json
import os
import time

import boto3
from jose import jwt

from src.utils.response import create_error_response, create_success_response


# DynamoDB設定
dynamodb = boto3.resource("dynamodb")
users_table = dynamodb.Table(os.environ["USERS_TABLE_NAME"])

# JWT設定（テスト用）
DUMMY_JWT_SECRET = os.environ.get("DUMMY_JWT_SECRET", "dummy-secret-for-testing-only")
NAMESPACE = "default"


def get_dummy_users_list(event: dict, context: object) -> dict:
    """
    利用可能なダミーユーザー一覧を取得
    GET /api/auth/dummy/users エンドポイントで呼び出される
    """
    try:
        # ダミーユーザー一覧を取得
        dummy_users = []

        for i in range(1, 11):
            user_id = f"dummy_user_{i}"

            try:
                response = users_table.get_item(Key={"namespace": NAMESPACE, "user_id": user_id})

                if "Item" in response:
                    user = response["Item"]
                    # preferred_rolesは配列なので最初の要素を取得
                    roles = user.get("preferred_roles", ["TOP"])
                    preferred_role = roles[0] if roles else "TOP"

                    dummy_users.append(
                        {
                            "user_id": user_id,
                            "trainer_name": user.get(
                                "trainer_name", user.get("discord_username", f"テストユーザー{i}")
                            ),
                            "discord_username": user.get("discord_username", f"テストユーザー{i}"),
                            "rate": int(user.get("rate", 1500)),
                            "preferred_role": preferred_role,
                        }
                    )

            except Exception as e:
                print(f"Error getting dummy user {user_id}: {e}")
                continue

        return create_success_response(
            {
                "users": dummy_users,
                "dummy_users": dummy_users,  # 後方互換性のため残す
                "count": len(dummy_users),
            }
        )

    except Exception as e:
        print(f"get_dummy_users_list error: {e}")
        return create_error_response(500, f"Failed to get dummy users list: {str(e)}")


def dummy_login(event: dict, context: object) -> dict:
    """
    ダミーアカウントでログイン
    POST /api/auth/dummy/login エンドポイントで呼び出される

    リクエストボディ:
    {
        "user_id": "dummy_user_01",
        "password": "test_password_01"
    }
    """
    try:
        # リクエストボディを解析
        body = event.get("body", "{}")
        if isinstance(body, str):
            body_data = json.loads(body)
        else:
            body_data = body
        user_id = body_data.get("user_id")
        password = body_data.get("password")
        trainer_name = body_data.get("trainer_name")
        rate = body_data.get("rate")

        if not user_id:
            return create_error_response(400, "user_id is required")

        # ダミーユーザーかどうかチェック
        if not user_id.startswith("dummy_user_"):
            return create_error_response(400, "Invalid dummy user ID")

        # ユーザー情報を取得
        try:
            response = users_table.get_item(Key={"namespace": NAMESPACE, "user_id": user_id})

            if "Item" not in response:
                return create_error_response(404, "Dummy user not found")

            user = response["Item"]

        except Exception as e:
            print(f"Database error: {e}")
            return create_error_response(500, "Database error")

        # ダミーアカウントかどうか確認
        # user_idがdummy_user_で始まっていればダミーアカウント
        if not user_id.startswith("dummy_user_"):
            return create_error_response(400, "Not a dummy account")

        # パスワード確認（フロントエンドからのリクエストではスキップ）
        if password:
            # パスワードが指定された場合は従来の確認
            user_num = user_id.replace("dummy_user_", "")
            expected_password = f"test_password_{user_num}"
            if password != expected_password:
                return create_error_response(401, "Invalid password")

        # JWT作成（Auth0形式に似せる）
        payload = {
            "sub": f"dummy|discord|{user_id}",
            "user_id": f"dummy|discord|{user_id}",
            "aud": ["https://api.unitemate.com", "https://dev-m0boda6vkp30tmie.jp.auth0.com/userinfo"],
            "iss": "dummy-auth-for-testing",
            "iat": int(time.time()),
            "exp": int(time.time()) + 86400,  # 24時間有効
            "discord_id": user_id,
            "discord_username": user.get("discord_username"),
            "is_dummy": True,
            "original_user_id": user_id,  # 元のuser_idも保持
        }

        access_token = jwt.encode(payload, DUMMY_JWT_SECRET, algorithm="HS256")

        return create_success_response(
            {
                "access_token": access_token,
                "token_type": "Bearer",
                "expires_in": 86400,
                "user": {
                    "user_id": user_id,
                    "trainer_name": user.get("trainer_name", user.get("discord_username")),
                    "discord_username": user.get("discord_username"),
                    "rate": int(user.get("rate", 1500)),
                    "preferred_role": user.get("preferred_roles", ["TOP"])[0] if user.get("preferred_roles") else "TOP",
                    "is_dummy": True,
                },
            }
        )

    except json.JSONDecodeError:
        return create_error_response(400, "Invalid JSON body")
    except Exception as e:
        print(f"dummy_login error: {e}")
        return create_error_response(500, f"Login failed: {str(e)}")


def validate_dummy_token(token: str) -> dict[str, any]:
    """ダミートークンの検証.

    Args:
        token: JWT トークン

    Returns:
        デコードされたペイロード、または空のdict

    """
    try:
        print(f"AUTH: validate_dummy_token called with token: {token[:50]}...")
        
        try:
            # First try to decode without verification to check if it's a dummy token
            unverified_payload = jwt.decode(token, key="", options={
                "verify_signature": False,
                "verify_aud": False,
                "verify_exp": False,
                "verify_iat": False
            })
            print(f"AUTH: Unverified payload: {unverified_payload}")
        except Exception as decode_error:
            print(f"AUTH: Failed to decode token without verification: {decode_error}")
            return {}

        # Check if it's a dummy token before attempting validation
        if not unverified_payload.get("is_dummy"):
            print("AUTH: Not a dummy token, skipping")
            return {}

        print("AUTH: Detected dummy token, proceeding with validation")
        
        # It's a dummy token, so decode it with proper validation
        try:
            payload = jwt.decode(
                token,
                DUMMY_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False},  # Skip audience validation for dummy tokens
            )
            print(f"AUTH: Dummy token decoded successfully: {payload}")
        except Exception as validation_error:
            print(f"AUTH: Dummy token validation failed: {validation_error}")
            return {}

        # Double-check after verification
        if payload.get("is_dummy"):
            print(f"AUTH: Dummy token validated successfully for user: {payload.get('user_id')}")
            return payload

        print("AUTH: Token validation failed - not a dummy token after verification")
        return {}
    except jwt.ExpiredSignatureError:
        print("AUTH: Dummy token expired")
        return {}
    except jwt.JWTError as e:
        print(f"AUTH: Invalid dummy token: {e}")
        return {}
    except Exception as e:  # noqa: BLE001
        print(f"AUTH: Token validation error: {e}")
        return {}
