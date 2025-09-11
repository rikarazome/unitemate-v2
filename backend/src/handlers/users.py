"""Lambda handlers for user-related API endpoints."""

import json
import os
import traceback
import boto3
from boto3.dynamodb.conditions import Key

from pydantic import BaseModel, Field, field_validator

from src.models.user import CreateUserRequest as UserCreateRequest
from src.models.user import UpdateProfileRequest as UserUpdateRequest
from src.services.user_service import UserService
from src.utils.response import create_error_response, create_success_response
from src.utils.auth0_management import get_management_client, extract_discord_info_from_management_api

# DynamoDB設定
dynamodb = boto3.resource("dynamodb")
users_table = dynamodb.Table(os.environ["USERS_TABLE_NAME"])
records_table = dynamodb.Table(os.environ["RECORDS_TABLE_NAME"])

# 定数定義
MAX_FAVORITE_POKEMON = 3

# Pydanticモデル定義


class Auth0UserProfile(BaseModel):
    """Auth0から取得したユーザープロファイル情報."""

    sub: str
    nickname: str | None = None
    name: str | None = None
    picture: str | None = None
    updated_at: str | None = None


class CreateUserRequest(BaseModel):
    """ユーザー作成リクエスト."""

    auth0_profile: Auth0UserProfile
    trainer_name: str = Field(..., min_length=1, max_length=50)
    twitter_id: str | None = Field(None, max_length=16)
    preferred_roles: list[str] = Field(default_factory=list, max_length=5)
    bio: str | None = Field(None, max_length=500)

    @field_validator("trainer_name")
    @classmethod
    def validate_trainer_name(cls, v: str) -> str:
        """トレーナー名のバリデーション."""
        if not v.strip():
            error_msg = "トレーナー名は必須です。"
            raise ValueError(error_msg)
        return v.strip()

    @field_validator("twitter_id")
    @classmethod
    def validate_twitter_id(cls, v: str | None) -> str | None:
        """Twitter IDのバリデーション."""
        if v is None:
            return v
        if not v.startswith("@"):
            error_msg = "Twitter IDは@マーク付きで入力してください。"
            raise ValueError(error_msg)
        return v

    @field_validator("preferred_roles")
    @classmethod
    def validate_preferred_roles(cls, v: list[str]) -> list[str]:
        """希望ロールのバリデーション."""
        valid_roles = {"TOP_LANE", "SUPPORT", "MIDDLE", "BOTTOM_LANE", "TANK"}
        for role in v:
            if role not in valid_roles:
                error_msg = f"無効な希望ロールです: {role}"
                raise ValueError(error_msg)
        return v


