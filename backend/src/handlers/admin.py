"""管理者機能のAPIハンドラー"""

import json
import os
from datetime import datetime
from enum import Enum

import boto3
from pydantic import BaseModel, Field, ValidationError

from src.repositories.user_repository import UserRepository
from src.services.penalty_service import PenaltyService
from src.utils.response import create_error_response, create_success_response

# DynamoDB設定
dynamodb = boto3.resource("dynamodb")
users_table = dynamodb.Table(os.environ["USERS_TABLE_NAME"])


class SearchType(str, Enum):
    """検索タイプの定義"""

    ALL = "all"
    DISCORD_NAME = "discord_name"
    TRAINER_NAME = "trainer_name"


class UserSearchRequest(BaseModel):
    """ユーザー検索リクエスト"""

    query: str = Field(..., description="検索クエリ（Discord名、トレーナー名など）")
    search_type: SearchType = Field(default=SearchType.ALL, description="検索タイプ（discord_name, trainer_name, all）")
    limit: int = Field(default=20, description="検索結果の上限")


class UpdateUserRequest(BaseModel):
    """ユーザー情報更新リクエスト"""

    rate: int | None = Field(None, description="レート")
    penalty_count: int | None = Field(None, description="累積ペナルティ数")
    penalty_correction: int | None = Field(None, description="ペナルティ軽減数")
    is_banned: bool | None = Field(None, description="アカウント凍結フラグ")
    owned_badges: list[str] | None = Field(None, description="所持勲章リスト")
    current_badge: str | None = Field(None, description="現在の勲章")
    current_badge_2: str | None = Field(None, description="2つ目の勲章")
    admin_notes: str | None = Field(None, description="管理者メモ")


def check_admin_permission(event: dict) -> tuple[bool, str | None]:
    """
    管理者権限をチェック

    Args:
        event: Lambda event

    Returns:
        tuple[bool, str | None]: (権限があるか, エラーメッセージ)

    """
    try:
        print(f"DEBUG: check_admin_permission - event requestContext: {event.get('requestContext', {})}")

        # 認証情報を取得
        auth0_user_id = event["requestContext"]["authorizer"]["lambda"]["user_id"]
        print(f"DEBUG: check_admin_permission - auth0_user_id: {auth0_user_id}")

        # Auth0 user_idからDiscord IDを抽出
        if "|" in auth0_user_id:
            user_id = auth0_user_id.split("|")[-1]
        else:
            user_id = auth0_user_id
        print(f"DEBUG: check_admin_permission - extracted user_id: {user_id}")

        # ユーザー情報を取得
        user_repo = UserRepository()
        user = user_repo.get_by_user_id(user_id)
        print(f"DEBUG: check_admin_permission - user found: {user is not None}")

        if not user:
            return False, "ユーザーが見つかりません"

        print(f"DEBUG: check_admin_permission - user.is_admin: {user.is_admin}")
        if not user.is_admin:
            return False, "管理者権限がありません"

        return True, None

    except Exception as e:
        print(f"check_admin_permission error: {e}")
        import traceback

        print(f"check_admin_permission traceback: {traceback.format_exc()}")
        return False, f"権限チェックエラー: {e!s}"


