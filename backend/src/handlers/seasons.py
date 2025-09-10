"""Lambda handlers for season management API endpoints."""

import json
from typing import TYPE_CHECKING, Any

from src.models.season import SeasonCreateRequest, SeasonUpdateRequest
from src.services.season_service import SeasonService
from src.utils.response import create_error_response, create_success_response

if TYPE_CHECKING:
    pass


def get_all_seasons(event: dict, _context: object) -> dict:
    """全シーズン取得.
    
    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.
        
    Returns:
        dict: シーズン一覧またはエラーレスポンス.
    """
    season_service = SeasonService()
    seasons = season_service.get_all_seasons()
    
    return create_success_response([season.model_dump() for season in seasons])


def get_season(event: dict, _context: object) -> dict:
    """シーズン詳細取得.
    
    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.
        
    Returns:
        dict: シーズンデータまたはエラーレスポンス.
    """
    season_id = event["pathParameters"]["seasonId"]
    
    season_service = SeasonService()
    season = season_service.get_season_by_id(season_id)
    
    if not season:
        return create_error_response(404, "シーズンが見つかりません")
    
    return create_success_response(season.model_dump())


def get_active_season(event: dict, _context: object) -> dict:
    """アクティブシーズン取得.
    
    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.
        
    Returns:
        dict: アクティブシーズンデータまたはエラーレスポンス.
    """
    season_service = SeasonService()
    active_season = season_service.get_active_season()
    next_season = season_service.get_next_season()
    
    response_data = {
        "current_season": active_season.model_dump() if active_season else None,
        "is_season_active": active_season is not None,
        "next_season": next_season.model_dump() if next_season else None,
    }
    
    return create_success_response(response_data)


def create_season(event: dict, _context: object) -> dict:
    """シーズン作成.
    
    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.
        
    Returns:
        dict: 作成結果またはエラーレスポンス.
    """
    try:
        body_data = json.loads(event.get("body", "{}"))
        create_request = SeasonCreateRequest(**body_data)
    except json.JSONDecodeError:
        return create_error_response(400, "無効なJSONフォーマットです")
    except Exception as e:
        return create_error_response(400, f"リクエストデータが無効です: {e}")
    
    season_service = SeasonService()
    success = season_service.create_season(create_request)
    
    if not success:
        return create_error_response(500, "シーズンの作成に失敗しました")
    
    return create_success_response({"message": "シーズンが作成されました", "season_id": create_request.id})


def update_season(event: dict, _context: object) -> dict:
    """シーズン更新.
    
    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.
        
    Returns:
        dict: 更新結果またはエラーレスポンス.
    """
    season_id = event["pathParameters"]["seasonId"]
    
    try:
        body_data = json.loads(event.get("body", "{}"))
        update_request = SeasonUpdateRequest(**body_data)
    except json.JSONDecodeError:
        return create_error_response(400, "無効なJSONフォーマットです")
    except Exception as e:
        return create_error_response(400, f"リクエストデータが無効です: {e}")
    
    season_service = SeasonService()
    success = season_service.update_season(season_id, update_request)
    
    if not success:
        return create_error_response(500, "シーズンの更新に失敗しました")
    
    return create_success_response({"message": "シーズンが更新されました", "season_id": season_id})


def delete_season(event: dict, _context: object) -> dict:
    """シーズン削除.
    
    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.
        
    Returns:
        dict: 削除結果またはエラーレスポンス.
    """
    season_id = event["pathParameters"]["seasonId"]
    
    season_service = SeasonService()
    success = season_service.delete_season(season_id)
    
    if not success:
        return create_error_response(500, "シーズンの削除に失敗しました")
    
    return create_success_response({"message": "シーズンが削除されました", "season_id": season_id})


def activate_season(event: dict, _context: object) -> dict:
    """シーズンアクティベート.
    
    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.
        
    Returns:
        dict: アクティベート結果またはエラーレスポンス.
    """
    season_id = event["pathParameters"]["seasonId"]
    
    season_service = SeasonService()
    success = season_service.activate_season(season_id)
    
    if not success:
        return create_error_response(500, "シーズンのアクティベートに失敗しました")
    
    return create_success_response({"message": "シーズンがアクティベートされました", "season_id": season_id})