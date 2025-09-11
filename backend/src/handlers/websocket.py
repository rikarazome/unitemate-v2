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
    print(f"[WebSocket] ===== WebSocket Connection Handler =====")
    print(f"[WebSocket] Event received: {json.dumps(event, default=str)}")
    
    try:
        connection_id = event["requestContext"]["connectionId"]
        query_params = event.get("queryStringParameters") or {}
        user_id = query_params.get("user_id", "")

        print(f"[WebSocket] Connection attempt: connection_id={connection_id}, user_id={user_id}")

        if not user_id:
            print("[WebSocket] Missing user_id in connection")
            return {"statusCode": 400, "body": "Missing user_id parameter"}

        print(f"[WebSocket] Storing connection in DynamoDB: {connection_id} for user {user_id}")
        
        # Store connection ID in DynamoDB
        connections_table.put_item(
            Item={
                "connection_id": connection_id,
                "user_id": user_id,
                "connected_at": Decimal(int(datetime.now().timestamp())),
            }
        )

        print(f"[WebSocket] Connection registered successfully: {connection_id}")
        return {"statusCode": 200}
        
    except Exception as e:
        print(f"[WebSocket] Connection error: {e}")
        traceback.print_exc()
        return {"statusCode": 500, "body": f"Connection failed: {str(e)}"}


