"""Lambda handlers for queue-related API endpoints.

Legacy準拠の複合キー構造を使用:
- 複合キー: (namespace="default", user_id)
- すべての操作でnamespace="default"を使用

キューシステムの新設計:
1. get_queue_status: 現在のキュー統計を取得（#META#キーから、レート情報なし）
2. join_queue: ユーザーをキューに追加、メタデータのロール別リストを更新
3. leave_queue: ユーザーをキューから削除、メタデータのロール別リストを更新
4. get_my_queue_status: 特定ユーザーのキュー状態を取得
5. update_queue_meta_on_join: キュー参加時にメタデータを更新（ユーザーIDとロール情報のみ）
6. update_queue_meta_on_leave: キュー離脱時にメタデータを更新（ユーザーIDとロール情報のみ）

重要: レート情報はマッチメイキング時のみ取得し、メタデータには保存しない
"""

import json
import os
import boto3
from boto3.dynamodb.conditions import Key

from src.utils.response import create_error_response, create_success_response
from src.services.penalty_service import PenaltyService


# DynamoDB設定 - Legacy準拠の複合キー構造
dynamodb = boto3.resource("dynamodb")
queue_table = dynamodb.Table(os.environ["QUEUE_TABLE_NAME"])
user_table = dynamodb.Table(os.environ["USERS_TABLE_NAME"])  # join_queueで必要

# 定数
NAMESPACE = "default"  # Legacy互換のための名前空間


def ensure_meta_exists():
    """
    #META#アイテムが存在しない場合は作成する。
    新設計: role_queuesにはユーザーIDのリストのみを保持（レート情報なし）
    """
    try:
        resp = queue_table.get_item(Key={"namespace": NAMESPACE, "user_id": "#META#"})
        if "Item" not in resp:
            print("ensure_meta_exists: Creating missing #META# item")
            queue_table.put_item(
                Item={
                    "namespace": NAMESPACE,
                    "user_id": "#META#",
                    "role_queues": {
                        "TOP_LANE": [],  # ユーザーIDのリストのみ
                        "SUPPORT": [],  # ユーザーIDのリストのみ
                        "MIDDLE": [],  # ユーザーIDのリストのみ
                        "BOTTOM_LANE": [],  # ユーザーIDのリストのみ
                        "TANK": [],  # ユーザーIDのリストのみ
                    },
                    "total_waiting": 0,
                    "lock": 0,
                    "ongoing_matches": 0,
                    "ongoing_match_players": [],  # マッチに参加中のプレイヤーID
                }
            )
            print("ensure_meta_exists: #META# item created successfully")
        else:
            print("ensure_meta_exists: #META# item already exists")
    except Exception as e:
        print(f"ensure_meta_exists error: {e}")
        # エラーが発生してもプロセスは継続


def is_locked():
    """
    #META# アイテムのlockフィールドが1のときはマッチメイキング中であり、
    キューへの参加や離脱を禁止する。
    """
    ensure_meta_exists()

    try:
        resp = queue_table.get_item(Key={"namespace": NAMESPACE, "user_id": "#META#"})
        if "Item" in resp:
            return resp["Item"].get("lock", 0) == 1
        else:
            # #META#アイテムが存在しない場合はロックなしとみなす
            return False
    except Exception as e:
        print(f"is_locked error: {e}")
        return False


def get_queue_status(event: dict, _context: object) -> dict:
    """
    キューの現在状態を取得（新設計版）。
    GET /api/queue エンドポイントで呼び出される。
    フロントエンドはロール別の待機人数を期待:
    - total_waiting: キューにいる人数
    - ongoing_matches: 進行中のマッチ数
    - role_counts: ロール別の待機人数（ユーザーIDリストから算出）
    """
    try:
        # #META#アイテムから統計情報を取得
        response = queue_table.get_item(Key={"namespace": NAMESPACE, "user_id": "#META#"})
        if "Item" in response:
            role_queues = response["Item"].get("role_queues", {})
            total_waiting = response["Item"].get("total_waiting", 0)
            ongoing_matches = response["Item"].get("ongoing_matches", 0)
            ongoing_match_players = response["Item"].get("ongoing_match_players", [])
        else:
            # #META#が存在しない場合は空のキュー
            role_queues = {"TOP_LANE": [], "SUPPORT": [], "MIDDLE": [], "BOTTOM_LANE": [], "TANK": []}
            total_waiting = 0
            ongoing_matches = 0
            ongoing_match_players = []

        # ロール別の待機人数を計算（ユーザーIDリストの長さ）
        role_counts = {role: len(users) for role, users in role_queues.items()}

        # 前回マッチ情報を取得
        previous_matched_unixtime = response["Item"].get("previous_matched_unixtime", 0) if "Item" in response else 0
        previous_user_count = response["Item"].get("previous_user_count", 0) if "Item" in response else 0

        # フロントエンドが期待する形式に整形
        return create_success_response(
            {
                "total_waiting": total_waiting,
                "ongoing_matches": ongoing_matches,
                "role_counts": role_counts,  # ロール別の待機人数のみ（レート情報なし）
                "previous_matched_unixtime": previous_matched_unixtime,
                "previous_user_count": previous_user_count,
                "ongoing_match_players": ongoing_match_players,  # マッチ中のプレイヤーID
            }
        )

    except Exception as e:
        print(f"get_queue_status error: {e}")
        return create_error_response(500, f"Failed to get queue status: {str(e)}")


