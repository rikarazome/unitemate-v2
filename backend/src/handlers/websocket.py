"""WebSocket handlers for real-time communication."""

import json
import os
import traceback
from typing import Any
from decimal import Decimal
from datetime import datetime

import boto3

# DynamoDB tables
CONNECTIONS_TABLE = os.environ.get("CONNECTIONS_TABLE_NAME", "unitemate-v2-connections-dev")
MATCHES_TABLE = os.environ.get("MATCHES_TABLE_NAME", "unitemate-v2-matches-dev")

dynamodb = boto3.resource("dynamodb")
connections_table = dynamodb.Table(CONNECTIONS_TABLE)
matches_table = dynamodb.Table(MATCHES_TABLE)


def on_connect(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    """Handle WebSocket connection."""
    try:
        connection_id = event["requestContext"]["connectionId"]
        query_params = event.get("queryStringParameters") or {}
        user_id = query_params.get("user_id", "")

        if not user_id:
            print("[ERROR] WebSocket connection missing user_id")
            return {"statusCode": 400, "body": "Missing user_id parameter"}

        # Store connection ID in DynamoDB
        connections_table.put_item(
            Item={
                "connection_id": connection_id,
                "user_id": user_id,
                "connected_at": Decimal(int(datetime.now().timestamp())),
            }
        )

        return {"statusCode": 200}
        
    except Exception as e:
        print(f"[ERROR] WebSocket connection failed: {e}")
        return {"statusCode": 500, "body": f"Connection failed: {str(e)}"}


def on_disconnect(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    """Handle WebSocket disconnection."""
    connection_id = event["requestContext"]["connectionId"]

    try:
        # Remove connection ID from DynamoDB
        connections_table.delete_item(Key={"connection_id": connection_id})

        return {"statusCode": 200, "body": "Disconnected"}
    except Exception as e:
        print(f"[ERROR] WebSocket disconnect failed: {e}")
        return {"statusCode": 500, "body": f"Disconnect failed: {str(e)}"}


def on_message(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    """Handle default WebSocket messages."""
    connection_id = event["requestContext"]["connectionId"]

    try:
        # メッセージボディを解析
        body = event.get("body", "{}")
        if isinstance(body, str):
            message_data = json.loads(body)
        else:
            message_data = body

        action = message_data.get("action", "unknown")

        # アクションに応じた処理
        if action == "ping":
            return _send_message_to_connection(connection_id, {"action": "pong"})
        elif action == "askQueueInfo":
            # キューの初期状態を返す
            return handle_ask_queue_info(connection_id)
        elif action == "subscribe":
            # サブスクリプション処理（将来の拡張用）
            return {"statusCode": 200}
        elif action == "subscribeMatch":
            # 試合購読を開始
            match_id = message_data.get("matchId")
            if not match_id:
                return {"statusCode": 400, "body": "matchId is required"}
            return handle_subscribe_match(connection_id, match_id)
        elif action == "unsubscribeMatch":
            # 試合購読を解除
            match_id = message_data.get("matchId")
            if not match_id:
                return {"statusCode": 400, "body": "matchId is required"}
            return handle_unsubscribe_match(connection_id, match_id)
        else:
            print(f"[ERROR] Unknown WebSocket action: {action}")
            return {"statusCode": 400, "body": f"Unknown action: {action}"}

    except json.JSONDecodeError:
        print(f"[ERROR] Invalid JSON from {connection_id}")
        return {"statusCode": 400, "body": "Invalid JSON"}

    except Exception as e:
        print(f"[ERROR] WebSocket message handling failed: {e}")
        return {"statusCode": 500, "body": f"Message handling failed: {str(e)}"}


def send_message_to_connection(connection_id: str, message: dict[str, Any]):
    """Send a message to a specific WebSocket connection."""
    try:
        # Get API Gateway management client
        api_gateway_management_api = boto3.client(
            "apigatewaymanagementapi",
            endpoint_url=f"https://{_get_api_id()}.execute-api.{boto3.Session().region_name}.amazonaws.com/dev",
        )

        api_gateway_management_api.post_to_connection(ConnectionId=connection_id, Data=json.dumps(message))

    except Exception as e:
        # If connection is stale, remove it
        try:
            connections_table.delete_item(Key={"connection_id": connection_id})
        except:
            pass


def broadcast_queue_update(queue_data: dict[str, Any]):
    """Broadcast queue status update to all connected clients."""
    try:
        # Get all active connections
        response = connections_table.scan()
        connections = response.get("Items", [])

        message = {
            "action": "queue_update",
            "data": queue_data,
            "timestamp": int(__import__("datetime").datetime.now().timestamp()),
        }

        for connection in connections:
            connection_id = connection["connection_id"]
            send_message_to_connection(connection_id, message)

    except Exception as e:
        print(f"[ERROR] Broadcasting queue update: {e}")


def _send_message_to_connection(connection_id: str, message_data: dict) -> dict:
    """
    指定された接続にメッセージを送信する。
    """
    try:
        # API Gateway Management API クライアント
        api_id = os.environ["WEBSOCKET_API_ID"]
        stage = os.environ["AWS_STAGE"]
        # リージョンは boto3 のセッションから取得
        region = boto3.Session().region_name or "ap-northeast-1"  # デフォルトリージョン
        endpoint_url = f"https://{api_id}.execute-api.{region}.amazonaws.com/{stage}"
        
        client = boto3.client("apigatewaymanagementapi", endpoint_url=endpoint_url)
        
        # メッセージを送信
        client.post_to_connection(
            ConnectionId=connection_id,
            Data=json.dumps(message_data).encode("utf-8")
        )
        
        return {"statusCode": 200}
        
    except Exception as e:
        # GoneExceptionかどうかチェック
        if "GoneException" in str(type(e)) or "410" in str(e):
            # 無効な接続をDynamoDBから削除（サイレント）
            try:
                connections_table.delete_item(Key={"connection_id": connection_id})
            except Exception:
                pass
            return {"statusCode": 410, "body": "Connection gone"}
        else:
            print(f"[ERROR] Failed to send WebSocket message: {e}")
            return {"statusCode": 500, "body": f"Failed to send message: {str(e)}"}


def broadcast_queue_update(queue_data: dict[str, Any] = None):
    """キュー状況変更をすべての接続者にブロードキャスト（Legacyと同じ仕様）"""
    try:
        # 全ての接続を取得
        response = connections_table.scan()
        connections = response.get("Items", [])

        # Legacy形式のメッセージ：{"action": "updateQueue"}
        message = {"action": "updateQueue"}

        sent_count = 0
        for connection in connections:
            connection_id = connection["connection_id"]
            result = _send_message_to_connection(connection_id, message)
            if result.get("statusCode") == 200:
                sent_count += 1

    except Exception as e:
        print(f"[ERROR] Queue broadcast failed: {e}")


def notify_match_found(user_ids: list, match_data: dict[str, Any]):
    """特定ユーザーにマッチング成立を通知"""
    try:
        message = {
            "action": "match_found",
            "data": match_data,
            "timestamp": int(__import__("datetime").datetime.now().timestamp()),
        }

        # 全接続を取得してuser_idでフィルタ
        response = connections_table.scan()
        connections = response.get("Items", [])

        
        for connection in connections:
            if connection.get("user_id") in user_ids:
                connection_id = connection["connection_id"]
                _send_message_to_connection(connection_id, message)

    except Exception as e:
        print(f"[ERROR] WebSocket notifying match found: {e}")


def handle_subscribe_match(connection_id: str, match_id: str) -> dict[str, Any]:
    """試合購読を開始"""
    try:
        
        # ConnectionsテーブルにサブスクリプションIDを追加
        connections_table.update_item(
            Key={"connection_id": connection_id},
            UpdateExpression="SET subscribed_match_id = :match_id",
            ExpressionAttributeValues={":match_id": match_id}
        )
        
        # 現在の試合の動的データのみを取得して送信
        match_data = get_match_data(match_id)
        if match_data:
            # 最小限の可変データのみを抽出
            dynamic_data = {
                "lobby_id": match_data.get("lobby_id"),
                "host_user_id": match_data.get("host_user_id"),
                "report_count": len(match_data.get("user_reports", [])),
                "status": match_data.get("status", "matched")
            }
            
            _send_message_to_connection(connection_id, {
                "type": "subscribeMatchSuccess",
                "matchId": match_id,
                "dynamicData": dynamic_data
            })
        else:
            _send_message_to_connection(connection_id, {
                "type": "subscribeMatchError",
                "matchId": match_id,
                "error": "Match not found"
            })
        
        return {"statusCode": 200}
        
    except Exception as e:
        print(f"[ERROR] WebSocket failed to subscribe to match {match_id}: {e}")
        return {"statusCode": 500, "body": f"Failed to subscribe: {str(e)}"}


def handle_unsubscribe_match(connection_id: str, match_id: str) -> dict[str, Any]:
    """試合購読を解除"""
    try:
        
        # ConnectionsテーブルからサブスクリプションIDを削除
        connections_table.update_item(
            Key={"connection_id": connection_id},
            UpdateExpression="REMOVE subscribed_match_id"
        )
        
        _send_message_to_connection(connection_id, {
            "type": "unsubscribeMatchSuccess",
            "matchId": match_id
        })
        
        return {"statusCode": 200}
        
    except Exception as e:
        print(f"[ERROR] WebSocket failed to unsubscribe from match {match_id}: {e}")
        return {"statusCode": 500, "body": f"Failed to unsubscribe: {str(e)}"}


def broadcast_match_update(match_id: str, update_type: str):
    """特定の試合を購読している全接続に更新を送信（最小限の可変データのみ）"""
    try:
        
        # 購読者を検索（全接続をスキャンしてフィルタリング）
        # 注: 本番環境ではGSIを使用して効率化する
        response = connections_table.scan()
        connections = response.get("Items", [])
        
        # 試合データを取得
        match_data = get_match_data(match_id)
        if not match_data:
            return
        
        
        # 最小限の可変データのみを抽出
        dynamic_data = {
            "lobby_id": match_data.get("lobby_id"),
            "host_user_id": match_data.get("host_user_id"),
            "report_count": len(match_data.get("user_reports", [])),
            "status": match_data.get("status", "matched")
        }
        
        
        message = {
            "type": "matchUpdate",
            "matchId": match_id,
            "dynamicData": dynamic_data,
            "updateType": update_type
        }
        
        
        # 購読者にメッセージを送信
        subscriber_count = 0
        for connection in connections:
            subscribed_match = connection.get("subscribed_match_id")
            if subscribed_match == match_id:
                connection_id = connection["connection_id"]
                _send_message_to_connection(connection_id, message)
                subscriber_count += 1
        
        
    except Exception as e:
        print(f"[ERROR] WebSocket broadcasting match update: {e}")


def handle_ask_queue_info(connection_id: str) -> dict[str, Any]:
    """
    クライアントからのキュー情報リクエストに応答する。
    初期キュー状態を取得してWebSocket経由で返す。
    """
    try:

        # 現在のキュー情報を取得
        NAMESPACE = "default"
        QUEUE_TABLE = os.environ.get("QUEUE_TABLE_NAME", "unitemate-v2-queue-dev")

        queue_table = dynamodb.Table(QUEUE_TABLE)

        # #META#アイテムから統計情報を取得
        response = queue_table.get_item(Key={"namespace": NAMESPACE, "user_id": "#META#"})

        if "Item" in response:
            meta_item = response["Item"]
            # DynamoDB Decimal型をJSON serializable型に変換
            role_queues_raw = meta_item.get("role_queues", {})
            role_queues = {}
            for role, users in role_queues_raw.items():
                # ユーザーIDリストの各要素をstrに変換
                role_queues[role] = [str(user_id) for user_id in users]

            total_waiting = int(meta_item.get("total_waiting", 0))
            ongoing_matches = int(meta_item.get("ongoing_matches", 0))
            # DynamoDB Decimal型をstrに変換してからlistに
            ongoing_match_players = [str(player) for player in meta_item.get("ongoing_match_players", [])]
            previous_matched_unixtime = int(meta_item.get("previous_matched_unixtime", 0))
            previous_user_count = int(meta_item.get("previous_user_count", 0))
        else:
            # #META#が存在しない場合は空のキュー
            role_queues = {"TOP_LANE": [], "SUPPORT": [], "MIDDLE": [], "BOTTOM_LANE": [], "TANK": []}
            total_waiting = 0
            ongoing_matches = 0
            ongoing_match_players = []
            previous_matched_unixtime = 0
            previous_user_count = 0

        # ロール別の待機人数を計算
        role_counts = {role: len(users) for role, users in role_queues.items()}

        queue_info = {
            "total_waiting": total_waiting,
            "ongoing_matches": ongoing_matches,
            "role_counts": role_counts,
            "previous_matched_unixtime": previous_matched_unixtime,
            "previous_user_count": previous_user_count,
            "ongoing_match_players": ongoing_match_players,
        }

        # クライアントに初期キュー情報を送信
        message = {
            "action": "queueInfo",
            "data": queue_info,
            "timestamp": int(datetime.now().timestamp())
        }

        result = _send_message_to_connection(connection_id, message)
        return result

    except Exception as e:
        print(f"[ERROR] WebSocket handling askQueueInfo: {e}")

        # エラー時も空のデータを送信
        error_message = {
            "action": "queueInfo",
            "data": {
                "total_waiting": 0,
                "ongoing_matches": 0,
                "role_counts": {"TOP_LANE": 0, "SUPPORT": 0, "MIDDLE": 0, "BOTTOM_LANE": 0, "TANK": 0},
                "previous_matched_unixtime": 0,
                "previous_user_count": 0,
                "ongoing_match_players": [],
            },
            "error": str(e),
            "timestamp": int(datetime.now().timestamp())
        }

        return _send_message_to_connection(connection_id, error_message)


def get_match_data(match_id: str) -> dict[str, Any] | None:
    """試合データを取得"""
    try:
        response = matches_table.get_item(
            Key={"namespace": "default", "match_id": int(match_id)}
        )
        
        if "Item" in response:
            match_item = response["Item"]
            # DynamoDBのDecimal型を通常の数値に変換
            return json.loads(json.dumps(match_item, default=str))
        
        return None
        
    except Exception as e:
        print(f"[ERROR] WebSocket getting match data: {e}")
        return None
