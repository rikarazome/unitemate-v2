"""Lambda handlers for admin match management API endpoints."""

import json
import logging
import os
import time
import boto3
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError
from decimal import Decimal

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


def decimal_to_json_serializable(obj):
    """DynamoDBのDecimal型をJSON serializable型に変換"""
    if isinstance(obj, Decimal):
        if obj % 1 == 0:
            return int(obj)
        else:
            return float(obj)
    elif isinstance(obj, list):
        return [decimal_to_json_serializable(item) for item in obj]
    elif isinstance(obj, dict):
        return {k: decimal_to_json_serializable(v) for k, v in obj.items()}
    return obj


def check_admin_auth(event: dict) -> tuple[bool, str]:
    """管理者権限をチェック"""
    try:
        auth0_user_id = event["requestContext"]["authorizer"]["lambda"]["user_id"]

        # Auth0 user_idからDiscord IDを抽出
        if "|" in auth0_user_id:
            user_id = auth0_user_id.split("|")[-1]
        else:
            user_id = auth0_user_id

        # ユーザー情報を取得
        user_response = users_table.get_item(Key={"namespace": NAMESPACE, "user_id": user_id})

        if "Item" not in user_response:
            return False, "User not found"

        user_item = user_response["Item"]
        if not user_item.get("is_admin", False):
            return False, "Admin access required"

        return True, user_id

    except Exception as e:
        logger.error(f"Admin auth check failed: {e}")
        return False, str(e)


def get_admin_matches(event: dict, _context: object) -> dict:
    """管理者用試合一覧取得.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 試合一覧またはエラーレスポンス.

    """
    # 管理者権限チェック
    is_admin, result = check_admin_auth(event)
    if not is_admin:
        return create_error_response(403, result)

    try:
        # クエリパラメータ取得
        query_params = event.get("queryStringParameters") or {}
        status_filter = query_params.get("status", "all")
        limit = int(query_params.get("limit", "50"))

        # 全試合を取得（status_indexを使用）
        scan_params = {"Limit": limit}

        # ステータスフィルター
        if status_filter != "all":
            scan_params["FilterExpression"] = Attr("status").eq(status_filter)

        response = matches_table.scan(**scan_params)

        matches = []
        for item in response.get("Items", []):
            # 結果報告数をカウント
            user_reports = item.get("user_reports", [])
            report_count = len(user_reports)

            # チームのプレイヤー数を取得
            team_a = item.get("team_a", [])
            team_b = item.get("team_b", [])

            # ホストプレイヤー名を取得
            host_user_id = item.get("host_user_id", "")
            host_trainer_name = "Unknown"

            if host_user_id and host_user_id != "#EVERYONE#":
                # チームAから探す
                for player in team_a:
                    if isinstance(player, dict) and player.get("user_id") == host_user_id:
                        host_trainer_name = player.get("trainer_name", "Unknown")
                        break
                # チームBから探す
                if host_trainer_name == "Unknown":
                    for player in team_b:
                        if isinstance(player, dict) and player.get("user_id") == host_user_id:
                            host_trainer_name = player.get("trainer_name", "Unknown")
                            break
            elif host_user_id == "#EVERYONE#":
                host_trainer_name = "全員"

            match_summary = {
                "match_id": str(item.get("match_id")),
                "status": item.get("status"),
                "matched_unixtime": item.get("matched_unixtime"),
                "team_a_count": len(team_a),
                "team_b_count": len(team_b),
                "report_count": report_count,
                "lobby_id": item.get("lobby_id", ""),
                "host_trainer_name": host_trainer_name,
            }

            matches.append(match_summary)

        # matched_unixtimeで降順ソート（新しいものが先）
        matches.sort(key=lambda x: x.get("matched_unixtime", 0), reverse=True)

        return create_success_response({"matches": decimal_to_json_serializable(matches), "total_count": len(matches)})

    except ClientError as e:
        logger.error(f"Failed to get admin matches: {e}")
        return create_error_response(500, "Failed to retrieve matches")
    except Exception as e:
        logger.error(f"Unexpected error in get_admin_matches: {e}")
        return create_error_response(500, "Internal server error")