def search_users(event: dict, _context: object) -> dict:
    """
    ユーザー検索
    POST /api/admin/users/search エンドポイントで呼び出される
    """
    # デバッグ用ログ（イベント全体は大きすぎるので、必要な部分のみ）
    print(f"DEBUG: search_users called")
    print(f"DEBUG: HTTP method: {event.get('httpMethod', 'N/A')}")
    print(f"DEBUG: Request body: {event.get('body', 'N/A')}")
    print(f"DEBUG: Headers: {event.get('headers', {})}")

    # 管理者権限チェック
    has_permission, error_msg = check_admin_permission(event)
    if not has_permission:
        print(f"DEBUG: Permission check failed: {error_msg}")
        return create_error_response(403, error_msg)

    try:
        # リクエストボディを解析
        body_data = json.loads(event.get("body", "{}"))
        print(f"DEBUG: Parsed body data: {body_data}")
        request_data = UserSearchRequest(**body_data)
        print(f"DEBUG: Validated request data: {request_data}")

    except ValidationError as e:
        print(f"DEBUG: Validation error: {e}")
        return create_error_response(422, f"Validation error: {e}")
    except Exception as e:
        print(f"DEBUG: Request parsing error: {e}")
        return create_error_response(400, f"Invalid request: {e}")

    try:
        user_repo = UserRepository()
        penalty_service = PenaltyService()

        # 検索実行
        if request_data.search_type == SearchType.DISCORD_NAME:
            # Discord名での検索（部分一致）
            users = search_users_by_discord_name(request_data.query, request_data.limit)
        elif request_data.search_type == SearchType.TRAINER_NAME:
            # トレーナー名での検索（部分一致）
            users = search_users_by_trainer_name(request_data.query, request_data.limit)
        else:
            # 全体検索（discord_name部分一致 or trainer_name部分一致）
            users_by_discord = search_users_by_discord_name(request_data.query, request_data.limit)
            users_by_trainer = search_users_by_trainer_name(request_data.query, request_data.limit)

            # 重複を除去してマージ
            users = []
            seen_user_ids = set()

            # Discord名検索結果を追加
            for user in users_by_discord:
                if user.user_id not in seen_user_ids:
                    users.append(user)
                    seen_user_ids.add(user.user_id)

            # トレーナー名検索結果を追加
            for user in users_by_trainer:
                if user.user_id not in seen_user_ids:
                    users.append(user)
                    seen_user_ids.add(user.user_id)

        # レスポンス用にデータを整形
        result_users = []
        for user in users[: request_data.limit]:
            penalty_status = penalty_service.get_penalty_status(user.user_id)

            user_data = {
                "user_id": user.user_id,
                "auth0_sub": user.auth0_sub,
                "discord_username": user.discord_username,
                "trainer_name": user.trainer_name,
                "rate": user.rate,
                "max_rate": user.max_rate,
                "match_count": user.match_count,
                "win_count": user.win_count,
                "win_rate": user.win_rate,
                "penalty_count": user.penalty_count,
                "penalty_correction": user.penalty_correction,
                "effective_penalty": user.effective_penalty,
                "last_penalty_time": user.last_penalty_time,
                "penalty_timeout_until": user.penalty_timeout_until,
                "is_admin": user.is_admin,
                "is_banned": user.is_banned,
                "owned_badges": user.owned_badges,
                "current_badge": user.current_badge,
                "current_badge_2": user.current_badge_2,
                "created_at": user.created_at,
                "updated_at": user.updated_at,
                "penalty_status": penalty_status,
            }
            result_users.append(user_data)

        return create_success_response(
            {
                "users": result_users,
                "total_found": len(result_users),
                "search_query": request_data.query,
                "search_type": request_data.search_type,
            }
        )

    except Exception as e:
        print(f"search_users error: {e}")
        return create_error_response(500, f"Failed to search users: {e!s}")


def search_users_by_discord_name(query: str, limit: int) -> list:
    """
    Discord名での部分一致検索

    Args:
        query: 検索クエリ
        limit: 上限数

    Returns:
        List: ユーザーリスト

    """
    try:
        # DynamoDBで部分一致検索を行う（スキャン）
        response = users_table.scan(
            FilterExpression="contains(discord_username, :query)",
            ExpressionAttributeValues={":query": query},
            Limit=limit,
        )

        user_repo = UserRepository()
        users = []

        for item in response.get("Items", []):
            # UserRepositoryを使って正しいモデルに変換
            user = user_repo.get_by_user_id(item["user_id"])
            if user:
                users.append(user)

        return users

    except Exception as e:
        print(f"search_users_by_discord_name error: {e}")
        return []


