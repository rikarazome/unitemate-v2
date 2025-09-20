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

        if not auth0_user_id:
            print(f"[ERROR] getMe - user_id not found in authorizer context")
            return create_error_response(401, "Unauthorized: user_id not found in authorizer context")

    except Exception as e:
        print(f"[ERROR] getMe - Error extracting user_id: {e}")
        return create_error_response(401, "Unauthorized: failed to extract user_id")

    # UserServiceを使用して現在のユーザーを取得
    user_service = UserService()

    # Auth0 IDからDiscord IDを抽出
    if auth0_user_id.startswith("dummy|discord|"):
        # ダミーユーザーの場合
        actual_user_id = auth0_user_id.split("|")[-1]  # "dummy_user_X" を抽出
    else:
        # 通常のAuth0ユーザーの場合：常にDiscord IDで検索
        actual_user_id = auth0_user_id.split("|")[-1] if "|" in auth0_user_id else auth0_user_id

    # Discord IDで直接検索
    user = user_service.get_user_by_user_id(actual_user_id)

    if not user:

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
                response_data = auto_created_user.model_dump()
                response_data["win_rate"] = auto_created_user.win_rate
                return create_success_response(response_data)
            print(f"[ERROR] getMe - Failed to auto-create user for: {auth0_user_id}")
            return create_error_response(500, "Failed to create user automatically")

        except Exception as e:
            print(f"[ERROR] getMe - Error during auto-creation: {e}")
            return create_error_response(500, f"Failed to create user: {e!s}")

    # Discord情報の更新が必要な場合（プレースホルダーユーザー名の場合）
    # フロントエンドからIDトークンの情報を受け取る必要があるため、
    # ここでは更新は行わず、フロントエンド側でプロファイル更新を促す


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
    except Exception as e:
        print(f"[ERROR] getMe - Error fetching records: {e!s}")
        # レコード取得失敗時もユーザーデータは返す
        latest_matches = []

    # レスポンスに試合データを追加
    user_data["latest_matches"] = latest_matches

    # 2分間のキャッシュを設定（ユーザー情報は比較的安定）
    cache_control = "private, max-age=120, s-maxage=120"
    return create_success_response(user_data, cache_control=cache_control)


def create_user(event: dict, _context: object) -> dict:
    """新しいユーザーを作成(認証済み前提).

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 作成されたユーザー情報またはエラーレスポンス.

    """
    # オーソライザーから渡されたユーザー情報 (HTTP API形式)

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
            print(f"[ERROR] createUser - user_id not found in authorizer context")
            return create_error_response(401, "Unauthorized: user_id not found in authorizer context")

    except Exception as e:
        print(f"[ERROR] createUser - Error extracting user_id: {e}")
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

        # 最初のJSONパース
        parsed_body = json.loads(raw_body)

        # 二重エンコーディングの場合、再度パースが必要
        if isinstance(parsed_body, str):
            body_data = json.loads(parsed_body)
        else:
            body_data = parsed_body


        # Auth0情報からDiscord情報を抽出
        auth0_profile_data = body_data.get("auth0_profile", {})

        discord_info = _extract_discord_info_from_auth0(auth0_profile_data)

        # Discord IDを抽出（Auth0のsubからDiscord IDを取得）
        discord_id = _extract_discord_id_from_user_id(auth0_user_id)

        if not discord_id:
            print(f"[ERROR] createUser - Discord ID extraction failed. Auth0 sub: {auth0_user_id}")
            return create_error_response(400, f"Discord IDを取得できませんでした。Auth0 sub: {auth0_user_id}")

        # UserCreateRequestに変換
        create_request = UserCreateRequest(
            discord_username=discord_info["discord_username"],
            discord_discriminator=discord_info.get("discord_discriminator"),
            discord_avatar_url=discord_info.get("discord_avatar_url"),
            trainer_name=body_data.get("trainer_name") or discord_info["discord_username"],
        )
    except ValueError as e:
        print(f"[ERROR] createUser - ValueError: {e}")
        return create_error_response(400, str(e))
    except Exception as e:
        print(f"[ERROR] createUser - Unexpected error during user creation: {e}")
        return create_error_response(500, f"Internal server error: {e!s}")

    # Discord IDを既存ユーザーでチェック
    existing_discord_user = user_service.get_user_by_user_id(discord_id)
    if existing_discord_user:
        return create_error_response(409, "このDiscordアカウントは既に別のユーザーで登録されています。")

    try:
        # UserServiceを使用してユーザーを作成
        user = user_service.create_user(discord_id, create_request)

        if not user:
            return create_error_response(500, "ユーザー作成に失敗しました。")

        response_data = user.model_dump()
        response_data["win_rate"] = user.win_rate
        return create_success_response(response_data, 201)
    except Exception as e:
        print(f"[ERROR] createUser - Error in UserService.create_user: {e}")
        return create_error_response(500, f"ユーザー作成エラー: {e!s}")


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


    # 'oauth2|discord|' プレフィックスを確認して除去
    if user_id.startswith("oauth2|discord|"):
        discord_id = user_id[15:]  # 'oauth2|discord|' の15文字を除去
        return discord_id

    # 'discord|' プレフィックスを確認して除去
    if user_id.startswith("discord|"):
        discord_id = user_id[8:]  # 'discord|' の8文字を除去
        return discord_id

    # プレフィックスがない場合でも、数値のIDであれば受け入れる（Discord IDの可能性）
    if user_id.isdigit():
        return user_id

    # その他の認証プロバイダー（Google, GitHub等）の場合はNoneを返す
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

    # 防御的プログラミング: 型チェックと変換
    if auth0_profile_info is None:
        auth0_profile_info = {}
    elif isinstance(auth0_profile_info, str):
        # 文字列の場合は空の辞書として扱う
        auth0_profile_info = {}
    elif not isinstance(auth0_profile_info, dict):
        # その他の型の場合も空の辞書として扱う
        auth0_profile_info = {}

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