def get_me(event: dict, _context: object) -> dict:
    """ユーザー情報取得(認証済み前提).

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: ユーザー情報またはエラーレスポンス.

    """
    # オーソライザーから渡されたユーザー情報 (HTTP API形式)
    print(f"getMe - Full event keys: {list(event.keys())}")
    print(f"getMe - requestContext: {json.dumps(event.get('requestContext', {}), default=str)}")
    print(
        f"getMe - requestContext.authorizer: {json.dumps(event.get('requestContext', {}).get('authorizer', {}), default=str)}"
    )

    try:
        # HTTP API形式のオーソライザーコンテキストから取得
        # 重要: enableSimpleResponses: true の場合、コンテキストは以下の構造になる:
        # event.requestContext.authorizer.lambda.{context_property}
        # 参考: https://github.com/serverless/serverless/issues/10463
        # AWS公式: コンテキストは $context.authorizer.property としてアクセスされる
        request_context = event.get("requestContext", {})
        authorizer = request_context.get("authorizer", {})

        # lambdaキーの下のコンテキストを取得
        lambda_context = authorizer.get("lambda", {})
        auth0_user_id = lambda_context.get("user_id")

        print(f"getMe - Full lambda_context: {json.dumps(lambda_context, default=str)}")

        if not auth0_user_id:
            # デバッグのため、実際の構造を出力
            print(f"getMe - requestContext structure: {json.dumps(request_context, default=str)}")
            print(f"getMe - user_id not found. authorizer: {authorizer}, lambda: {lambda_context}")
            return create_error_response(401, "Unauthorized: user_id not found in authorizer context")

        print(f"getMe - Using user_id: {auth0_user_id}")
    except Exception as e:
        print(f"getMe - Error extracting user_id: {e}")
        print(f"getMe - Full event: {json.dumps(event, default=str)}")
        return create_error_response(401, "Unauthorized: failed to extract user_id")

    # UserServiceを使用して現在のユーザーを取得
    user_service = UserService()

    # Auth0 IDからDiscord IDを抽出
    if auth0_user_id.startswith("dummy|discord|"):
        # ダミーユーザーの場合
        actual_user_id = auth0_user_id.split("|")[-1]  # "dummy_user_X" を抽出
        print(f"getMe - Detected dummy user, looking up by user_id: {actual_user_id}")
    else:
        # 通常のAuth0ユーザーの場合：常にDiscord IDで検索
        actual_user_id = auth0_user_id.split("|")[-1] if "|" in auth0_user_id else auth0_user_id
        print(f"getMe - Extracted Discord ID from user_id: {actual_user_id}")

    # Discord IDで直接検索
    user = user_service.get_user_by_user_id(actual_user_id)
    print(f"getMe - User lookup result: {user}")

    if not user:
        print(f"getMe - User not found for user_id: {auth0_user_id}, attempting auto-creation")

        # 自動ユーザー作成を試行
        try:
            # 自動ユーザー作成時はプレースホルダー値を使用
            # Discord情報の更新は後でフロントエンドからのプロファイル更新で行う
            auto_created_user = user_service.create_user_auto(
                discord_id=actual_user_id,
                discord_username=f"User_{actual_user_id[:8]}",
                discord_discriminator=None,
                discord_avatar_url=None,
            )

            if auto_created_user:
                print(f"getMe - Auto-created user: {auto_created_user}")
                response_data = auto_created_user.model_dump()
                response_data["win_rate"] = auto_created_user.win_rate
                return create_success_response(response_data)
            else:
                print(f"getMe - Failed to auto-create user for: {auth0_user_id}")
                return create_error_response(500, "Failed to create user automatically")

        except Exception as e:
            print(f"getMe - Error during auto-creation: {e}")
            return create_error_response(500, f"Failed to create user: {str(e)}")

    # Discord情報の更新が必要な場合（プレースホルダーユーザー名の場合）
    # フロントエンドからIDトークンの情報を受け取る必要があるため、
    # ここでは更新は行わず、フロントエンド側でプロファイル更新を促す

    print(f"getMe - Found user: {user}")

    # ユーザー情報の辞書を作成
    user_data = user.model_dump()

    # 最新の50件の試合データ（records）を取得
    latest_matches = []
    try:
        # user_idでレコードを検索（user_idがPartition Key）
        records_response = records_table.query(
            KeyConditionExpression=Key("user_id").eq(user.user_id),
            ScanIndexForward=False,  # 降順（match_idが大きい順 = 最新順）
            Limit=50,
            ProjectionExpression="pokemon, match_id, rate_delta, started_date, winlose",
        )
        latest_matches = records_response.get("Items", [])
        print(f"getMe - Retrieved {len(latest_matches)} records for user {user.user_id}")
    except Exception as e:
        print(f"getMe - Error fetching records: {str(e)}")
        # レコード取得失敗時もユーザーデータは返す
        latest_matches = []

    # レスポンスに試合データを追加
    user_data["latest_matches"] = latest_matches

    return create_success_response(user_data)


