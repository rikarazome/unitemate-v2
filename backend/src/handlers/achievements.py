"""Lambda handlers for achievement-related API endpoints."""

import json

from src.models.achievement import AchievementType, CreateAchievementRequest, UpdateAchievementRequest
from src.services.achievement_service import AchievementService
from src.utils.response import create_error_response, create_success_response


def get_all_achievements(event: dict, _context: object) -> dict:
    """全実績取得.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 実績一覧またはエラーレスポンス.

    """
    query_params = event.get("queryStringParameters") or {}
    include_inactive = query_params.get("include_inactive", "false").lower() == "true"

    achievement_service = AchievementService()
    achievements = achievement_service.get_all_achievements(include_inactive)

    return create_success_response([a.model_dump() for a in achievements])


def get_achievement(event: dict, _context: object) -> dict:
    """実績情報取得.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 実績情報またはエラーレスポンス.

    """
    achievement_id = event["pathParameters"]["achievementId"]

    achievement_service = AchievementService()
    achievement = achievement_service.get_achievement(achievement_id)

    if not achievement:
        return create_error_response(404, "Achievement not found")

    return create_success_response(achievement.model_dump())


def get_achievements_by_type(event: dict, _context: object) -> dict:
    """タイプ別実績取得.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 実績一覧またはエラーレスポンス.

    """
    achievement_type_str = event["pathParameters"]["type"].upper()

    try:
        achievement_type = AchievementType(achievement_type_str)
    except ValueError:
        return create_error_response(400, f"Invalid achievement type: {achievement_type_str}")

    achievement_service = AchievementService()
    achievements = achievement_service.get_achievements_by_type(achievement_type)

    return create_success_response([a.model_dump() for a in achievements])


def get_user_achievements(event: dict, _context: object) -> dict:
    """ユーザー実績取得(認証済み前提).

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: ユーザー実績一覧またはエラーレスポンス.

    """
    auth0_user_id = event["requestContext"]["authorizer"]["lambda"]["user_id"]
    query_params = event.get("queryStringParameters") or {}
    completed_only = query_params.get("completed_only", "false").lower() == "true"

    achievement_service = AchievementService()
    achievements = achievement_service.get_user_achievements(auth0_user_id, completed_only)

    return create_success_response([a.model_dump() for a in achievements])


def get_user_recent_achievements(event: dict, _context: object) -> dict:
    """ユーザーの最近獲得実績取得(認証済み前提).

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 最近の実績一覧またはエラーレスポンス.

    """
    auth0_user_id = event["requestContext"]["authorizer"]["lambda"]["user_id"]
    query_params = event.get("queryStringParameters") or {}
    limit = int(query_params.get("limit", "10"))

    achievement_service = AchievementService()
    achievements = achievement_service.get_recent_achievements(auth0_user_id, limit)

    return create_success_response([a.model_dump() for a in achievements])


def check_user_achievements(event: dict, _context: object) -> dict:
    """ユーザー実績の手動チェック(認証済み前提).

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 新規獲得実績一覧またはエラーレスポンス.

    """
    auth0_user_id = event["requestContext"]["authorizer"]["lambda"]["user_id"]

    achievement_service = AchievementService()
    newly_earned = achievement_service.check_and_update_achievements(auth0_user_id)

    return create_success_response({"newly_earned": [a.model_dump() for a in newly_earned], "count": len(newly_earned)})


def get_achievement_leaderboard(event: dict, _context: object) -> dict:
    """実績リーダーボード取得.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: リーダーボードまたはエラーレスポンス.

    """
    achievement_id = event["pathParameters"]["achievementId"]
    query_params = event.get("queryStringParameters") or {}
    limit = int(query_params.get("limit", "50"))

    achievement_service = AchievementService()
    leaderboard = achievement_service.get_leaderboard(achievement_id, limit)

    return create_success_response([entry.model_dump() for entry in leaderboard])


def get_achievement_stats(event: dict, _context: object) -> dict:
    """実績統計取得.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 実績統計またはエラーレスポンス.

    """
    achievement_id = event["pathParameters"]["achievementId"]

    achievement_service = AchievementService()
    stats = achievement_service.get_achievement_stats(achievement_id)

    return create_success_response(stats)


def create_achievement(event: dict, _context: object) -> dict:
    """実績作成（管理者用）.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 作成された実績情報またはエラーレスポンス.

    """
    try:
        body_data = json.loads(event["body"])
        request = CreateAchievementRequest(**body_data)
    except ValueError as e:
        return create_error_response(400, str(e))

    achievement_service = AchievementService()
    achievement = achievement_service.create_achievement(request)

    if not achievement:
        return create_error_response(409, "Achievement with this ID already exists")

    return create_success_response(achievement.model_dump(), 201)


def update_achievement(event: dict, _context: object) -> dict:
    """実績更新（管理者用）.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 更新された実績情報またはエラーレスポンス.

    """
    achievement_id = event["pathParameters"]["achievementId"]

    try:
        body_data = json.loads(event["body"])
        request = UpdateAchievementRequest(**body_data)
    except ValueError as e:
        return create_error_response(400, str(e))

    achievement_service = AchievementService()
    achievement = achievement_service.update_achievement(achievement_id, request)

    if not achievement:
        return create_error_response(404, "Achievement not found")

    return create_success_response(achievement.model_dump())
