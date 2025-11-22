"""Lambda handlers for season reset API endpoints."""

import json

from src.handlers.admin import check_admin_permission
from src.services.season_reset_service import SeasonResetService
from src.utils.response import create_error_response, create_success_response


def grant_badges(event: dict, _context: object) -> dict:
    """勲章付与実行（レートリセットなし）.

    処理フロー:
    1. 管理者権限を確認
    2. リクエストボディから season_id と badge_mapping を取得
    3. SeasonResetService.execute_badge_grant を使って全ユーザーに勲章付与
    4. 処理結果を返却

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 勲章付与結果またはエラーレスポンス.

    """
    # ステップ1: 管理者権限チェック
    has_permission, error_msg = check_admin_permission(event)
    if not has_permission:
        return create_error_response(403, error_msg)

    try:
        # ステップ2: リクエストボディからパラメータを取得
        body_data = json.loads(event.get("body", "{}"))
        season_id = body_data.get("season_id")
        badge_mapping = body_data.get("badge_mapping", {})

        if not season_id:
            return create_error_response(400, "season_idが必要です")

        # ステップ3: 勲章付与サービスを実行
        season_reset_service = SeasonResetService()
        result = season_reset_service.execute_badge_grant(season_id, badge_mapping)

        # ステップ4: 処理結果のチェックとレスポンス
        if "error" in result:
            return create_error_response(500, result["error"])

        # 操作ログ出力（監査目的）
        admin_user_id = event["requestContext"]["authorizer"]["lambda"]["user_id"]
        print(f"[INFO] Badge grant executed by admin: {admin_user_id}")
        print(f"[INFO] Badge grant result: {result}")

        # 成功レスポンスを返却
        return create_success_response({
            "message": f"シーズン {season_id} の勲章付与が完了しました",
            "result": result,
        })

    except json.JSONDecodeError:
        return create_error_response(400, "無効なJSONフォーマットです")
    except Exception as e:
        print(f"[ERROR] Badge grant failed: {e}")
        return create_error_response(500, f"勲章付与に失敗しました: {e!s}")


def reset_rates(event: dict, _context: object) -> dict:
    """レートリセット実行（レート・試合数リセット + レコード削除）.

    処理フロー:
    1. 管理者権限を確認
    2. リクエストボディから season_id を取得
    3. SeasonResetService.execute_rate_reset を使って全ユーザーのレートをリセット
    4. 全試合レコードを削除
    5. 処理結果を返却

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: レートリセット結果またはエラーレスポンス.

    """
    # ステップ1: 管理者権限チェック
    has_permission, error_msg = check_admin_permission(event)
    if not has_permission:
        return create_error_response(403, error_msg)

    try:
        # ステップ2: リクエストボディからパラメータを取得
        body_data = json.loads(event.get("body", "{}"))
        season_id = body_data.get("season_id")

        if not season_id:
            return create_error_response(400, "season_idが必要です")

        # ステップ3: レートリセットサービスを実行
        season_reset_service = SeasonResetService()
        result = season_reset_service.execute_rate_reset(season_id)

        # ステップ4: 処理結果のチェックとレスポンス
        if "error" in result:
            return create_error_response(500, result["error"])

        # 操作ログ出力（監査目的）
        admin_user_id = event["requestContext"]["authorizer"]["lambda"]["user_id"]
        print(f"[INFO] Rate reset executed by admin: {admin_user_id}")
        print(f"[INFO] Rate reset result: {result}")

        # 成功レスポンスを返却
        return create_success_response({
            "message": f"シーズン {season_id} のレートリセットが完了しました",
            "result": result,
        })

    except json.JSONDecodeError:
        return create_error_response(400, "無効なJSONフォーマットです")
    except Exception as e:
        print(f"[ERROR] Rate reset failed: {e}")
        return create_error_response(500, f"レートリセットに失敗しました: {e!s}")


def reset_season(event: dict, _context: object) -> dict:
    """シーズンリセット実行.

    処理フロー:
    1. 管理者権限を確認
    2. リクエストボディから season_id と badge_mapping を取得
    3. SeasonResetService を使って全ユーザーのリセット処理を実行
    4. 処理結果を返却

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: リセット結果またはエラーレスポンス.

    """
    # ステップ1: 管理者権限チェック
    has_permission, error_msg = check_admin_permission(event)
    if not has_permission:
        return create_error_response(403, error_msg)

    try:
        # ステップ2: リクエストボディからパラメータを取得
        body_data = json.loads(event.get("body", "{}"))
        season_id = body_data.get("season_id")  # リセット対象のシーズンID
        badge_mapping = body_data.get("badge_mapping", {})  # バッジマッピング設定

        if not season_id:
            return create_error_response(400, "season_idが必要です")

        # ステップ3: シーズンリセットサービスを実行
        # 全ユーザーの戦績を集計し、バッジ付与、データアーカイブ、統計リセットを行う
        season_reset_service = SeasonResetService()
        result = season_reset_service.execute_season_reset(season_id, badge_mapping)

        # ステップ4: 処理結果のチェックとレスポンス
        if "error" in result:
            return create_error_response(500, result["error"])

        # 操作ログ出力（監査目的）
        admin_user_id = event["requestContext"]["authorizer"]["lambda"]["user_id"]
        print(f"[INFO] Season reset executed by admin: {admin_user_id}")
        print(f"[INFO] Season reset result: {result}")

        # 成功レスポンスを返却
        return create_success_response({
            "message": f"シーズン {season_id} のリセットが完了しました",
            "result": result,
        })

    except json.JSONDecodeError:
        return create_error_response(400, "無効なJSONフォーマットです")
    except Exception as e:
        print(f"[ERROR] Season reset failed: {e}")
        return create_error_response(500, f"シーズンリセットに失敗しました: {e!s}")