def create_user(event: dict, _context: object) -> dict:
    """新しいユーザーを作成(認証済み前提).

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 作成されたユーザー情報またはエラーレスポンス.

    """
    # オーソライザーから渡されたユーザー情報 (HTTP API形式)
    print(f"createUser - Full event keys: {list(event.keys())}")
    print(f"createUser - requestContext keys: {list(event.get('requestContext', {}).keys())}")
    print(f"createUser - authorizer: {json.dumps(event.get('requestContext', {}).get('authorizer', {}), default=str)}")

    # 重要: AWS HTTP API + enableSimpleResponses:true の場合のコンテキスト構造
    # 正しいパス: event.requestContext.authorizer.lambda.{context_property}
    # 参考: https://github.com/serverless/serverless/issues/10463

    try:
        # HTTP API形式のオーソライザーコンテキストから取得
        # enableSimpleResponses: true の場合、コンテキストは lambda キーの下にネストされる
        authorizer_context = event.get("requestContext", {}).get("authorizer", {})
        lambda_context = authorizer_context.get("lambda", {})
        auth0_user_id = lambda_context.get("user_id")

        if not auth0_user_id:
            print(f"createUser - user_id not found in authorizer context: {authorizer_context}")
            return create_error_response(401, "Unauthorized: user_id not found in authorizer context")

        print(f"createUser - Using user_id: {auth0_user_id}")
    except Exception as e:
        print(f"createUser - Error extracting user_id: {e}")
        return create_error_response(401, "Unauthorized: failed to extract user_id")

    # まず既存ユーザーをチェック
    user_service = UserService()
    existing_user = user_service.get_user_by_user_id(auth0_user_id)
    if existing_user:
        return create_error_response(409, "このアカウントは既に登録されています。")

    # Pydanticモデルでリクエストボディをバリデーション
    try:
        # 確定情報: フロントエンドでの二重JSON.stringify()を防ぐため
        # event["body"]の型をチェックし、適切にパースする
        raw_body = event.get("body", "{}")
        print(f"createUser - raw_body type: {type(raw_body)}")
        print(f"createUser - raw_body: {raw_body}")

        # 最初のJSONパース
        parsed_body = json.loads(raw_body)
        print(f"createUser - parsed_body type: {type(parsed_body)}")

        # 二重エンコーディングの場合、再度パースが必要
        if isinstance(parsed_body, str):
            print("createUser - Detected double JSON encoding, parsing again")
            body_data = json.loads(parsed_body)
        else:
            body_data = parsed_body

        print(f"createUser - final body_data type: {type(body_data)}")
        print(f"createUser - Request body: {body_data}")

        # Auth0情報からDiscord情報を抽出
        auth0_profile_data = body_data.get("auth0_profile", {})
        print(f"createUser - auth0_profile type: {type(auth0_profile_data)}")
        print(f"createUser - auth0_profile value: {auth0_profile_data}")

        discord_info = _extract_discord_info_from_auth0(auth0_profile_data)
        print(f"createUser - Extracted discord_info: {discord_info}")

        # Discord IDを抽出（Auth0のsubからDiscord IDを取得）
        discord_id = _extract_discord_id_from_user_id(auth0_user_id)
        print(f"createUser - Extracted discord_id: {discord_id} from auth0_user_id: {auth0_user_id}")

        if not discord_id:
            print(f"createUser - Discord ID extraction failed. Auth0 sub: {auth0_user_id}")
            return create_error_response(400, f"Discord IDを取得できませんでした。Auth0 sub: {auth0_user_id}")

        # UserCreateRequestに変換
        create_request = UserCreateRequest(
            discord_username=discord_info["discord_username"],
            discord_discriminator=discord_info.get("discord_discriminator"),
            discord_avatar_url=discord_info.get("discord_avatar_url"),
            trainer_name=body_data.get("trainer_name") or discord_info["discord_username"],
        )
        print(f"createUser - UserCreateRequest: {create_request}")
    except ValueError as e:
        print(f"createUser - ValueError: {e}")
        return create_error_response(400, str(e))
    except Exception as e:
        print(f"createUser - Unexpected error during user creation: {e}")
        print(f"createUser - Error type: {type(e).__name__}")
        print(f"createUser - Traceback: {traceback.format_exc()}")
        return create_error_response(500, f"Internal server error: {str(e)}")

    # Discord IDを既存ユーザーでチェック
    existing_discord_user = user_service.get_user_by_user_id(discord_id)
    if existing_discord_user:
        return create_error_response(409, "このDiscordアカウントは既に別のユーザーで登録されています。")

    try:
        # UserServiceを使用してユーザーを作成
        print(
            f"createUser - Calling UserService.create_user with discord_id: {discord_id}, auth0_user_id: {auth0_user_id}"
        )
        user = user_service.create_user(discord_id, create_request)

        if not user:
            return create_error_response(500, "ユーザー作成に失敗しました。")

        print(f"createUser - User created successfully: {user}")
        response_data = user.model_dump()
        response_data["win_rate"] = user.win_rate
        return create_success_response(response_data, 201)
    except Exception as e:
        print(f"createUser - Error in UserService.create_user: {e}")
        print(f"createUser - Error type: {type(e).__name__}")
        print(f"createUser - Traceback: {traceback.format_exc()}")
        return create_error_response(500, f"ユーザー作成エラー: {str(e)}")


