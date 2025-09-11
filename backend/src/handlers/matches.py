"""Lambda handlers for match-related API endpoints."""

import json
import logging
import os
import traceback
import boto3
from botocore.exceptions import ClientError

from src.models.match import CreateMatchRequest, ReportMatchResultRequest
from src.services.match_service import MatchService
from src.utils.response import create_error_response, create_success_response

# DynamoDBクライアント
dynamodb = boto3.resource("dynamodb")

# 環境変数からテーブル名を取得
MATCHES_TABLE_NAME = os.environ["MATCHES_TABLE_NAME"]
USERS_TABLE_NAME = os.environ["USERS_TABLE_NAME"]
NAMESPACE = "default"

# テーブルオブジェクト
matches_table = dynamodb.Table(MATCHES_TABLE_NAME)
users_table = dynamodb.Table(USERS_TABLE_NAME)

# ロガー設定
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def get_match(event: dict, _context: object) -> dict:
    """マッチ情報取得.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: マッチ情報またはエラーレスポンス.

    """
    match_id = event["pathParameters"]["matchId"]

    match_service = MatchService()
    match = match_service.get_match_by_id(match_id)

    if not match:
        return create_error_response(404, "Match not found")

    return create_success_response(match.model_dump())


def get_recent_matches(event: dict, _context: object) -> dict:
    """最近のマッチ一覧取得.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: マッチ一覧またはエラーレスポンス.

    """
    query_params = event.get("queryStringParameters") or {}
    limit = int(query_params.get("limit", "50"))

    match_service = MatchService()
    matches = match_service.get_recent_matches(limit)

    return create_success_response([match.model_dump() for match in matches])


def get_user_matches(event: dict, _context: object) -> dict:
    """ユーザーのマッチ履歴取得.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: マッチ履歴またはエラーレスポンス.

    """
    user_id = event["pathParameters"]["userId"]
    query_params = event.get("queryStringParameters") or {}
    limit = int(query_params.get("limit", "50"))

    match_service = MatchService()
    matches = match_service.get_user_matches(user_id, limit)

    return create_success_response([match.model_dump() for match in matches])


def get_active_matches(event: dict, _context: object) -> dict:
    """アクティブなマッチ一覧取得.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: アクティブマッチ一覧またはエラーレスポンス.

    """
    match_service = MatchService()
    matches = match_service.get_active_matches()

    return create_success_response([match.model_dump() for match in matches])


def create_match(event: dict, _context: object) -> dict:
    """マッチ作成(管理者用).

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 作成されたマッチ情報またはエラーレスポンス.

    """
    try:
        body_data = json.loads(event["body"])
        create_request = CreateMatchRequest(**body_data)
    except ValueError as e:
        return create_error_response(400, str(e))

    match_service = MatchService()
    match = match_service.create_match(create_request)

    if not match:
        return create_error_response(500, "Failed to create match")

    return create_success_response(match.model_dump(), 201)


def start_match(event: dict, _context: object) -> dict:
    """マッチ開始.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 更新されたマッチ情報またはエラーレスポンス.

    """
    match_id = event["pathParameters"]["matchId"]

    match_service = MatchService()
    match = match_service.start_match(match_id)

    if not match:
        return create_error_response(404, "Match not found")

    return create_success_response(match.model_dump())


def report_match_result(event: dict, _context: object) -> dict:
    """マッチ結果報告(認証済み前提).

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 更新されたマッチ情報またはエラーレスポンス.

    """
    match_id = event["pathParameters"]["matchId"]
    auth0_user_id = event["requestContext"]["authorizer"]["lambda"]["user_id"]

    try:
        body_data = json.loads(event["body"])
        report_request = ReportMatchResultRequest(
            match_id=int(match_id), winner_team=body_data["winner_team"], reporter_user_id=auth0_user_id
        )
    except ValueError as e:
        return create_error_response(400, str(e))

    match_service = MatchService()
    match = match_service.report_match_result(match_id, report_request)

    if not match:
        return create_error_response(404, "Match not found or reporter not in match")

    return create_success_response(match.model_dump())


