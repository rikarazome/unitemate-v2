"""DynamoDB Streams handler for queue changes detection."""

import json
import os
from typing import Any, Dict
import boto3
from decimal import Decimal


def process_queue_changes(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """
    DynamoDB Streamsイベントを処理してキュー変更の差分を検知し、
    WebSocketクライアントに効率的な更新を送信する。

    #META#レコードのMODIFYイベントのみを処理する。
    """
    try:
        print(f"[QueueStream] Processing {len(event.get('Records', []))} stream records")

        for record in event.get('Records', []):
            event_name = record.get('eventName')

            # MODIFYイベント且つ#META#レコードのみ処理
            if event_name == 'MODIFY':
                keys = record.get('dynamodb', {}).get('Keys', {})
                user_id = keys.get('user_id', {}).get('S', '')

                if user_id == '#META#':
                    print(f"[QueueStream] Processing #META# modification")

                    # 変更前後のデータを取得
                    old_image = record.get('dynamodb', {}).get('OldImage', {})
                    new_image = record.get('dynamodb', {}).get('NewImage', {})

                    # 差分を計算
                    changes = _calculate_queue_diff(old_image, new_image)

                    if changes:
                        print(f"[QueueStream] Queue changes detected: {changes}")
                        _broadcast_queue_diff(changes)
                    else:
                        print(f"[QueueStream] No significant changes detected")

        return {"statusCode": 200, "body": "Stream processed successfully"}

    except Exception as e:
        print(f"[QueueStream] Error processing stream: {e}")
        import traceback
        print(f"[QueueStream] Traceback: {traceback.format_exc()}")
        return {"statusCode": 500, "body": f"Stream processing failed: {str(e)}"}


def _calculate_queue_diff(old_image: Dict[str, Any], new_image: Dict[str, Any]) -> Dict[str, Any]:
    """
    DynamoDB StreamsのOLD_IMAGEとNEW_IMAGEから差分を計算する。
    """
    try:
        # DynamoDBの型付きデータをPythonオブジェクトに変換
        old_data = _deserialize_dynamodb_item(old_image)
        new_data = _deserialize_dynamodb_item(new_image)

        changes = {}

        # 総待機人数の変更をチェック
        old_total = old_data.get('total_waiting', 0)
        new_total = new_data.get('total_waiting', 0)
        if old_total != new_total:
            changes['total_waiting'] = {
                'old': old_total,
                'new': new_total,
                'delta': new_total - old_total
            }

        # ロール別キューの変更をチェック
        old_roles = old_data.get('role_queues', {})
        new_roles = new_data.get('role_queues', {})

        role_changes = {}
        for role in ['TOP_LANE', 'SUPPORT', 'MIDDLE', 'BOTTOM_LANE', 'TANK']:
            old_users = set(old_roles.get(role, []))
            new_users = set(new_roles.get(role, []))

            if old_users != new_users:
                joined = list(new_users - old_users)
                left = list(old_users - new_users)

                role_changes[role] = {
                    'old_count': len(old_users),
                    'new_count': len(new_users),
                    'joined': joined,
                    'left': left
                }

        if role_changes:
            changes['role_queues'] = role_changes

        # 進行中マッチ数の変更をチェック
        old_matches = old_data.get('ongoing_matches', 0)
        new_matches = new_data.get('ongoing_matches', 0)
        if old_matches != new_matches:
            changes['ongoing_matches'] = {
                'old': old_matches,
                'new': new_matches,
                'delta': new_matches - old_matches
            }

        # 進行中マッチプレイヤーの変更をチェック
        old_players = set(old_data.get('ongoing_match_players', []))
        new_players = set(new_data.get('ongoing_match_players', []))

        if old_players != new_players:
            changes['ongoing_match_players'] = {
                'old': list(old_players),
                'new': list(new_players),
                'joined': list(new_players - old_players),
                'left': list(old_players - new_players)
            }

        return changes

    except Exception as e:
        print(f"[QueueStream] Error calculating diff: {e}")
        return {}


def _deserialize_dynamodb_item(item: Dict[str, Any]) -> Dict[str, Any]:
    """DynamoDB StreamsのIMAGEデータをPythonオブジェクトに変換"""
    result = {}

    for key, value in item.items():
        if 'S' in value:  # String
            result[key] = value['S']
        elif 'N' in value:  # Number
            try:
                result[key] = int(value['N'])
            except ValueError:
                result[key] = float(value['N'])
        elif 'L' in value:  # List
            result[key] = [item.get('S', item.get('N', '')) for item in value['L']]
        elif 'M' in value:  # Map
            result[key] = _deserialize_dynamodb_item(value['M'])
        elif 'BOOL' in value:  # Boolean
            result[key] = value['BOOL']
        elif 'NULL' in value:  # Null
            result[key] = None
        else:
            # その他の型は文字列として扱う
            result[key] = str(value)

    return result


def _broadcast_queue_diff(changes: Dict[str, Any]) -> None:
    """
    計算された差分をWebSocketクライアントにブロードキャストする。
    """
    try:
        # WebSocket API情報を取得
        api_id = os.environ["WEBSOCKET_API_ID"]
        stage = os.environ["AWS_STAGE"]
        region = boto3.Session().region_name or "ap-northeast-1"
        endpoint_url = f"https://{api_id}.execute-api.{region}.amazonaws.com/{stage}"

        # API Gateway Management API クライアント
        client = boto3.client("apigatewaymanagementapi", endpoint_url=endpoint_url)

        # 接続一覧を取得
        connections_table_name = os.environ["CONNECTIONS_TABLE_NAME"]
        dynamodb = boto3.resource("dynamodb")
        connections_table = dynamodb.Table(connections_table_name)

        response = connections_table.scan()
        connections = response.get("Items", [])

        # 差分メッセージを構築
        message = {
            "action": "queueDiff",
            "changes": changes,
            "timestamp": int(__import__("datetime").datetime.now().timestamp())
        }

        print(f"[QueueStream] Broadcasting diff to {len(connections)} connections: {message}")

        sent_count = 0
        for connection in connections:
            connection_id = connection["connection_id"]

            try:
                client.post_to_connection(
                    ConnectionId=connection_id,
                    Data=json.dumps(message).encode("utf-8")
                )
                sent_count += 1

            except Exception as e:
                print(f"[QueueStream] Failed to send to {connection_id}: {e}")

                # 無効な接続を削除
                if "GoneException" in str(type(e)) or "410" in str(e):
                    try:
                        connections_table.delete_item(Key={"connection_id": connection_id})
                        print(f"[QueueStream] Removed stale connection: {connection_id}")
                    except Exception:
                        pass

        print(f"[QueueStream] Diff broadcast complete: {sent_count}/{len(connections)} sent")

    except Exception as e:
        print(f"[QueueStream] Error broadcasting diff: {e}")
        import traceback
        print(f"[QueueStream] Broadcast traceback: {traceback.format_exc()}")