def _extract_discord_id_from_user_id(user_id: str) -> str | None:
    """user_idからDiscord IDを抽出.

    user_idは 'discord|{discord_id}' または 'oauth2|discord|{discord_id}' の形式
    非Discord認証の場合はNoneを返す

    Args:
        user_id (str): user_idフィールド

    Returns:
        str | None: Discord ID、抽出できない場合またはDiscord認証でない場合はNone

    """
    if not user_id:
        return None

    print(f"_extract_discord_id_from_user_id - Input user_id: {user_id}")

    # 'oauth2|discord|' プレフィックスを確認して除去
    if user_id.startswith("oauth2|discord|"):
        discord_id = user_id[15:]  # 'oauth2|discord|' の15文字を除去
        print(f"_extract_discord_id_from_user_id - Extracted from oauth2|discord|: {discord_id}")
        return discord_id

    # 'discord|' プレフィックスを確認して除去
    if user_id.startswith("discord|"):
        discord_id = user_id[8:]  # 'discord|' の8文字を除去
        print(f"_extract_discord_id_from_user_id - Extracted from discord|: {discord_id}")
        return discord_id

    # プレフィックスがない場合でも、数値のIDであれば受け入れる（Discord IDの可能性）
    if user_id.isdigit():
        print(f"_extract_discord_id_from_user_id - Using raw numeric ID: {user_id}")
        return user_id

    # その他の認証プロバイダー（Google, GitHub等）の場合はNoneを返す
    print(f"_extract_discord_id_from_user_id - Non-Discord authentication detected: {user_id}")
    return None


def _extract_discord_info_from_auth0(auth0_profile_info: dict | str | None) -> dict:
    """Extract Discord related information from Auth0 user profile information.

    This function assumes auth0_profile_info could be from id_token claims or
    the /userinfo endpoint. Auth0's 'nickname' might be Discord's
    username#discriminator. 'picture' is expected to be the Discord avatar URL.
    The accuracy of this function depends heavily on Auth0 IdP connection and rule settings.

    Args:
        auth0_profile_info (dict | str | None): Auth0プロファイル情報.

    Returns:
        dict: 抽出されたDiscord情報.

    """
    print(f"_extract_discord_info_from_auth0 - Input type: {type(auth0_profile_info)}")
    print(f"_extract_discord_info_from_auth0 - Input data: {json.dumps(auth0_profile_info, default=str)}")

    # 防御的プログラミング: 型チェックと変換
    if auth0_profile_info is None:
        auth0_profile_info = {}
    elif isinstance(auth0_profile_info, str):
        # 文字列の場合は空の辞書として扱う（ログ用の情報として残す）
        print(f"_extract_discord_info_from_auth0 - Received string instead of dict: {auth0_profile_info}")
        auth0_profile_info = {}
    elif not isinstance(auth0_profile_info, dict):
        # その他の型の場合も空の辞書として扱う
        print(
            f"_extract_discord_info_from_auth0 - Received unexpected type {type(auth0_profile_info)}: {auth0_profile_info}"
        )
        auth0_profile_info = {}

    # Try to get username, discriminator, and avatar from common Auth0 fields.
    # These fields might be directly available or nested within 'identities' or custom claims.
    nickname = auth0_profile_info.get("nickname", "")  # Often holds username#discriminator for Discord
    name = auth0_profile_info.get("name", "")  # Can be a fallback
    picture = auth0_profile_info.get("picture", "")  # Usually the avatar

    print(
        f"_extract_discord_info_from_auth0 - Extracted values: nickname='{nickname}', name='{name}', picture='{picture}'"
    )

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