def search_users_by_trainer_name(query: str, limit: int) -> list:
    """
    トレーナー名での部分一致検索

    Args:
        query: 検索クエリ
        limit: 上限数

    Returns:
        List: ユーザーリスト

    """
    try:
        # DynamoDBで部分一致検索を行う（スキャン）
        response = users_table.scan(
            FilterExpression="contains(trainer_name, :query)", ExpressionAttributeValues={":query": query}, Limit=limit
        )

        user_repo = UserRepository()
        users = []

        for item in response.get("Items", []):
            # UserRepositoryを使って正しいモデルに変換
            user = user_repo.get_by_user_id(item["user_id"])
            if user:
                users.append(user)

        return users

    except Exception as e:
        print(f"search_users_by_trainer_name error: {e}")
        return []


def get_user_details(event: dict, _context: object) -> dict:
    """
    ユーザー詳細情報取得
    GET /api/admin/users/{user_id} エンドポイントで呼び出される
    """
    # 管理者権限チェック
    has_permission, error_msg = check_admin_permission(event)
    if not has_permission:
        return create_error_response(403, error_msg)

    try:
        # パスパラメータからユーザーIDを取得
        target_user_id = event["pathParameters"]["user_id"]

        user_repo = UserRepository()
        penalty_service = PenaltyService()

        # ユーザー情報を取得
        user = user_repo.get_by_user_id(target_user_id)
        if not user:
            return create_error_response(404, "ユーザーが見つかりません")

        # ペナルティ状況を取得
        penalty_status = penalty_service.get_penalty_status(target_user_id)

        # 詳細情報を整形
        user_details = {
            "user_id": user.user_id,
            "auth0_sub": user.auth0_sub,
            "discord_username": user.discord_username,
            "discord_discriminator": user.discord_discriminator,
            "discord_avatar_url": user.discord_avatar_url,
            "trainer_name": user.trainer_name,
            "twitter_id": user.twitter_id,
            "preferred_roles": user.preferred_roles,
            "favorite_pokemon": user.favorite_pokemon,
            "bio": user.bio,
            "rate": user.rate,
            "max_rate": user.max_rate,
            "match_count": user.match_count,
            "win_count": user.win_count,
            "win_rate": user.win_rate,
            "penalty_count": user.penalty_count,
            "penalty_correction": user.penalty_correction,
            "effective_penalty": user.effective_penalty,
            "last_penalty_time": user.last_penalty_time,
            "penalty_timeout_until": user.penalty_timeout_until,
            "is_admin": user.is_admin,
            "is_banned": user.is_banned,
            "owned_badges": user.owned_badges,
            "current_badge": user.current_badge,
            "current_badge_2": user.current_badge_2,
            "assigned_match_id": user.assigned_match_id,
            "created_at": user.created_at,
            "updated_at": user.updated_at,
            "penalty_status": penalty_status,
        }

        return create_success_response(user_details)

    except Exception as e:
        print(f"get_user_details error: {e}")
        return create_error_response(500, f"Failed to get user details: {e!s}")


