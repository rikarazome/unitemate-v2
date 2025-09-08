import os

import boto3
from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

from ..models.match import Match


class MatchRepository:
    def __init__(self):
        self.dynamodb = boto3.resource("dynamodb")
        self.table = self.dynamodb.Table(os.environ["MATCHES_TABLE_NAME"])

    def get_by_match_id(self, match_id: str) -> Match | None:
        try:
            response = self.table.get_item(Key={"match_id": match_id})
            if "Item" not in response:
                return None
            return Match(**response["Item"])
        except ClientError as e:
            print(f"Error getting match by match_id {match_id}: {e}")
            return None

    def get_by_status(self, status: str, limit: int = 50) -> list[Match]:
        try:
            response = self.table.query(
                IndexName="StatusIndex",
                KeyConditionExpression=Key("status").eq(status),
                ScanIndexForward=False,  # 最新順
                Limit=limit,
            )
            return [Match(**item) for item in response.get("Items", [])]
        except ClientError as e:
            print(f"Error getting matches by status {status}: {e}")
            return []

    def get_recent_matches(self, limit: int = 50) -> list[Match]:
        try:
            response = self.table.scan(
                Limit=limit,
            )
            matches = [Match(**item) for item in response.get("Items", [])]
            # created_atで降順ソート
            return sorted(matches, key=lambda x: x.created_at, reverse=True)
        except ClientError as e:
            print(f"Error getting recent matches: {e}")
            return []

    def get_user_matches(self, user_id: str, limit: int = 50) -> list[Match]:
        try:
            # ユーザーが参加したマッチを取得（スキャンが必要）
            response = self.table.scan(
                FilterExpression=Attr("team_a").contains({"user_id": user_id})
                | Attr("team_b").contains({"user_id": user_id}),
                Limit=limit,
            )
            matches = [Match(**item) for item in response.get("Items", [])]
            # created_atで降順ソート
            return sorted(matches, key=lambda x: x.created_at, reverse=True)
        except ClientError as e:
            print(f"Error getting user matches for {user_id}: {e}")
            return []

    def create(self, match: Match) -> bool:
        try:
            # match_idの重複チェック
            existing_match = self.get_by_match_id(match.match_id)
            if existing_match:
                print(f"Match with match_id {match.match_id} already exists")
                return False

            self.table.put_item(Item=match.model_dump())
            return True
        except ClientError as e:
            print(f"Error creating match: {e}")
            return False

    def update(self, match: Match) -> bool:
        try:
            self.table.put_item(Item=match.model_dump())
            return True
        except ClientError as e:
            print(f"Error updating match: {e}")
            return False

    def delete(self, match_id: str) -> bool:
        try:
            self.table.delete_item(Key={"match_id": match_id})
            return True
        except ClientError as e:
            print(f"Error deleting match {match_id}: {e}")
            return False

    def get_active_matches(self) -> list[Match]:
        """進行中のマッチを取得"""
        return self.get_by_status("matched")

    def get_completed_matches(self, limit: int = 100) -> list[Match]:
        """完了したマッチを取得"""
        return self.get_by_status("done", limit)
