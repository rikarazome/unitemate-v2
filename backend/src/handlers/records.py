"""Lambda handlers for record-related API endpoints."""

from src.models.record import RecordSearchFilter
from src.services.record_service import RecordService
from src.utils.response import create_error_response, create_success_response


def get_user_records(event: dict, _context: object) -> dict:
    """認証済みユーザーの試合記録取得.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 試合記録一覧またはエラーレスポンス.

    """
    # オーソライザーから渡されたユーザー情報
    auth0_user_id = event["requestContext"]["authorizer"]["lambda"]["user_id"]

    # UserServiceを使用してuser_idを取得
    from src.services.user_service import UserService

    user_service = UserService()
    user = user_service.get_user_by_auth0_sub(auth0_user_id)

    if not user:
        return create_error_response(404, "User not found")

    query_params = event.get("queryStringParameters") or {}
    limit = int(query_params.get("limit", "50"))
    start_date = int(query_params["start_date"]) if query_params.get("start_date") else None
    end_date = int(query_params["end_date"]) if query_params.get("end_date") else None

    record_service = RecordService()

    try:
        if start_date and end_date:
            records = record_service.get_user_records_by_date_range(user.user_id, start_date, end_date, limit)
        else:
            records = record_service.get_user_records(user.user_id, limit)

        # フロントエンドが期待する形式に合わせる
        return create_success_response({"latest_matches": [record.model_dump() for record in records]})
    except Exception as e:
        return create_error_response(500, f"Failed to get user records: {str(e)}")


def get_match_records(event: dict, _context: object) -> dict:
    """マッチの全記録取得.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: マッチ記録一覧またはエラーレスポンス.

    """
    match_id = event["pathParameters"]["matchId"]

    record_service = RecordService()
    records = record_service.get_records_by_match_id(match_id)

    return create_success_response([record.model_dump() for record in records])


def search_records(event: dict, _context: object) -> dict:
    """記録検索.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 検索結果またはエラーレスポンス.

    """
    query_params = event.get("queryStringParameters") or {}

    try:
        search_filter = RecordSearchFilter(
            user_id=query_params.get("user_id"),
            pokemon=query_params.get("pokemon"),
            is_winner=query_params.get("is_winner") == "true" if query_params.get("is_winner") else None,
            start_date=int(query_params["start_date"]) if query_params.get("start_date") else None,
            end_date=int(query_params["end_date"]) if query_params.get("end_date") else None,
            limit=int(query_params.get("limit", "50")),
        )
    except ValueError as e:
        return create_error_response(400, str(e))

    record_service = RecordService()
    records = record_service.search_records(search_filter)

    return create_success_response([record.model_dump() for record in records])


def get_user_stats(event: dict, _context: object) -> dict:
    """ユーザー統計情報取得.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 統計情報またはエラーレスポンス.

    """
    user_id = event["pathParameters"]["userId"]
    query_params = event.get("queryStringParameters") or {}
    days = int(query_params.get("days", "30"))

    record_service = RecordService()
    stats = record_service.get_user_stats(user_id, days)

    return create_success_response(stats)


def get_user_pokemon_stats(event: dict, _context: object) -> dict:
    """ユーザーのポケモン別統計取得.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: ポケモン別統計またはエラーレスポンス.

    """
    user_id = event["pathParameters"]["userId"]
    query_params = event.get("queryStringParameters") or {}
    limit = int(query_params.get("limit", "100"))

    record_service = RecordService()
    pokemon_stats = record_service.get_pokemon_win_rates(user_id, limit)

    return create_success_response(pokemon_stats)


def get_user_recent_performance(event: dict, _context: object) -> dict:
    """ユーザーの最近のパフォーマンス取得.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 最近のパフォーマンスまたはエラーレスポンス.

    """
    user_id = event["pathParameters"]["userId"]
    query_params = event.get("queryStringParameters") or {}
    limit = int(query_params.get("limit", "10"))

    record_service = RecordService()
    performance = record_service.get_recent_performance(user_id, limit)

    return create_success_response(performance)