def join_queue(event: dict, _context: object) -> dict:
    """
    キューに参加（新設計版）。
    POST /api/queue/join エンドポイントで呼び出される。
    リクエストボディ:
    - blocking: 一緒にマッチしたくないユーザーIDのリスト（オプション）
    - selected_roles: 選択したロールのリスト（必須、最低2つ）
    """
    if is_locked():
        return create_error_response(423, "Match making in progress, please retry later.")

    try:
        print("joinQueue: Starting to process request")

        # 認証情報を取得
        auth0_user_id = event["requestContext"]["authorizer"]["lambda"]["user_id"]
        print(f"joinQueue: Auth0 user_id: {auth0_user_id}")

        # Auth0 user_idからDiscord IDを抽出
        if "|" in auth0_user_id:
            user_id = auth0_user_id.split("|")[-1]
        else:
            user_id = auth0_user_id
        print(f"joinQueue: Final user_id: {user_id}")

        # リクエストボディをパース
        try:
            body = json.loads(event.get("body", "{}"))
            print(f"joinQueue: Request body: {body}")
        except (json.JSONDecodeError, TypeError):
            print("joinQueue: Invalid or missing request body")
            return create_error_response(400, "Invalid request body")

        blocking = body.get("blocking", [])
        selected_roles = body.get("selected_roles", [])

        # すでにキューにいるか確認
        existing = queue_table.get_item(Key={"namespace": NAMESPACE, "user_id": user_id})
        if "Item" in existing:
            print(f"joinQueue: User {user_id} is already in queue")
            return create_error_response(409, "Already in queue")

        # ユーザー情報を取得してペナルティチェック
        user_resp = user_table.get_item(Key={"namespace": NAMESPACE, "user_id": user_id})
        if "Item" not in user_resp:
            print(f"joinQueue: User {user_id} not found")
            return create_error_response(404, "User not found")

        user_item = user_resp["Item"]

        # ペナルティチェック
        penalty_service = PenaltyService()
        can_join, reason = penalty_service.can_join_matchmaking(user_id)
        if not can_join:
            print(f"joinQueue: User {user_id} cannot join due to penalty: {reason}")
            return create_error_response(403, f"マッチングに参加できません: {reason}")

        # ロール情報を解析
        if not selected_roles:
            print("joinQueue: No roles selected")
            return create_error_response(400, "ロールを2つ以上選択してください")

        # 2つ以上のロール選択を必須とする
        if len(selected_roles) < 2:
            print(f"joinQueue: Only {len(selected_roles)} role(s) selected, need at least 2")
            return create_error_response(
                400, "ロールを2つ以上選択してください（現在: {}個）".format(len(selected_roles))
            )

        print(f"joinQueue: Selected roles: {selected_roles}")

        # キューエントリを作成 (簡素化済み)
        queue_entry = {
            "namespace": NAMESPACE,  # Legacy準拠の複合キー
            "user_id": user_id,  # Discord IDを使用
            "blocking": blocking,
            "selected_roles": selected_roles,  # 希望ロールのリスト
            "inqueued_at": int(__import__("time").time()),
        }
        print(f"joinQueue: Created queue entry: {json.dumps(queue_entry, default=str)}")

        # キューに追加
        print("joinQueue: Adding to queue")
        queue_table.put_item(Item=queue_entry)

        # メタ情報を更新（ユーザーIDとロール情報のみ）
        print("joinQueue: Updating queue meta")
        update_queue_meta_on_join(user_id, selected_roles)

        print("joinQueue: Successfully joined queue")
        return create_success_response({"message": "Successfully joined queue"})

    except Exception as e:
        print(f"join_queue error: {e}")
        import traceback

        print(f"join_queue traceback: {traceback.format_exc()}")
        return create_error_response(500, f"Failed to join queue: {str(e)}")