def update_profile(event: dict, _context: object) -> dict:
    """ユーザープロフィール更新(認証済み前提).

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 更新されたユーザー情報またはエラーレスポンス.

    """
    # オーソライザーから渡されたユーザー情報 (HTTP API形式)

    try:
        # HTTP API形式のオーソライザーコンテキストから取得
        # 重要: enableSimpleResponses: true の場合、コンテキストは lambda キーの下にネストされる
        request_context = event.get("requestContext", {})
        authorizer = request_context.get("authorizer", {})

        # lambdaキーの下のコンテキストを取得
        lambda_context = authorizer.get("lambda", {})
        auth0_user_id = lambda_context.get("user_id")

        if not auth0_user_id:
            print(f"[ERROR] updateProfile - user_id not found")
            return create_error_response(401, "Unauthorized: user_id not found in authorizer context")

    except Exception as e:
        print(f"[ERROR] updateProfile - Error extracting user_id: {e}")
        return create_error_response(401, "Unauthorized: failed to extract user_id")

    # UserServiceを使用して現在のユーザーを取得
    user_service = UserService()

    # Auth0 IDからDiscord IDを抽出
    if auth0_user_id.startswith("dummy|discord|"):
        # ダミーユーザーの場合
        actual_user_id = auth0_user_id.split("|")[-1]  # "dummy_user_X" を抽出
    else:
        # 通常のAuth0ユーザーの場合：常にDiscord IDで検索
        actual_user_id = auth0_user_id.split("|")[-1] if "|" in auth0_user_id else auth0_user_id

    # Discord IDで直接検索
    user = user_service.get_user_by_user_id(actual_user_id)

    if not user:
        print(f"[ERROR] updateProfile - User not found: {auth0_user_id}")
        return create_error_response(404, "User not found")

    # Pydanticモデルでリクエストボディをバリデーション
    try:
        body_data = json.loads(event["body"])
        update_request = UserUpdateRequest(**body_data)
    except ValueError as e:
        print(f"[ERROR] updateProfile - Request validation error: {e}")
        return create_error_response(400, str(e))

    # UserServiceを使用してプロフィールを更新
    updated_user = user_service.update_profile(user.user_id, update_request)

    if not updated_user:
        return create_error_response(500, "Failed to update profile")

    return create_success_response(updated_user.model_dump())