def update_user(event: dict, _context: object) -> dict:
    """
    ユーザー情報更新
    PUT /api/admin/users/{user_id} エンドポイントで呼び出される
    """
    # 管理者権限チェック
    has_permission, error_msg = check_admin_permission(event)
    if not has_permission:
        return create_error_response(403, error_msg)

    try:
        # パスパラメータからユーザーIDを取得
        target_user_id = event["pathParameters"]["user_id"]

        # リクエストボディを解析
        body_data = json.loads(event.get("body", "{}"))
        request_data = UpdateUserRequest(**body_data)

    except ValidationError as e:
        return create_error_response(422, f"Validation error: {e}")
    except Exception as e:
        return create_error_response(400, f"Invalid request: {e}")

    try:
        user_repo = UserRepository()

        # ユーザー情報を取得
        user = user_repo.get_by_user_id(target_user_id)
        if not user:
            return create_error_response(404, "ユーザーが見つかりません")

        # 更新フィールドを適用
        changes = []

        if request_data.rate is not None:
            old_rate = user.rate
            user.rate = request_data.rate
            user.max_rate = max(user.max_rate, user.rate)  # max_rateも更新
            changes.append(f"rate: {old_rate} -> {user.rate}")

        if request_data.penalty_count is not None:
            old_count = user.penalty_count
            user.penalty_count = request_data.penalty_count
            changes.append(f"penalty_count: {old_count} -> {user.penalty_count}")

        if request_data.penalty_correction is not None:
            old_correction = user.penalty_correction
            user.penalty_correction = request_data.penalty_correction
            changes.append(f"penalty_correction: {old_correction} -> {user.penalty_correction}")

        if request_data.is_banned is not None:
            old_banned = user.is_banned
            user.is_banned = request_data.is_banned
            changes.append(f"is_banned: {old_banned} -> {user.is_banned}")

        if request_data.owned_badges is not None:
            old_badges = user.owned_badges
            user.owned_badges = request_data.owned_badges
            changes.append(f"owned_badges: {old_badges} -> {user.owned_badges}")

        if request_data.current_badge is not None:
            old_badge = user.current_badge
            user.current_badge = request_data.current_badge
            changes.append(f"current_badge: {old_badge} -> {user.current_badge}")

        if request_data.current_badge_2 is not None:
            old_badge2 = user.current_badge_2
            user.current_badge_2 = request_data.current_badge_2
            changes.append(f"current_badge_2: {old_badge2} -> {user.current_badge_2}")

        # 更新日時を設定
        user.updated_at = int(datetime.now().timestamp())

        # データベースを更新
        success = user_repo.update(user)
        if not success:
            return create_error_response(500, "ユーザー情報の更新に失敗しました")

        # 操作ログを出力
        admin_user_id = event["requestContext"]["authorizer"]["lambda"]["user_id"]
        print(f"Admin operation: {admin_user_id} updated user {target_user_id}: {', '.join(changes)}")

        return create_success_response(
            {
                "message": "ユーザー情報を更新しました",
                "user_id": target_user_id,
                "changes": changes,
                "updated_at": user.updated_at,
            }
        )

    except Exception as e:
        print(f"update_user error: {e}")
        return create_error_response(500, f"Failed to update user: {e!s}")


def get_penalty_status(event: dict, _context: object) -> dict:
    """
    ユーザーのペナルティ状況取得
    GET /api/admin/users/{user_id}/penalty エンドポイントで呼び出される
    """
    # 管理者権限チェック
    has_permission, error_msg = check_admin_permission(event)
    if not has_permission:
        return create_error_response(403, error_msg)

    try:
        # パスパラメータからユーザーIDを取得
        target_user_id = event["pathParameters"]["user_id"]

        penalty_service = PenaltyService()
        penalty_status = penalty_service.get_penalty_status(target_user_id)

        if "error" in penalty_status:
            return create_error_response(404, penalty_status["error"])

        return create_success_response(penalty_status)

    except Exception as e:
        print(f"get_penalty_status error: {e}")
        return create_error_response(500, f"Failed to get penalty status: {e!s}")


def apply_penalty(event: dict, _context: object) -> dict:
    """
    ペナルティを手動で適用
    POST /api/admin/users/{user_id}/penalty エンドポイントで呼び出される
    """
    # 管理者権限チェック
    has_permission, error_msg = check_admin_permission(event)
    if not has_permission:
        return create_error_response(403, error_msg)

    try:
        # パスパラメータからユーザーIDを取得
        target_user_id = event["pathParameters"]["user_id"]

        # リクエストボディを解析
        body_data = json.loads(event.get("body", "{}"))
        reason = body_data.get("reason", "管理者による手動適用")

        penalty_service = PenaltyService()
        success = penalty_service.apply_penalty(target_user_id, reason)

        if not success:
            return create_error_response(500, "ペナルティの適用に失敗しました")

        # 操作ログを出力
        admin_user_id = event["requestContext"]["authorizer"]["lambda"]["user_id"]
        print(f"Admin operation: {admin_user_id} applied penalty to user {target_user_id}, reason: {reason}")

        # 更新後のペナルティ状況を取得
        penalty_status = penalty_service.get_penalty_status(target_user_id)

        return create_success_response(
            {
                "message": "ペナルティを適用しました",
                "user_id": target_user_id,
                "reason": reason,
                "penalty_status": penalty_status,
            }
        )

    except Exception as e:
        print(f"apply_penalty error: {e}")
        return create_error_response(500, f"Failed to apply penalty: {e!s}")