def get_admin_match_detail(event: dict, _context: object) -> dict:
    """管理者用試合詳細取得.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 試合詳細またはエラーレスポンス.

    """
    # 管理者権限チェック
    is_admin, result = check_admin_auth(event)
    if not is_admin:
        return create_error_response(403, result)

    try:
        match_id = event["pathParameters"]["matchId"]

        # 試合情報を取得
        match_response = matches_table.get_item(Key={"namespace": NAMESPACE, "match_id": int(match_id)})

        if "Item" not in match_response:
            return create_error_response(404, "Match not found")

        match_item = match_response["Item"]

        # 結果報告の詳細を整理
        user_reports = match_item.get("user_reports", [])
        report_details = []

        # 通報集計
        penalty_reports = {}

        for report in user_reports:
            user_id = report.get("user_id")

            # ユーザー名を取得
            trainer_name = "Unknown"
            team = "Unknown"

            # チームAから探す
            for player in match_item.get("team_a", []):
                if isinstance(player, dict) and player.get("user_id") == user_id:
                    trainer_name = player.get("trainer_name", user_id)
                    team = "A"
                    break

            # チームBから探す
            if team == "Unknown":
                for player in match_item.get("team_b", []):
                    if isinstance(player, dict) and player.get("user_id") == user_id:
                        trainer_name = player.get("trainer_name", user_id)
                        team = "B"
                        break

            # 報告詳細
            report_detail = {
                "user_id": user_id,
                "trainer_name": trainer_name,
                "reported_at": report.get("timestamp", 0),
                "result": report.get("result"),
                "team": team,
                "reported_players": report.get("violation_report", []),
                "report_reason": report.get("violation_reason", ""),
            }
            report_details.append(report_detail)

            # 通報された側の集計
            for reported_id in report.get("violation_report", []):
                if reported_id not in penalty_reports:
                    # 通報されたプレイヤーの名前を取得
                    reported_name = "Unknown"
                    for player in match_item.get("team_a", []) + match_item.get("team_b", []):
                        if isinstance(player, dict) and player.get("user_id") == reported_id:
                            reported_name = player.get("trainer_name", reported_id)
                            break

                    penalty_reports[reported_id] = {"trainer_name": reported_name, "report_count": 0, "reporters": []}

                penalty_reports[reported_id]["report_count"] += 1
                penalty_reports[reported_id]["reporters"].append(
                    {
                        "user_id": user_id,
                        "trainer_name": trainer_name,
                        "team": team,
                        "reason": report.get("violation_reason", ""),
                    }
                )

        # ペナルティ処理状態
        penalty_status = {
            "processed": len(match_item.get("penalty_player", [])) > 0,
            "penalty_players": match_item.get("penalty_player", []),
            "processing_time": match_item.get("penalty_processed_at"),
        }

        # レスポンスデータ構築
        response_data = {
            "match": {
                "match_id": str(match_item.get("match_id")),
                "status": match_item.get("status"),
                "matched_unixtime": match_item.get("matched_unixtime"),
                "lobby_id": match_item.get("lobby_id"),
                "host_user_id": match_item.get("host_user_id"),
                "winner_team": match_item.get("winner_team"),
                "team_a": match_item.get("team_a", []),
                "team_b": match_item.get("team_b", []),
            },
            "reports": report_details,
            "penalty_summary": penalty_reports,
            "penalty_status": penalty_status,
        }

        return create_success_response(decimal_to_json_serializable(response_data))

    except ClientError as e:
        logger.error(f"Failed to get match detail: {e}")
        return create_error_response(500, "Failed to retrieve match detail")
    except Exception as e:
        logger.error(f"Unexpected error in get_admin_match_detail: {e}")
        return create_error_response(500, "Internal server error")