def leave_queue(event: dict, _context: object) -> dict:
    """
    キューから離脱（新設計版）。
    POST /api/queue/leave エンドポイントで呼び出される。
    リクエストボディは空でもOK。
    認証情報からuser_idを取得してキューから削除。
    """
    if is_locked():
        return create_error_response(423, "Match making in progress, please retry later.")

    try:
        # 認証情報を取得
        auth0_user_id = event["requestContext"]["authorizer"]["lambda"]["user_id"]

        # Auth0 user_idからDiscord IDを抽出
        if "|" in auth0_user_id:
            user_id = auth0_user_id.split("|")[-1]
        else:
            user_id = auth0_user_id

        # キューエントリを取得（削除前にロール情報を取得）
        queue_entry = queue_table.get_item(Key={"namespace": NAMESPACE, "user_id": user_id})
        if "Item" not in queue_entry:
            # キューにいない場合はエラーを返さない（冪等性のため）
            return create_success_response({"message": "Not in queue"})

        selected_roles = queue_entry["Item"].get("selected_roles", [])

        # キューから削除
        queue_table.delete_item(Key={"namespace": NAMESPACE, "user_id": user_id})

        # メタ情報を更新（ユーザーIDとロール情報のみ）
        update_queue_meta_on_leave(user_id, selected_roles)

        return create_success_response({"message": "Successfully left queue"})

    except Exception as e:
        print(f"leave_queue error: {e}")
        return create_error_response(500, f"Failed to leave queue: {str(e)}")


def get_my_queue_status(event: dict, _context: object) -> dict:
    """
    自分のキュー状態を取得。
    GET /api/queue/me エンドポイントで呼び出される。
    フロントエンドはUserQueueStatus型を期待:
    - in_queue: boolean (キューにいるかどうか)
    - entry: キューエントリの詳細 (in_queue=trueの場合のみ)

    フロントエンドはgetMyQueueStatusで404をキャッチして
    {in_queue: false}として扱うことがある。
    """
    try:
        # 認証情報を取得
        auth0_user_id = event["requestContext"]["authorizer"]["lambda"]["user_id"]

        # Auth0 user_idからDiscord IDを抽出
        if "|" in auth0_user_id:
            user_id = auth0_user_id.split("|")[-1]
        else:
            user_id = auth0_user_id

        # キューエントリを取得（Discord IDを使用）
        response = queue_table.get_item(Key={"namespace": NAMESPACE, "user_id": user_id})

        if "Item" in response:
            # キューにいる場合
            queue_entry = response["Item"]
            return create_success_response(
                {
                    "in_queue": True,
                    "entry": {
                        "user_id": queue_entry["user_id"],
                        "selected_roles": queue_entry.get("selected_roles", []),
                        "blocking": queue_entry.get("blocking", []),
                        "inqueued_at": queue_entry.get("inqueued_at"),
                    },
                }
            )
        else:
            # キューにいない場合（404を返さず、in_queue: false を返す）
            return create_success_response({"in_queue": False})

    except Exception as e:
        print(f"get_my_queue_status error: {e}")
        return create_error_response(500, f"Failed to get queue status: {str(e)}")


def update_queue_meta_on_join(user_id: str, selected_roles: list):
    """
    キュー参加時にメタ情報を更新（新設計版）。
    ユーザーIDをロール別リストに追加し、総人数をインクリメント。
    レート情報は保存しない。
    """
    try:
        # #META#を取得
        resp = queue_table.get_item(Key={"namespace": NAMESPACE, "user_id": "#META#"})
        if "Item" in resp:
            meta_item = resp["Item"]
            role_queues = meta_item.get(
                "role_queues", {"TOP_LANE": [], "SUPPORT": [], "MIDDLE": [], "BOTTOM_LANE": [], "TANK": []}
            )
            total_waiting = meta_item.get("total_waiting", 0)
        else:
            # #META#が存在しない場合は初期化
            ensure_meta_exists()
            role_queues = {"TOP_LANE": [], "SUPPORT": [], "MIDDLE": [], "BOTTOM_LANE": [], "TANK": []}
            total_waiting = 0

        # 選択したロールそれぞれにユーザーIDを追加
        for role in selected_roles:
            if role in role_queues and user_id not in role_queues[role]:
                role_queues[role].append(user_id)
                print(f"update_queue_meta_on_join: Added {user_id} to {role}, now: {role_queues[role]}")

        # 総待機人数を計算（ユニークなユーザーIDの数） - 修正版
        all_users = set()
        for users in role_queues.values():
            all_users.update(users)
        total_waiting = len(all_users)

        # メタデータを更新
        queue_table.update_item(
            Key={"namespace": NAMESPACE, "user_id": "#META#"},
            UpdateExpression="SET role_queues = :rq, total_waiting = :tw",
            ExpressionAttributeValues={":rq": role_queues, ":tw": total_waiting},
        )

    except Exception as e:
        print(f"update_queue_meta_on_join error: {e}")
        raise  # エラーを上位に伝播させる


