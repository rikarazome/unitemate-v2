import os

import boto3
from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

from ..models.record import Record, RecordSearchFilter


class RecordRepository:
    def __init__(self):
        self.dynamodb = boto3.resource("dynamodb")
        self.table = self.dynamodb.Table(os.environ["RECORDS_TABLE_NAME"])

    def get_by_record_id(self, record_id: str) -> Record | None:
        try:
            response = self.table.get_item(Key={"record_id": record_id})
            if "Item" not in response:
                return None
            return Record(**response["Item"])
        except ClientError as e:
            print(f"Error getting record by record_id {record_id}: {e}")
            return None

    def get_user_records(self, user_id: str, limit: int = 50) -> list[Record]:
        try:
            response = self.table.query(
                IndexName="UserStartedDateIndex",
                KeyConditionExpression=Key("user_id").eq(user_id),
                ScanIndexForward=False,  # 最新順（started_dateで降順）
                Limit=limit,
            )
            return [Record(**item) for item in response.get("Items", [])]
        except ClientError as e:
            print(f"Error getting user records for {user_id}: {e}")
            return []

    def get_user_records_by_date_range(
        self, user_id: str, start_date: int, end_date: int, limit: int = 50
    ) -> list[Record]:
        try:
            response = self.table.query(
                IndexName="UserStartedDateIndex",
                KeyConditionExpression=Key("user_id").eq(user_id) & Key("started_date").between(start_date, end_date),
                ScanIndexForward=False,
                Limit=limit,
            )
            return [Record(**item) for item in response.get("Items", [])]
        except ClientError as e:
            print(f"Error getting user records by date range for {user_id}: {e}")
            return []

    def get_records_by_match_id(self, match_id: str) -> list[Record]:
        try:
            response = self.table.scan(FilterExpression=Attr("match_id").eq(match_id))
            return [Record(**item) for item in response.get("Items", [])]
        except ClientError as e:
            print(f"Error getting records by match_id {match_id}: {e}")
            return []

    def search_records(self, search_filter: RecordSearchFilter) -> list[Record]:
        try:
            # フィルター条件を構築
            filter_expression = None

            if search_filter.user_id:
                # ユーザーIDが指定されている場合はGSIを使用
                return self.get_user_records(search_filter.user_id, search_filter.limit)

            # その他の条件でのスキャン
            if search_filter.pokemon:
                condition = Attr("pokemon").eq(search_filter.pokemon)
                filter_expression = condition if filter_expression is None else filter_expression & condition

            if search_filter.is_winner is not None:
                condition = Attr("is_winner").eq(search_filter.is_winner)
                filter_expression = condition if filter_expression is None else filter_expression & condition

            if search_filter.start_date:
                condition = Attr("started_date").gte(search_filter.start_date)
                filter_expression = condition if filter_expression is None else filter_expression & condition

            if search_filter.end_date:
                condition = Attr("started_date").lte(search_filter.end_date)
                filter_expression = condition if filter_expression is None else filter_expression & condition

            if filter_expression:
                response = self.table.scan(FilterExpression=filter_expression, Limit=search_filter.limit)
            else:
                response = self.table.scan(Limit=search_filter.limit)

            records = [Record(**item) for item in response.get("Items", [])]
            # started_dateで降順ソート
            return sorted(records, key=lambda x: x.started_date, reverse=True)

        except ClientError as e:
            print(f"Error searching records: {e}")
            return []

    def create(self, record: Record) -> bool:
        try:
            # record_idの重複チェック
            existing_record = self.get_by_record_id(record.record_id)
            if existing_record:
                print(f"Record with record_id {record.record_id} already exists")
                return False

            self.table.put_item(Item=record.model_dump())
            return True
        except ClientError as e:
            print(f"Error creating record: {e}")
            return False

    def create_multiple(self, records: list[Record]) -> bool:
        try:
            with self.table.batch_writer() as batch:
                for record in records:
                    batch.put_item(Item=record.model_dump())
            return True
        except ClientError as e:
            print(f"Error creating multiple records: {e}")
            return False

    def update(self, record: Record) -> bool:
        try:
            self.table.put_item(Item=record.model_dump())
            return True
        except ClientError as e:
            print(f"Error updating record: {e}")
            return False

    def delete(self, record_id: str) -> bool:
        try:
            self.table.delete_item(Key={"record_id": record_id})
            return True
        except ClientError as e:
            print(f"Error deleting record {record_id}: {e}")
            return False

    def delete_by_match_id(self, match_id: str) -> bool:
        try:
            records = self.get_records_by_match_id(match_id)
            with self.table.batch_writer() as batch:
                for record in records:
                    batch.delete_item(Key={"record_id": record.record_id})
            return True
        except ClientError as e:
            print(f"Error deleting records by match_id {match_id}: {e}")
            return False

    def get_user_stats(self, user_id: str, days: int = 30) -> dict:
        """ユーザーの統計情報を取得"""
        try:
            from datetime import datetime, timedelta

            # 指定日数前のUNIXタイムスタンプを計算
            start_date = int((datetime.now() - timedelta(days=days)).timestamp())

            records = self.get_user_records_by_date_range(user_id, start_date, int(datetime.now().timestamp()))

            if not records:
                return {
                    "total_matches": 0,
                    "wins": 0,
                    "losses": 0,
                    "win_rate": 0.0,
                    "total_rate_change": 0,
                    "avg_rate_change": 0.0,
                }

            wins = sum(1 for r in records if r.is_winner)
            losses = len(records) - wins
            total_rate_change = sum(r.rate_delta for r in records)

            return {
                "total_matches": len(records),
                "wins": wins,
                "losses": losses,
                "win_rate": (wins / len(records)) * 100 if records else 0.0,
                "total_rate_change": total_rate_change,
                "avg_rate_change": total_rate_change / len(records) if records else 0.0,
            }
        except ClientError as e:
            print(f"Error getting user stats for {user_id}: {e}")
            return {}