def cancel_match(event: dict, _context: object) -> dict:
    """マッチキャンセル(管理者用).

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 更新されたマッチ情報またはエラーレスポンス.

    """
    match_id = event["pathParameters"]["matchId"]

    match_service = MatchService()
    match = match_service.cancel_match(match_id)

    if not match:
        return create_error_response(404, "Match not found")

    return create_success_response(match.model_dump())


def add_penalty_player(event: dict, _context: object) -> dict:
    """ペナルティプレイヤー追加(管理者用).

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 更新されたマッチ情報またはエラーレスポンス.

    """
    match_id = event["pathParameters"]["matchId"]

    try:
        body_data = json.loads(event["body"])
        user_id = body_data["user_id"]
    except (ValueError, KeyError) as e:
        return create_error_response(400, str(e))

    match_service = MatchService()
    match = match_service.add_penalty_player(match_id, user_id)

    if not match:
        return create_error_response(404, "Match not found")

    return create_success_response(match.model_dump())


def get_current_match(event: dict, _context: object) -> dict:
    """現在のマッチ情報取得（Legacy準拠）.

    ユーザーのassigned_match_idから現在参加中のマッチ情報を取得し、
    フロントエンド用に整形して返す。

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 現在のマッチ情報またはエラーレスポンス.

    """
    try:
        # JWTからユーザーIDを取得
        auth0_user_id = event["requestContext"]["authorizer"]["lambda"]["user_id"]

        # Auth0 user_idからDiscord IDを抽出
        if "|" in auth0_user_id:
            user_id = auth0_user_id.split("|")[-1]
        else:
            user_id = auth0_user_id

        logger.info(f"getCurrentMatch: Getting match for user {auth0_user_id}, extracted user_id={user_id}")

        # ユーザー情報を取得してassigned_match_idを確認
        user_response = users_table.get_item(Key={"namespace": NAMESPACE, "user_id": user_id})

        if "Item" not in user_response:
            logger.error(f"getCurrentMatch: User {user_id} not found in users table")
            return create_error_response(404, "User not found")

        user_item = user_response["Item"]
        assigned_match_id = user_item.get("assigned_match_id")
        logger.info(f"getCurrentMatch: User {user_id} has assigned_match_id: {assigned_match_id}")

        if not assigned_match_id or assigned_match_id == 0:
            logger.info(f"getCurrentMatch: No assigned_match_id for user {user_id}")
            # 空のマッチデータを返す（200 OK）
            empty_match = {
                "match_id": "0",
                "team_a": {"players": []},
                "team_b": {"players": []},
                "status": "no_match",
                "started_at": "",
            }
            return create_success_response({"match": empty_match})

        # マッチ情報を取得
        match_response = matches_table.get_item(Key={"namespace": NAMESPACE, "match_id": int(assigned_match_id)})
        logger.info(f"getCurrentMatch: Looking for match {assigned_match_id} in matches table")

        if "Item" not in match_response:
            logger.error(f"getCurrentMatch: Match {assigned_match_id} not found in matches table")
            return create_error_response(404, "Match not found")

        match_item = match_response["Item"]
        logger.info(f"getCurrentMatch: Found match {assigned_match_id}, status: {match_item.get('status')}")

        # Legacy形式をフロントエンド形式に変換
        formatted_match = format_match_for_frontend(match_item)
        logger.info(f"getCurrentMatch: Successfully formatted match data")

        return create_success_response({"match": formatted_match})

    except ClientError as e:
        logger.error(f"Failed to get current match: {e}")
        return create_error_response(500, "Failed to retrieve match information")
    except Exception as e:
        logger.error(f"Unexpected error in get_current_match: {e}")
        return create_error_response(500, "Internal server error")


