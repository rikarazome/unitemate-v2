import logging
import os

import boto3
from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

from ..models.queue import QueueEntry, QueueMeta

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


class QueueRepository:
    def __init__(self):
        self.dynamodb = boto3.resource("dynamodb")
        self.table = self.dynamodb.Table(os.environ["QUEUE_TABLE_NAME"])
        self.namespace = "default"
        self.meta_key = "#META#"

    def get_entry_by_user(self, user_id: str) -> QueueEntry | None:
        """ユーザーIDでキューエントリを取得（queue_serviceとの互換性のため）"""
        return self.get_queue_entry(user_id)

    def get_queue_entry(self, user_id: str) -> QueueEntry | None:
        try:
            response = self.table.get_item(Key={"namespace": self.namespace, "user_id": user_id})
            if "Item" not in response:
                return None
            return QueueEntry(**response["Item"])
        except ClientError as e:
            print(f"Error getting queue entry for user {user_id}: {e}")
            return None

    def get_all_entries(self) -> list[QueueEntry]:
        try:
            response = self.table.scan(FilterExpression=Attr("user_id").ne(self.meta_key))
            return [QueueEntry(**item) for item in response.get("Items", [])]
        except ClientError as e:
            print(f"Error getting all queue entries: {e}")
            return []

    def add_entry(self, entry: QueueEntry) -> bool:
        try:
            # 既存エントリーチェック
            existing = self.get_queue_entry(entry.user_id)
            if existing:
                print(f"User {entry.user_id} is already in queue")
                return False

            self.table.put_item(Item=entry.model_dump())
            self._increment_total_queued()
            return True
        except ClientError as e:
            print(f"Error adding queue entry: {e}")
            return False

    def remove_entry(self, user_id: str) -> bool:
        try:
            self.table.delete_item(Key={"namespace": self.namespace, "user_id": user_id})
            return True
        except ClientError as e:
            print(f"Error removing queue entry for user {user_id}: {e}")
            return False

    def remove_multiple_entries(self, user_ids: list[str]) -> bool:
        try:
            with self.table.batch_writer() as batch:
                for user_id in user_ids:
                    batch.delete_item(Key={"namespace": self.namespace, "user_id": user_id})
            return True
        except ClientError as e:
            print(f"Error removing multiple queue entries: {e}")
            return False

    def update_entry(self, entry: QueueEntry) -> bool:
        try:
            self.table.put_item(Item=entry.model_dump())
            return True
        except ClientError as e:
            print(f"Error updating queue entry: {e}")
            return False

    # メタデータ操作
    def get_meta(self) -> QueueMeta | None:
        try:
            response = self.table.get_item(Key={"namespace": self.namespace, "user_id": self.meta_key})
            if "Item" not in response:
                # メタデータが存在しない場合は初期化
                logger.warning(
                    f"Queue META not found for namespace={self.namespace}, user_id={self.meta_key}. Creating new META..."
                )
                meta = QueueMeta()
                self._init_meta(meta)
                return meta

            # デバッグ: 取得したメタデータの内容を確認
            item = response["Item"]
            logger.info(
                f"Retrieved META: latest_match_id={item.get('latest_match_id', 'N/A')}, unused_vc count={len(item.get('unused_vc', []))}"
            )
            return QueueMeta(**item)
        except ClientError as e:
            print(f"Error getting queue meta: {e}")
            return None

    def _init_meta(self, meta: QueueMeta) -> bool:
        try:
            item = meta.model_dump()
            item["namespace"] = self.namespace
            item["user_id"] = self.meta_key
            self.table.put_item(Item=item)
            return True
        except ClientError as e:
            print(f"Error initializing queue meta: {e}")
            return False

    def acquire_lock(self) -> bool:
        try:
            # 条件付きでロックを取得（lock=0の場合のみ）
            self.table.update_item(
                Key={"namespace": self.namespace, "user_id": self.meta_key},
                UpdateExpression="SET #lk = :locked",
                ConditionExpression="attribute_not_exists(#lk) OR #lk = :unlocked",
                ExpressionAttributeNames={"#lk": "lock"},
                ExpressionAttributeValues={":locked": 1, ":unlocked": 0},
            )
            return True
        except ClientError as e:
            if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
                print("Lock is already acquired")
                return False
            print(f"Error acquiring lock: {e}")
            return False

    def release_lock(self) -> bool:
        try:
            self.table.update_item(
                Key={"namespace": self.namespace, "user_id": self.meta_key},
                UpdateExpression="SET #lk = :unlocked",
                ExpressionAttributeNames={"#lk": "lock"},
                ExpressionAttributeValues={":unlocked": 0},
            )
            return True
        except ClientError as e:
            print(f"Error releasing lock: {e}")
            return False

    def update_meta_rate_lists(self, rate_list: list[int]) -> bool:
        try:
            self.table.update_item(
                Key={"namespace": self.namespace, "user_id": self.meta_key},
                UpdateExpression="SET rate_list = :rl",
                ExpressionAttributeValues={":rl": rate_list},
            )
            return True
        except ClientError as e:
            print(f"Error updating meta rate lists: {e}")
            return False

    def update_latest_match_id(self, match_id: int) -> bool:
        try:
            self.table.update_item(
                Key={"namespace": self.namespace, "user_id": self.meta_key},
                UpdateExpression="SET latest_match_id = :id",
                ExpressionAttributeValues={":id": match_id},
            )
            return True
        except ClientError as e:
            print(f"Error updating latest match ID: {e}")
            return False

    def use_vc_channels(self, count: int) -> list[int] | None:
        """未使用のVC番号を指定数取得して使用済みにする"""
        try:
            meta = self.get_meta()
            if not meta or len(meta.unused_vc) < count:
                return None

            # 必要数のVC番号を取得
            used_vcs = meta.unused_vc[:count]
            remaining_vcs = meta.unused_vc[count:]

            self.table.update_item(
                Key={"namespace": self.namespace, "user_id": self.meta_key},
                UpdateExpression="SET unused_vc = :vc",
                ExpressionAttributeValues={":vc": remaining_vcs},
            )
            return used_vcs
        except ClientError as e:
            print(f"Error using VC channels: {e}")
            return None

    def return_vc_channels(self, vc_numbers: list[int]) -> bool:
        """使用済みのVC番号を返却（リストの最後に追加）"""
        try:
            meta = self.get_meta()
            if not meta:
                return False

            # VC番号を返却（最後に追加、重複を除去）
            # 既存のunused_vcから返却するVCを除外（念のため重複防止）
            existing_vcs = [vc for vc in meta.unused_vc if vc not in vc_numbers]
            # 最後に返却するVCを追加
            updated_vcs = existing_vcs + vc_numbers

            self.table.update_item(
                Key={"namespace": self.namespace, "user_id": self.meta_key},
                UpdateExpression="SET unused_vc = :vc",
                ExpressionAttributeValues={":vc": updated_vcs},
            )
            return True
        except ClientError as e:
            print(f"Error returning VC channels: {e}")
            return False

    def _increment_total_queued(self) -> bool:
        try:
            self.table.update_item(
                Key={"namespace": self.namespace, "user_id": self.meta_key},
                UpdateExpression="SET total_queued = if_not_exists(total_queued, :zero) + :inc",
                ExpressionAttributeValues={":zero": 0, ":inc": 1},
            )
            return True
        except ClientError as e:
            print(f"Error incrementing total queued: {e}")
            return False

    def increment_total_matched(self, count: int = 1) -> bool:
        try:
            self.table.update_item(
                Key={"namespace": self.namespace, "user_id": self.meta_key},
                UpdateExpression="SET total_matched = if_not_exists(total_matched, :zero) + :inc",
                ExpressionAttributeValues={":zero": 0, ":inc": count},
            )
            return True
        except ClientError as e:
            print(f"Error incrementing total matched: {e}")
            return False

    def update_ongoing_matches(self, count: int) -> bool:
        try:
            self.table.update_item(
                Key={"namespace": self.namespace, "user_id": self.meta_key},
                UpdateExpression="SET ongoing_matches = :count",
                ExpressionAttributeValues={":count": count},
            )
            return True
        except ClientError as e:
            print(f"Error updating ongoing matches: {e}")
            return False

    def update_previous_matched_unixtime(self, unixtime: int) -> bool:
        """前回マッチ成立時刻を更新"""
        try:
            self.table.update_item(
                Key={"namespace": self.namespace, "user_id": self.meta_key},
                UpdateExpression="SET previous_matched_unixtime = :time",
                ExpressionAttributeValues={":time": unixtime},
            )
            return True
        except ClientError as e:
            print(f"Error updating previous matched unixtime: {e}")
            return False

    def update_previous_user_count(self, user_count: int) -> bool:
        """前回マッチメイキング時のユーザー数を更新"""
        try:
            self.table.update_item(
                Key={"namespace": self.namespace, "user_id": self.meta_key},
                UpdateExpression="SET previous_user_count = :count",
                ExpressionAttributeValues={":count": user_count},
            )
            return True
        except ClientError as e:
            print(f"Error updating previous user count: {e}")
            return False

    def update_matchmaking_metadata(self, unixtime: int, user_count: int, match_id: int = None) -> bool:
        """マッチメイキング関連のメタデータを一括更新"""
        try:
            update_expression = "SET previous_matched_unixtime = :time, previous_user_count = :count"
            expression_values = {":time": unixtime, ":count": user_count}

            if match_id is not None:
                update_expression += ", latest_match_id = :match_id"
                expression_values[":match_id"] = match_id

            self.table.update_item(
                Key={"namespace": self.namespace, "user_id": self.meta_key},
                UpdateExpression=update_expression,
                ExpressionAttributeValues=expression_values,
            )
            return True
        except ClientError as e:
            print(f"Error updating matchmaking metadata: {e}")
            return False

    def add_ongoing_matches(self, match_ids: list[int]) -> bool:
        """進行中試合IDリストに追加"""
        try:
            # 現在の進行中試合IDリストを取得
            meta = self.get_meta()
            if not meta:
                return False

            current_ongoing = getattr(meta, "ongoing_match_ids", [])

            # 新しい試合IDを追加（重複を避ける）
            updated_ongoing = list(set(current_ongoing + match_ids))

            self.table.update_item(
                Key={"namespace": self.namespace, "user_id": self.meta_key},
                UpdateExpression="SET ongoing_match_ids = :ids",
                ExpressionAttributeValues={":ids": updated_ongoing},
            )
            return True
        except ClientError as e:
            print(f"Error adding ongoing matches: {e}")
            return False

    def remove_ongoing_matches(self, match_ids: list[int]) -> bool:
        """進行中試合IDリストから削除"""
        try:
            # 現在の進行中試合IDリストを取得
            meta = self.get_meta()
            if not meta:
                return False

            current_ongoing = getattr(meta, "ongoing_match_ids", [])

            # 指定された試合IDを削除
            updated_ongoing = [mid for mid in current_ongoing if mid not in match_ids]

            self.table.update_item(
                Key={"namespace": self.namespace, "user_id": self.meta_key},
                UpdateExpression="SET ongoing_match_ids = :ids",
                ExpressionAttributeValues={":ids": updated_ongoing},
            )
            return True
        except ClientError as e:
            print(f"Error removing ongoing matches: {e}")
            return False

    def get_ongoing_match_ids(self) -> list[int]:
        """進行中試合IDリストを取得"""
        try:
            meta = self.get_meta()
            if not meta:
                return []

            return getattr(meta, "ongoing_match_ids", [])
        except Exception as e:
            print(f"Error getting ongoing match IDs: {e}")
            return []