def update_discord_info(event: dict, _context: object) -> dict:
    """Discord情報をAuth0プロファイルから更新."""

    try:
        # HTTP API形式のオーソライザーコンテキストから取得
        request_context = event.get("requestContext", {})
        authorizer = request_context.get("authorizer", {})
        lambda_context = authorizer.get("lambda", {})
        auth0_user_id = lambda_context.get("user_id")


        if not auth0_user_id:
            return create_error_response(401, "Unauthorized: user_id not found in authorizer context")

    except Exception as e:
        print(f"[ERROR] updateDiscordInfo - Error extracting user_id: {e}")
        return create_error_response(401, "Unauthorized: failed to extract user_id")

    # UserServiceを使用して現在のユーザーを取得
    user_service = UserService()

    # Auth0 IDからDiscord IDを抽出
    if auth0_user_id.startswith("dummy|discord|"):
        # ダミーユーザーの場合
        actual_user_id = auth0_user_id.split("|")[-1]
    else:
        # 通常のAuth0ユーザーの場合：常にDiscord IDで検索
        actual_user_id = auth0_user_id.split("|")[-1] if "|" in auth0_user_id else auth0_user_id

    # Discord IDで直接検索
    user = user_service.get_user_by_user_id(actual_user_id)

    if not user:
        return create_error_response(404, "User not found")

    # リクエストボディからAuth0プロファイル情報を取得
    try:
        body_data = json.loads(event["body"])
        auth0_profile = body_data.get("auth0_profile", {})

        # Discord情報を抽出
        discord_info = _extract_discord_info_from_auth0(auth0_profile)

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
            user.updated_at = int(__import__("time").time())
            if user_service.user_repository.update(user):
                response_data = user.model_dump()
                response_data["win_rate"] = user.win_rate
                return create_success_response(response_data)
            print(f"[ERROR] updateDiscordInfo - Failed to update Discord info")
            return create_error_response(500, "Failed to update Discord info")
        response_data = user.model_dump()
        response_data["win_rate"] = user.win_rate
        return create_success_response(response_data)

    except Exception as e:
        print(f"[ERROR] updateDiscordInfo - Error: {e}")
        return create_error_response(500, f"Failed to update Discord info: {e!s}")


def debug_auth_info(event: dict, _context: object) -> dict:
    """デバッグ用: Auth0から送信される情報を確認"""
    try:
        # オーソライザーから渡されたユーザー情報 (HTTP API形式)
        # enableSimpleResponses: true の場合、コンテキストは lambda キーの下にネストされる
        authorizer_context = event.get("requestContext", {}).get("authorizer", {})
        lambda_context = authorizer_context.get("lambda", {})
        auth0_user_id = lambda_context.get("user_id")


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


        return create_success_response(debug_info)
    except Exception as e:
        print(f"[ERROR] debug_auth_info - Error: {e}")
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
        print(f"[ERROR] get_user error: {e}")
        return create_error_response(500, f"Failed to retrieve user information: {e!s}")


def get_user_ranking(event: dict, _context: object) -> dict:
    """事前計算されたランキングデータを取得.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: ランキング情報またはエラーレスポンス.

    """
    try:

        # ランキングテーブルから事前計算されたデータを取得
        rankings_table = dynamodb.Table(os.environ.get("RANKINGS_TABLE_NAME", "unitemate-v2-rankings-dev"))

        # レートランキングを取得（rank順）
        response = rankings_table.query(
            KeyConditionExpression=Key("ranking_type").eq("rate"),
            ScanIndexForward=True,  # 昇順（rank 1から順に）
            Limit=100,
        )

        items = response.get("Items", [])

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

        # 5分間のキャッシュを設定（ランキングは頻繁に更新される）
        cache_control = "public, max-age=300, s-maxage=300"
        return create_success_response({"rankings": rankings, "total_count": len(rankings), "updated_at": updated_at}, cache_control=cache_control)

    except Exception as e:
        print(f"[ERROR] get_user_ranking error: {e}")
        # フォールバック: ランキングテーブルにデータがない場合は空のランキングを返す
        return create_success_response(
            {
                "rankings": [],
                "total_count": 0,
                "message": "Rankings are being calculated. Please check back in a few minutes.",
            }
        )