def update_profile(event: dict, _context: object) -> dict:
    """ユーザープロフィール更新(認証済み前提).

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 更新されたユーザー情報またはエラーレスポンス.

    """
    # オーソライザーから渡されたユーザー情報 (HTTP API形式)
    print(f"updateProfile - Full event: {json.dumps(event, default=str)}")
    print(
        f"updateProfile - Authorizer context: {json.dumps(event.get('requestContext', {}).get('authorizer', {}), default=str)}"
    )

    try:
        # HTTP API形式のオーソライザーコンテキストから取得
        # 重要: enableSimpleResponses: true の場合、コンテキストは lambda キーの下にネストされる
        request_context = event.get("requestContext", {})
        authorizer = request_context.get("authorizer", {})

        # lambdaキーの下のコンテキストを取得
        lambda_context = authorizer.get("lambda", {})
        auth0_user_id = lambda_context.get("user_id")

        print(f"getMe - Full lambda_context: {json.dumps(lambda_context, default=str)}")

        if not auth0_user_id:
            print(f"updateProfile - user_id not found in authorizer context: {authorizer}")
            return create_error_response(401, "Unauthorized: user_id not found in authorizer context")

        print(f"updateProfile - Using user_id: {auth0_user_id}")
    except Exception as e:
        print(f"updateProfile - Error extracting user_id: {e}")
        return create_error_response(401, "Unauthorized: failed to extract user_id")

    # UserServiceを使用して現在のユーザーを取得
    user_service = UserService()

    # Auth0 IDからDiscord IDを抽出
    if auth0_user_id.startswith("dummy|discord|"):
        # ダミーユーザーの場合
        actual_user_id = auth0_user_id.split("|")[-1]  # "dummy_user_X" を抽出
        print(f"updateProfile - Detected dummy user, looking up by user_id: {actual_user_id}")
    else:
        # 通常のAuth0ユーザーの場合：常にDiscord IDで検索
        actual_user_id = auth0_user_id.split("|")[-1] if "|" in auth0_user_id else auth0_user_id
        print(f"updateProfile - Extracted Discord ID from user_id: {actual_user_id}")

    # Discord IDで直接検索
    user = user_service.get_user_by_user_id(actual_user_id)

    print(f"updateProfile - Found user: {user}")

    if not user:
        print(f"updateProfile - User not found in database for user_id: {auth0_user_id}")
        return create_error_response(404, "User not found")

    # Pydanticモデルでリクエストボディをバリデーション
    try:
        body_data = json.loads(event["body"])
        print(f"updateProfile - Request body: {body_data}")
        update_request = UserUpdateRequest(**body_data)
        print(f"updateProfile - Parsed request: {update_request}")
    except ValueError as e:
        print(f"updateProfile - Request validation error: {e}")
        return create_error_response(400, str(e))

    # UserServiceを使用してプロフィールを更新
    print(f"updateProfile - Calling update_profile with user_id: {user.user_id}")
    updated_user = user_service.update_profile(user.user_id, update_request)
    print(f"updateProfile - Update result: {updated_user}")

    if not updated_user:
        return create_error_response(500, "Failed to update profile")

    return create_success_response(updated_user.model_dump())