def update_queue_meta_on_leave(user_id: str, selected_roles: list):
    """
    キュー離脱時にメタ情報を更新（新設計版）。
    ユーザーIDをロール別リストから削除し、総人数をデクリメント。
    レート情報の更新は不要。
    """
    try:
        # #META#を取得
        resp = queue_table.get_item(Key={"namespace": NAMESPACE, "user_id": "#META#"})
        if "Item" not in resp:
            # メタデータが存在しない場合は何もしない
            return

        meta_item = resp["Item"]
        role_queues = meta_item.get("role_queues", {})
        total_waiting = meta_item.get("total_waiting", 0)

        # 選択したロールそれぞれからユーザーIDを削除
        for role in selected_roles:
            if role in role_queues and user_id in role_queues[role]:
                role_queues[role].remove(user_id)

        # 総待機人数を計算（ユニークなユーザーIDの数） - 修正版
        all_users = set()
        for users in role_queues.values():
            all_users.update(users)
        total_waiting = len(all_users)

        # メタデータを更新
        queue_table.update_item(
            Key={"namespace": NAMESPACE, "user_id": "#META#"},
            UpdateExpression="SET role_queues = :rq, total_waiting = :tw",
            ExpressionAttributeValues={":rq": role_queues, ":tw": total_waiting},
        )

    except Exception as e:
        print(f"update_queue_meta_on_leave error: {e}")
        raise  # エラーを上位に伝播させる


# 旧関数（マッチメイキングから呼ばれる可能性があるため残す）
def update_queue_meta():
    """
    旧設計の関数。マッチメイキング処理から呼ばれる可能性があるため残す。
    全キューエントリをスキャンして、role_dataを再計算する。

    新設計では基本的に使用しないが、マッチメイキング直前にレート情報を
    取得する必要がある場合に使用される。
    """
    try:
        # 全キューエントリを取得（#META#以外）
        response = queue_table.scan(
            FilterExpression="user_id <> :meta_key AND namespace = :namespace",
            ExpressionAttributeValues={":meta_key": "#META#", ":namespace": NAMESPACE},
        )

        players = response.get("Items", [])

        # ロール別キューのみ作成（レート情報は不要）
        role_queues = {"TOP_LANE": [], "SUPPORT": [], "MIDDLE": [], "BOTTOM_LANE": [], "TANK": []}

        for player in players:
            user_id = player.get("user_id", "")
            selected_roles = player.get("selected_roles", [])

            # 選択したロールそれぞれに追加
            for role in selected_roles:
                if role in role_queues:
                    if user_id not in role_queues[role]:
                        role_queues[role].append(user_id)

        # 総待機人数を計算（重複なし）
        total_waiting = len(players)

        # メタデータを更新
        queue_table.update_item(
            Key={"namespace": NAMESPACE, "user_id": "#META#"},
            UpdateExpression="SET role_queues = :rq, total_waiting = :tw, #lock = :lk, ongoing_matches = :om",
            ExpressionAttributeNames={"#lock": "lock"},  # "lock" は予約語なのでエスケープ
            ExpressionAttributeValues={
                ":rq": role_queues,
                ":tw": total_waiting,
                ":lk": 0,
                ":om": 0,
            },
        )

    except Exception as e:
        print(f"update_queue_meta error: {e}")


def debug_queue_status(event: dict, _context: object) -> dict:
    """
    デバッグ用: キューの詳細状態を取得。
    GET /api/debug/queue エンドポイントで呼び出される。
    """
    try:
        # 全キューエントリを取得
        response = queue_table.scan(
            FilterExpression="namespace = :namespace", ExpressionAttributeValues={":namespace": NAMESPACE}
        )

        items = response.get("Items", [])

        # #META#とユーザーエントリを分離
        meta_item = None
        user_entries = []

        for item in items:
            if item.get("user_id") == "#META#":
                meta_item = item
            else:
                user_entries.append(item)

        return create_success_response({"meta": meta_item, "entries": user_entries, "total_entries": len(user_entries)})

    except Exception as e:
        print(f"debug_queue_status error: {e}")
        return create_error_response(500, f"Failed to get debug queue status: {str(e)}")