def update_lobby_id(event: dict, _context: object) -> dict:
    """ロビーID更新（Legacy準拠）.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 更新結果またはエラーレスポンス.

    """
    try:
        # JWTからユーザーIDを取得
        auth0_user_id = event["requestContext"]["authorizer"]["lambda"]["user_id"]

        # Auth0 user_idからDiscord IDを抽出
        if "|" in auth0_user_id:
            user_id = auth0_user_id.split("|")[-1]
        else:
            user_id = auth0_user_id

        # リクエストボディをパース
        body_data = json.loads(event["body"])
        lobby_id = body_data.get("lobby_id", "").strip()
        new_host_user_id = body_data.get("host_user_id")  # オプション：ホスト変更時のみ

        if not lobby_id:
            return create_error_response(400, "lobby_id is required")

        # ユーザー情報を取得してassigned_match_idを確認
        user_response = users_table.get_item(Key={"namespace": NAMESPACE, "user_id": user_id})

        if "Item" not in user_response:
            return create_error_response(404, "User not found")

        user_item = user_response["Item"]
        assigned_match_id = user_item.get("assigned_match_id")

        if not assigned_match_id:
            return create_error_response(404, "No assigned match found")

        # マッチ情報を取得
        match_response = matches_table.get_item(Key={"namespace": NAMESPACE, "match_id": int(assigned_match_id)})

        if "Item" not in match_response:
            return create_error_response(404, "Match not found")

        match_item = match_response["Item"]

        # ホスト権限チェックはフロントエンド側で制御するためバックエンドでは実施しない
        logger.info(f"updateLobbyId: Host permission check handled by frontend")

        # マッチデータを更新
        update_expression = "SET lobby_id = :lobby_id"
        expression_values = {":lobby_id": lobby_id}

        # ホスト変更がある場合のみhost_user_idを更新
        if new_host_user_id:
            update_expression += ", host_user_id = :host_user_id"
            expression_values[":host_user_id"] = new_host_user_id

        matches_table.update_item(
            Key={"namespace": NAMESPACE, "match_id": int(assigned_match_id)},
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expression_values,
        )

        logger.info(f"Lobby ID updated for match {assigned_match_id}: {lobby_id}")

        # WebSocket購読者に試合更新を通知
        try:
            logger.info(f"[LOBBY_UPDATE_DEBUG] About to import broadcast_match_update from websocket module")
            from .websocket import broadcast_match_update
            logger.info(f"[LOBBY_UPDATE_DEBUG] Successfully imported broadcast_match_update")
            logger.info(f"[LOBBY_UPDATE_DEBUG] About to call broadcast_match_update for match {assigned_match_id}")
            broadcast_match_update(str(assigned_match_id), "lobby_id_updated")
            logger.info(f"[LOBBY_UPDATE_DEBUG] Successfully called broadcast_match_update for match {assigned_match_id}")
        except ImportError as import_error:
            logger.error(f"[LOBBY_UPDATE_DEBUG] Import error: {import_error}")
            logger.error(f"[LOBBY_UPDATE_DEBUG] Import traceback: {traceback.format_exc()}")
        except Exception as ws_error:
            logger.error(f"[LOBBY_UPDATE_DEBUG] Failed to broadcast match update via WebSocket: {ws_error}")
            logger.error(f"[LOBBY_UPDATE_DEBUG] WebSocket broadcast traceback: {traceback.format_exc()}")

        return create_success_response(
            {"message": "Lobby ID updated successfully", "lobby_id": lobby_id, "match_id": int(assigned_match_id)}
        )

    except json.JSONDecodeError:
        return create_error_response(400, "Invalid JSON in request body")
    except ClientError as e:
        logger.error(f"Failed to update lobby ID: {e}")
        return create_error_response(500, "Failed to update lobby ID")
    except Exception as e:
        logger.error(f"Unexpected error in update_lobby_id: {e}")
        return create_error_response(500, "Internal server error")


