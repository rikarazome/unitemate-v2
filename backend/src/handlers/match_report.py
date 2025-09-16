"""Lambda handlers for match report API endpoints (Legacy compatible)."""

import json
import os
import traceback
from datetime import datetime
from decimal import Decimal
from typing import Literal

import boto3
from pydantic import BaseModel, Field, ValidationError, field_serializer

from src.utils.response import create_error_response, create_success_response

# DynamoDB設定
dynamodb = boto3.resource("dynamodb")
users_table = dynamodb.Table(os.environ["USERS_TABLE_NAME"])
matches_table = dynamodb.Table(os.environ["MATCHES_TABLE_NAME"])
records_table = dynamodb.Table(os.environ["RECORDS_TABLE_NAME"])
queue_table = dynamodb.Table(os.environ["QUEUE_TABLE_NAME"])


class MatchReportModel(BaseModel):
    """Legacy準拠の試合報告モデル"""

    namespace: str = "default"
    match_id: int
    user_id: str
    result: str  # "win" or "lose"
    violation_report: str  # 通報内容
    banned_pokemon: str
    picked_pokemon: str
    pokemon_move1: str
    pokemon_move2: str
    report_unixtime: datetime = Field(default_factory=datetime.now)

    @field_serializer("report_unixtime")
    def serialize_report_unixtime(self, report_unixtime: datetime) -> int:
        return int(report_unixtime.timestamp())

    def keys_dict(self):
        return {"namespace": self.namespace, "match_id": self.match_id}

    def content_dict(self):
        return {
            "user_id": self.user_id,
            "result": self.result,
            "violation_report": self.violation_report,
            "banned_pokemon": self.banned_pokemon,
            "picked_pokemon": self.picked_pokemon,
            "pokemon_move1": self.pokemon_move1,
            "pokemon_move2": self.pokemon_move2,
            "report_unixtime": self.serialize_report_unixtime(self.report_unixtime),
        }


class MatchReportRequest(BaseModel):
    """フロントエンド用の試合報告リクエスト（Legacy準拠）"""

    result: Literal["A-win", "B-win", "invalid"]  # チームベースの結果
    banned_pokemon: str
    picked_pokemon: str
    pokemon_move1: str
    pokemon_move2: str
    violation_report: str = ""  # デフォルトは空文字


class DecimalEncoder(json.JSONEncoder):
    """Decimal型をJSONに変換するエンコーダー"""

    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj)
        return super(DecimalEncoder, self).default(obj)


def remove_player_from_ongoing_match_players(user_id: str) -> bool:
    """
    ongoing_match_playersから特定のプレイヤーを削除
    DynamoDBのリスト要素削除は複雑なため、リストを再構築して更新する

    Args:
        user_id: 削除するプレイヤーのID

    Returns:
        成功したかどうか

    """
    try:
        # 現在のMETAデータを取得
        response = queue_table.get_item(Key={"namespace": "default", "user_id": "#META#"})

        if "Item" not in response:
            print(f"META item not found when trying to remove player {user_id}")
            return True  # METAが存在しない場合は成功とする

        meta_item = response["Item"]
        ongoing_match_players = meta_item.get("ongoing_match_players", [])

        # プレイヤーIDが含まれていない場合は何もしない
        if user_id not in ongoing_match_players:
            print(f"Player {user_id} not found in ongoing_match_players")
            return True

        # プレイヤーIDを除いた新しいリストを作成
        updated_ongoing_players = [pid for pid in ongoing_match_players if pid != user_id]

        # METAデータを更新
        queue_table.update_item(
            Key={"namespace": "default", "user_id": "#META#"},
            UpdateExpression="SET ongoing_match_players = :players",
            ExpressionAttributeValues={":players": updated_ongoing_players},
        )

        print(f"Removed player {user_id} from ongoing_match_players. Remaining: {len(updated_ongoing_players)} players")
        return True

    except Exception as e:
        print(f"Failed to remove player {user_id} from ongoing_match_players: {e}")
        return False