def update_discord_info(event: dict, _context: object) -> dict:
    """Discord情報をAuth0プロファイルから更新."""
    print(f"updateDiscordInfo - Full event: {json.dumps(event, default=str)}")

    try:
        # HTTP API形式のオーソライザーコンテキストから取得
        request_context = event.get("requestContext", {})
        authorizer = request_context.get("authorizer", {})
        lambda_context = authorizer.get("lambda", {})
        auth0_user_id = lambda_context.get("user_id")

        print(f"updateDiscordInfo - Full lambda_context: {json.dumps(lambda_context, default=str)}")

        if not auth0_user_id:
            return create_error_response(401, "Unauthorized: user_id not found in authorizer context")

        print(f"updateDiscordInfo - Using user_id: {auth0_user_id}")
    except Exception as e:
        print(f"updateDiscordInfo - Error extracting user_id: {e}")
        return create_error_response(401, "Unauthorized: failed to extract user_id")

    # UserServiceを使用して現在のユーザーを取得
    user_service = UserService()

    # Auth0 IDからDiscord IDを抽出
    if auth0_user_id.startswith("dummy|discord|"):
        # ダミーユーザーの場合
        actual_user_id = auth0_user_id.split("|")[-1]
        print(f"updateDiscordInfo - Detected dummy user, looking up by user_id: {actual_user_id}")
    else:
        # 通常のAuth0ユーザーの場合：常にDiscord IDで検索
        actual_user_id = auth0_user_id.split("|")[-1] if "|" in auth0_user_id else auth0_user_id
        print(f"updateDiscordInfo - Extracted Discord ID from user_id: {actual_user_id}")

    # Discord IDで直接検索
    user = user_service.get_user_by_user_id(actual_user_id)

    if not user:
        return create_error_response(404, "User not found")

    # リクエストボディからAuth0プロファイル情報を取得
    try:
        body_data = json.loads(event["body"])
        auth0_profile = body_data.get("auth0_profile", {})
        print(f"updateDiscordInfo - Received Auth0 profile: {json.dumps(auth0_profile, default=str)}")

        # Discord情報を抽出
        discord_info = _extract_discord_info_from_auth0(auth0_profile)
        print(f"updateDiscordInfo - Extracted Discord info: {discord_info}")

        # ユーザー情報を更新
        updated = False
        if discord_info["discord_username"] and discord_info["discord_username"] != "Unknown User":
            user.discord_username = discord_info["discord_username"]
            updated = True
        if discord_info.get("discord_discriminator") is not None:
            user.discord_discriminator = discord_info.get("discord_discriminator")
            updated = True
        if discord_info.get("discord_avatar_url"):
            user.discord_avatar_url = discord_info.get("discord_avatar_url")
            updated = True

        if updated:
            print(f"updateDiscordInfo - Updating Discord info for: {user.user_id}")
            user.updated_at = int(__import__("time").time())
            if user_service.user_repository.update(user):
                print(f"updateDiscordInfo - Successfully updated Discord info")
                response_data = user.model_dump()
                response_data["win_rate"] = user.win_rate
                return create_success_response(response_data)
            else:
                print(f"updateDiscordInfo - Failed to update Discord info")
                return create_error_response(500, "Failed to update Discord info")
        else:
            print(f"updateDiscordInfo - No Discord info to update")
            response_data = user.model_dump()
            response_data["win_rate"] = user.win_rate
            return create_success_response(response_data)

    except Exception as e:
        print(f"updateDiscordInfo - Error: {e}")
        return create_error_response(500, f"Failed to update Discord info: {str(e)}")


def debug_auth_info(event: dict, _context: object) -> dict:
    """デバッグ用: Auth0から送信される情報を確認"""
    try:
        # オーソライザーから渡されたユーザー情報 (HTTP API形式)
        # enableSimpleResponses: true の場合、コンテキストは lambda キーの下にネストされる
        authorizer_context = event.get("requestContext", {}).get("authorizer", {})
        lambda_context = authorizer_context.get("lambda", {})
        auth0_user_id = lambda_context.get("user_id")

        print(f"debug_auth_info - Full authorizer context: {authorizer_context}")
        print(f"debug_auth_info - Extracted user_id: {auth0_user_id}")

        # リクエストボディ
        body_data = {}
        if event.get("body"):
            try:
                body_data = json.loads(event["body"])
            except:
                body_data = {"error": "Failed to parse body"}

        debug_info = {
            "auth0_user_id": auth0_user_id,
            "request_body": body_data,
            "full_event": {
                "requestContext": event.get("requestContext", {}),
                "headers": event.get("headers", {}),
                "body": event.get("body"),
            },
        }

        print(f"debug_auth_info - Full debug info: {json.dumps(debug_info, default=str, indent=2)}")

        return create_success_response(debug_info)
    except Exception as e:
        print(f"debug_auth_info - Error: {e}")
        return create_error_response(500, str(e))