def transfer_host(event: dict, _context: object) -> dict:
    """ホスト権限移譲（Legacy準拠）.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 移譲結果またはエラーレスポンス.

    """
    try:
        # JWTからユーザーIDを取得
        auth0_user_id = event["requestContext"]["authorizer"]["lambda"]["user_id"]

        # Auth0 user_idからDiscord IDを抽出
        if "|" in auth0_user_id:
            user_id = auth0_user_id.split("|")[-1]
        else:
            user_id = auth0_user_id

        # ユーザー情報を取得してassigned_match_idを確認
        user_response = users_table.get_item(Key={"namespace": NAMESPACE, "user_id": user_id})

        if "Item" not in user_response:
            return create_error_response(404, "User not found")

        user_item = user_response["Item"]
        assigned_match_id = user_item.get("assigned_match_id")

        if not assigned_match_id:
            return create_error_response(404, "No assigned match found")

        # マッチ情報を取得
        match_response = matches_table.get_item(Key={"namespace": NAMESPACE, "match_id": int(assigned_match_id)})

        if "Item" not in match_response:
            return create_error_response(404, "Match not found")

        match_item = match_response["Item"]

        # フロントエンド側でホスト権限チェックを行うため、バックエンドでは権限チェック不要
        # ホスト権限を「誰でも送信可能」モードに移行
        matches_table.update_item(
            Key={"namespace": NAMESPACE, "match_id": int(assigned_match_id)},
            UpdateExpression="SET host_user_id = :host_user_id",
            ExpressionAttributeValues={
                ":host_user_id": "#EVERYONE#"  # 特別な値で全員が送信可能な状態を示す
            },
        )

        logger.info(f"Host permissions transferred for match {assigned_match_id}: now everyone can send")

        # WebSocket購読者に試合更新を通知
        try:
            from .websocket import broadcast_match_update
            broadcast_match_update(str(assigned_match_id), "host_changed")
        except Exception as ws_error:
            logger.error(f"Failed to broadcast match update via WebSocket: {ws_error}")

        return create_success_response(
            {
                "message": "Host permissions transferred successfully",
                "match_id": int(assigned_match_id),
                "new_host": "everyone",  # 全員が送信可能になったことを示す
            }
        )

    except ClientError as e:
        logger.error(f"Failed to transfer host permissions: {e}")
        return create_error_response(500, "Failed to transfer host permissions")
    except Exception as e:
        logger.error(f"Unexpected error in transfer_host: {e}")
        return create_error_response(500, "Internal server error")