def on_disconnect(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    """Handle WebSocket disconnection."""
    connection_id = event["requestContext"]["connectionId"]

    try:
        # Remove connection ID from DynamoDB
        connections_table.delete_item(Key={"connection_id": connection_id})

        return {"statusCode": 200, "body": "Disconnected"}
    except Exception as e:
        print(f"[WebSocket] Disconnect cleanup failed: {e}")
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
        print(f"[WebSocket] Message received: connection_id={connection_id}, action={action}")

        # アクションに応じた処理
        if action == "ping":
            return _send_message_to_connection(connection_id, {"action": "pong"})
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
            print(f"[WebSocket] Unknown action: {action}")
            return {"statusCode": 400, "body": f"Unknown action: {action}"}

    except json.JSONDecodeError:
        print(f"[WebSocket] Invalid JSON in message from {connection_id}")
        return {"statusCode": 400, "body": "Invalid JSON"}

    except Exception as e:
        print(f"[WebSocket] Message handling failed: {e}")
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
        print(f"Error sending message to connection {connection_id}: {e}")
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
        print(f"Error broadcasting queue update: {e}")


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
        
    except client.exceptions.GoneException:
        print(f"[WebSocket] Connection {connection_id} is no longer valid")
        # 無効な接続をDynamoDBから削除
        try:
            connections_table.delete_item(Key={"connection_id": connection_id})
        except Exception:
            pass
        return {"statusCode": 410, "body": "Connection gone"}
    except Exception as e:
        print(f"[WebSocket] Failed to send message to {connection_id}: {e}")
        return {"statusCode": 500, "body": f"Failed to send message: {str(e)}"}


def broadcast_queue_update(queue_data: dict[str, Any] = None):
    """キュー状況変更をすべての接続者にブロードキャスト（Legacyと同じ仕様）"""
    try:
        # 全ての接続を取得
        response = connections_table.scan()
        connections = response.get("Items", [])

        # Legacy形式のメッセージ：{"action": "updateQueue"}
        # データは含めず、フロントエンドに再取得を促す
        message = {"action": "updateQueue"}

        print(f"[WebSocket] Broadcasting queue update to {len(connections)} connections")
        
        for connection in connections:
            connection_id = connection["connection_id"]
            _send_message_to_connection(connection_id, message)

    except Exception as e:
        print(f"[WebSocket] Error broadcasting queue update: {e}")


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

        print(f"[WebSocket] Notifying match found to users: {user_ids}")
        
        for connection in connections:
            if connection.get("user_id") in user_ids:
                connection_id = connection["connection_id"]
                _send_message_to_connection(connection_id, message)

    except Exception as e:
        print(f"[WebSocket] Error notifying match found: {e}")


def handle_subscribe_match(connection_id: str, match_id: str) -> dict[str, Any]:
    """試合購読を開始"""
    try:
        print(f"[WebSocket] Subscribing connection {connection_id} to match {match_id}")
        
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
            print(f"[WebSocket] Subscription successful for match {match_id}")
        else:
            _send_message_to_connection(connection_id, {
                "type": "subscribeMatchError",
                "matchId": match_id,
                "error": "Match not found"
            })
            print(f"[WebSocket] Match {match_id} not found")
        
        return {"statusCode": 200}
        
    except Exception as e:
        print(f"[WebSocket] Failed to subscribe to match {match_id}: {e}")
        return {"statusCode": 500, "body": f"Failed to subscribe: {str(e)}"}


def handle_unsubscribe_match(connection_id: str, match_id: str) -> dict[str, Any]:
    """試合購読を解除"""
    try:
        print(f"[WebSocket] Unsubscribing connection {connection_id} from match {match_id}")
        
        # ConnectionsテーブルからサブスクリプションIDを削除
        connections_table.update_item(
            Key={"connection_id": connection_id},
            UpdateExpression="REMOVE subscribed_match_id"
        )
        
        _send_message_to_connection(connection_id, {
            "type": "unsubscribeMatchSuccess",
            "matchId": match_id
        })
        
        print(f"[WebSocket] Unsubscription successful for match {match_id}")
        return {"statusCode": 200}
        
    except Exception as e:
        print(f"[WebSocket] Failed to unsubscribe from match {match_id}: {e}")
        return {"statusCode": 500, "body": f"Failed to unsubscribe: {str(e)}"}


def broadcast_match_update(match_id: str, update_type: str):
    """特定の試合を購読している全接続に更新を送信（最小限の可変データのみ）"""
    try:
        print(f"[WebSocket] ===== BROADCAST DEBUG START =====")
        print(f"[WebSocket] Broadcasting match update for {match_id}, type: {update_type}")
        print(f"[WebSocket] Environment check - CONNECTIONS_TABLE: {os.environ.get('CONNECTIONS_TABLE_NAME')}")
        print(f"[WebSocket] Environment check - WEBSOCKET_API_ID: {os.environ.get('WEBSOCKET_API_ID')}")
        print(f"[WebSocket] Environment check - AWS_STAGE: {os.environ.get('AWS_STAGE')}")
        
        # 購読者を検索（全接続をスキャンしてフィルタリング）
        # 注: 本番環境ではGSIを使用して効率化する
        print(f"[WebSocket] About to scan connections table")
        response = connections_table.scan()
        connections = response.get("Items", [])
        print(f"[WebSocket] Found {len(connections)} total connections")
        
        # 試合データを取得
        match_data = get_match_data(match_id)
        if not match_data:
            print(f"[WebSocket] ERROR: Match {match_id} not found for broadcast")
            return
        
        print(f"[WebSocket] Retrieved match data: lobby_id={match_data.get('lobby_id')}, host_user_id={match_data.get('host_user_id')}")
        
        # 最小限の可変データのみを抽出
        dynamic_data = {
            "lobby_id": match_data.get("lobby_id"),
            "host_user_id": match_data.get("host_user_id"),
            "report_count": len(match_data.get("user_reports", [])),
            "status": match_data.get("status", "matched")
        }
        
        print(f"[WebSocket] Prepared dynamic_data: {dynamic_data}")
        
        message = {
            "type": "matchUpdate",
            "matchId": match_id,
            "dynamicData": dynamic_data,
            "updateType": update_type
        }
        
        print(f"[WebSocket] Message to broadcast: {message}")
        
        # 購読者にメッセージを送信
        subscriber_count = 0
        subscribers_found = []
        for connection in connections:
            subscribed_match = connection.get("subscribed_match_id")
            if subscribed_match == match_id:
                connection_id = connection["connection_id"]
                user_id = connection.get("user_id", "unknown")
                print(f"[WebSocket] Sending to subscriber: connection_id={connection_id}, user_id={user_id}")
                result = _send_message_to_connection(connection_id, message)
                print(f"[WebSocket] Send result: {result}")
                subscribers_found.append(f"{user_id}({connection_id})")
                subscriber_count += 1
            else:
                print(f"[WebSocket] Connection {connection.get('connection_id')} subscribed to match {subscribed_match}, not {match_id}")
        
        print(f"[WebSocket] FINAL: Broadcasted to {subscriber_count} subscribers: {subscribers_found}")
        print(f"[WebSocket] ===== BROADCAST DEBUG END =====")
        
    except Exception as e:
        print(f"[WebSocket] Error broadcasting match update: {e}")
        print(f"[WebSocket] Broadcast traceback: {traceback.format_exc()}")


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
        print(f"[WebSocket] Error getting match data: {e}")
        return None