def get_user(event: dict, _context: object) -> dict:
    """指定されたユーザーの情報を取得.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: ユーザー情報またはエラーレスポンス.

    """
    try:
        # パスパラメータからユーザーIDを取得
        user_id = event["pathParameters"]["userId"]

        # ユーザー情報を取得
        response = users_table.get_item(Key={"namespace": "default", "user_id": user_id})

        if "Item" not in response:
            return create_error_response(404, "User not found")

        user_item = response["Item"]

        # プライベートな情報を除外
        public_user_info = {
            "user_id": user_item.get("user_id"),
            "trainer_name": user_item.get("trainer_name"),
            "discord_username": user_item.get("discord_username"),
            "discord_avatar_url": user_item.get("discord_avatar_url"),
            "twitter_id": user_item.get("twitter_id"),
            "rate": user_item.get("rate", 1500),
            "max_rate": user_item.get("max_rate", 1500),
            "current_badge": user_item.get("current_badge"),
            "current_badge_2": user_item.get("current_badge_2"),
            "preferred_roles": user_item.get("preferred_roles", []),
            "favorite_pokemon": user_item.get("favorite_pokemon", []),
            "bio": user_item.get("bio", ""),
            "created_at": user_item.get("created_at"),
            "updated_at": user_item.get("updated_at"),
        }

        return create_success_response(public_user_info)

    except Exception as e:
        print(f"get_user error: {e}")
        return create_error_response(500, f"Failed to retrieve user information: {str(e)}")


def get_user_ranking(event: dict, _context: object) -> dict:
    """事前計算されたランキングデータを取得.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: ランキング情報またはエラーレスポンス.

    """
    try:
        print("get_user_ranking: Fetching pre-calculated rankings")

        # ランキングテーブルから事前計算されたデータを取得
        rankings_table = dynamodb.Table(os.environ.get("RANKINGS_TABLE_NAME", "unitemate-v2-rankings-dev"))

        # レートランキングを取得（rank順）
        response = rankings_table.query(
            KeyConditionExpression=Key("ranking_type").eq("rate"),
            ScanIndexForward=True,  # 昇順（rank 1から順に）
            Limit=100,
        )

        items = response.get("Items", [])
        print(f"get_user_ranking: Found {len(items)} rankings")

        # ランキングデータを整形（既にrank順になっている）
        rankings = []
        for item in items:
            ranking_data = {
                "rank": int(item.get("rank")),
                "user_id": item.get("user_id"),
                "trainer_name": item.get("trainer_name"),
                "rate": int(item.get("rate", 1500)),
                "best_rate": int(item.get("best_rate", 1500)),
                "win_rate": float(item.get("win_rate", 0)),
                "win_count": int(item.get("win_count", 0)),
                "discord_username": item.get("discord_username"),
                "discord_avatar_url": item.get("discord_avatar_url"),
                "twitter_id": item.get("twitter_id"),
                "current_badge": item.get("current_badge"),
                "current_badge_2": item.get("current_badge_2"),
            }
            rankings.append(ranking_data)

        # 最終更新時刻を取得（最初のアイテムから）
        updated_at = items[0].get("updated_at") if items else None

        return create_success_response({"rankings": rankings, "total_count": len(rankings), "updated_at": updated_at})

    except Exception as e:
        print(f"get_user_ranking error: {e}")
        # フォールバック: ランキングテーブルにデータがない場合は空のランキングを返す
        return create_success_response(
            {
                "rankings": [],
                "total_count": 0,
                "message": "Rankings are being calculated. Please check back in a few minutes.",
            }
        )