def format_match_for_frontend(match_item: dict) -> dict:
    """Legacy形式のマッチデータをフロントエンド形式に変換.

    Args:
        match_item: DynamoDBから取得したマッチデータ

    Returns:
        フロントエンド用に整形されたマッチデータ

    """
    try:
        # チームデータの変換
        team_a_data = []
        team_b_data = []

        # 新形式: オブジェクト配列
        for player_data in match_item.get("team_a", []):
            if isinstance(player_data, dict):
                # 新しいオブジェクト形式の場合
                player = {
                    "user_id": player_data.get("user_id"),
                    "trainer_name": player_data.get("trainer_name"),
                    "discord_username": player_data.get("discord_username"),
                    "discord_avatar_url": player_data.get("discord_avatar_url"),
                    "twitter_id": player_data.get("twitter_id"),
                    "rate": int(player_data.get("rate", 1500)),
                    "max_rate": int(player_data.get("best_rate", 1500)),
                    "current_badge": player_data.get("current_badge"),
                    "current_badge_2": player_data.get("current_badge_2"),
                    "role": player_data.get("role"),
                    "preferred_roles": player_data.get("preferred_roles", []),
                    "favorite_pokemon": player_data.get("favorite_pokemon", []),
                    "bio": player_data.get("bio", ""),
                }
                team_a_data.append(player)
            elif isinstance(player_data, list) and len(player_data) >= 4:
                # Legacy形式: [user_id, rate, best_rate, role] - フォールバック用
                user_id, rate, best_rate, role = player_data

                # ユーザー詳細情報を取得
                try:
                    user_response = users_table.get_item(Key={"namespace": NAMESPACE, "user_id": user_id})
                    user_info = user_response.get("Item", {})
                except:
                    user_info = {}

                player = {
                    "user_id": user_id,
                    "trainer_name": user_info.get("trainer_name", user_id),
                    "discord_username": user_info.get("discord_username"),
                    "discord_avatar_url": user_info.get("discord_avatar_url"),
                    "twitter_id": user_info.get("twitter_id"),
                    "rate": int(rate),
                    "max_rate": int(best_rate),
                    "current_badge": user_info.get("current_badge"),
                    "current_badge_2": user_info.get("current_badge_2"),
                    "role": role,
                    "preferred_roles": user_info.get("preferred_roles", []),
                    "favorite_pokemon": user_info.get("favorite_pokemon", []),
                    "bio": user_info.get("bio", ""),
                }
                team_a_data.append(player)

        for player_data in match_item.get("team_b", []):
            if isinstance(player_data, dict):
                # 新しいオブジェクト形式の場合
                player = {
                    "user_id": player_data.get("user_id"),
                    "trainer_name": player_data.get("trainer_name"),
                    "discord_username": player_data.get("discord_username"),
                    "discord_avatar_url": player_data.get("discord_avatar_url"),
                    "twitter_id": player_data.get("twitter_id"),
                    "rate": int(player_data.get("rate", 1500)),
                    "max_rate": int(player_data.get("best_rate", 1500)),
                    "current_badge": player_data.get("current_badge"),
                    "current_badge_2": player_data.get("current_badge_2"),
                    "role": player_data.get("role"),
                    "preferred_roles": player_data.get("preferred_roles", []),
                    "favorite_pokemon": player_data.get("favorite_pokemon", []),
                    "bio": player_data.get("bio", ""),
                }
                team_b_data.append(player)
            elif isinstance(player_data, list) and len(player_data) >= 4:
                # Legacy形式: [user_id, rate, best_rate, role] - フォールバック用
                user_id, rate, best_rate, role = player_data

                # ユーザー詳細情報を取得
                try:
                    user_response = users_table.get_item(Key={"namespace": NAMESPACE, "user_id": user_id})
                    user_info = user_response.get("Item", {})
                except:
                    user_info = {}

                player = {
                    "user_id": user_id,
                    "trainer_name": user_info.get("trainer_name", user_id),
                    "discord_username": user_info.get("discord_username"),
                    "discord_avatar_url": user_info.get("discord_avatar_url"),
                    "twitter_id": user_info.get("twitter_id"),
                    "rate": int(rate),
                    "max_rate": int(best_rate),
                    "current_badge": user_info.get("current_badge"),
                    "current_badge_2": user_info.get("current_badge_2"),
                    "role": role,
                    "preferred_roles": user_info.get("preferred_roles", []),
                    "favorite_pokemon": user_info.get("favorite_pokemon", []),
                    "bio": user_info.get("bio", ""),
                }
                team_b_data.append(player)

        # フロントエンド形式のマッチデータを構築
        formatted_match = {
            "match_id": str(match_item.get("match_id")),
            "team_a": {
                "team_id": "A",
                "team_name": "Team A",
                "is_first_attack": True,  # 固定値（Legacyでは先攻後攻の概念は少ない）
                "voice_channel": str(match_item.get("vc_a", "")),
                "players": team_a_data,
            },
            "team_b": {
                "team_id": "B",
                "team_name": "Team B",
                "is_first_attack": False,
                "voice_channel": str(match_item.get("vc_b", "")),
                "players": team_b_data,
            },
            "status": match_item.get("status", "unknown"),
            "started_at": match_item.get("matched_unixtime"),
            "matched_unixtime": match_item.get("matched_unixtime"),  # カウントダウンタイマー用
            "lobby_id": match_item.get("lobby_id"),
            "host_user_id": match_item.get("host_user_id"),
            "report_count": len(match_item.get("user_reports", [])),
        }

        return formatted_match

    except Exception as e:
        logger.error(f"Failed to format match data: {e}")
        # エラー時はデフォルト値を返す
        return {
            "match_id": str(match_item.get("match_id", "unknown")),
            "team_a": {"team_id": "A", "team_name": "Team A", "is_first_attack": True, "players": []},
            "team_b": {"team_id": "B", "team_name": "Team B", "is_first_attack": False, "players": []},
            "status": "unknown",
            "user_reports": [],
        }