def report_match_result(event: dict, _context: object) -> dict:
    """
    試合結果を報告（Legacyのreport関数と同等）
    POST /api/matches/{matchId}/report エンドポイントで呼び出される
    """
    print("event")

    try:
        # 認証情報を取得
        auth0_user_id = event["requestContext"]["authorizer"]["lambda"]["user_id"]

        # Auth0 user_idからDiscord IDを抽出
        if "|" in auth0_user_id:
            user_id = auth0_user_id.split("|")[-1]
        else:
            user_id = auth0_user_id

        # パスパラメータから試合IDを取得
        match_id = int(event["pathParameters"]["matchId"])

        # リクエストボディを解析
        body_data = json.loads(event.get("body", "{}"))
        print(f"report_match_result - Raw body_data: {body_data}")
        request_data = MatchReportRequest(**body_data)
        print(f"report_match_result - Parsed request_data.violation_report: '{request_data.violation_report}'")

        # Legacy形式のモデルに変換（result はそのまま A-win/B-win/invalid として保存）
        model = MatchReportModel(
            match_id=match_id,
            user_id=user_id,
            result=request_data.result,
            violation_report=request_data.violation_report,
            banned_pokemon=request_data.banned_pokemon,
            picked_pokemon=request_data.picked_pokemon,
            pokemon_move1=request_data.pokemon_move1,
            pokemon_move2=request_data.pokemon_move2,
        )
        print(f"report_match_result - Final model.violation_report: '{model.violation_report}'")

    except ValidationError as e:
        return create_error_response(422, f"Validation error: {e}")
    except Exception as e:
        return create_error_response(400, f"Invalid request: {e}")

    try:
        # まず現在の試合データを取得して、既に報告済みかチェック
        match_data = matches_table.get_item(Key=model.keys_dict())
        if "Item" in match_data:
            existing_reports = match_data["Item"].get("user_reports", [])
            # 既に同じユーザーから報告があるか確認
            for report in existing_reports:
                if report.get("user_id") == model.user_id:
                    print(f"User {model.user_id} has already reported for match {model.match_id}")
                    return create_error_response(
                        409,
                        "You have already reported this match result"
                    )
        
        # 重複がなければ試合結果の報告をMatchテーブルに格納（Legacyと同じ）
        matches_table.update_item(
            Key=model.keys_dict(),
            AttributeUpdates={
                "user_reports": {
                    "Value": [model.content_dict()],
                    "Action": "ADD",
                }
            },
        )

        # ユーザーのアサインマッチを解除（Legacyと同じ）
        users_table.update_item(
            Key={"namespace": "default", "user_id": model.user_id},
            UpdateExpression="SET assigned_match_id = :zero",
            ExpressionAttributeValues={":zero": Decimal(0)},
        )

        # ongoing_match_playersからプレイヤーを削除（自動試合画面切り替え用）
        remove_player_from_ongoing_match_players(model.user_id)

        # WebSocket購読者に試合更新を通知（報告があったことを通知）
        try:
            from .websocket import broadcast_match_update

            broadcast_match_update(str(model.match_id), "match_reported")
        except Exception as ws_error:
            print(f"Failed to broadcast match update via WebSocket: {ws_error}")

        # Recordテーブルの更新（試合集計後でもポケモン情報を補完）
        try:
            # recordsテーブルのキー構造: user_id (String PK), match_id (Number SK)
            record_key = {
                "user_id": str(model.user_id),  # String型を明示
                "match_id": int(model.match_id)  # Number型を明示
            }
            
            print(f"[RECORD UPDATE] Attempting to get record with key: {record_key}")
            print(f"[RECORD UPDATE] user_id type: {type(model.user_id)}, value: {model.user_id}")
            print(f"[RECORD UPDATE] match_id type: {type(model.match_id)}, value: {model.match_id}")
            
            record_response = records_table.get_item(Key=record_key)
            
            if "Item" in record_response:
                record_item = record_response["Item"]
                print(f"[RECORD UPDATE] Found existing record for user {model.user_id} in match {model.match_id}")
                
                # pokemonがnullまたは"null"の場合のみ更新
                current_pokemon = record_item.get("pokemon", "null")
                print(f"[RECORD UPDATE] Current pokemon value: {current_pokemon} (type: {type(current_pokemon)})")
                
                if current_pokemon in [None, "null", "", "unknown"]:
                    print(f"[RECORD UPDATE] Updating pokemon from '{current_pokemon}' to '{model.picked_pokemon}'")
                    records_table.update_item(
                        Key=record_key,
                        UpdateExpression="SET pokemon = :p",
                        ExpressionAttributeValues={":p": model.picked_pokemon},
                    )
                    print(f"[RECORD UPDATE] Successfully updated record for user {model.user_id}: pokemon '{current_pokemon}' -> '{model.picked_pokemon}'")
                else:
                    print(f"[RECORD UPDATE] Record already has valid pokemon data: '{current_pokemon}', skipping update")
            else:
                print(f"[RECORD UPDATE] No record found for user {model.user_id} in match {model.match_id}")
                print(f"[RECORD UPDATE] This is expected if the match hasn't been aggregated yet")
                print(f"[RECORD UPDATE] Attempted key: {record_key}")
        except Exception as e:
            print(f"[RECORD UPDATE ERROR] Exception occurred: {type(e).__name__}: {e}")
            print(f"[RECORD UPDATE ERROR] Key used: {record_key}")
            print(f"[RECORD UPDATE ERROR] user_id={model.user_id} (type: {type(model.user_id)})")
            print(f"[RECORD UPDATE ERROR] match_id={model.match_id} (type: {type(model.match_id)})")
            print(f"[RECORD UPDATE ERROR] Traceback: {traceback.format_exc()}")

        return create_success_response({"message": "Match result reported successfully"})

    except Exception as e:
        print(f"report_match_result error: {e}")
        return create_error_response(500, f"Failed to report match result: {e!s}")
