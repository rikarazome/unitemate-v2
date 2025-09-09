import os

import boto3
from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

from ..models.achievement import Achievement, AchievementType, UserAchievement


class AchievementRepository:
    def __init__(self):
        self.dynamodb = boto3.resource("dynamodb")
        self.table = self.dynamodb.Table(os.environ["ACHIEVEMENTS_TABLE_NAME"])

    def get_achievement(self, achievement_id: str) -> Achievement | None:
        """実績定義を取得（管理データ）"""
        try:
            response = self.table.get_item(Key={"user_id": "#ACHIEVEMENT#", "achievement_id": achievement_id})
            if "Item" not in response:
                return None
            item = response["Item"]
            # user_idフィールドを除去
            item.pop("user_id", None)
            return Achievement(**item)
        except ClientError as e:
            print(f"Error getting achievement {achievement_id}: {e}")
            return None

    def get_all_achievements(self, include_inactive: bool = False) -> list[Achievement]:
        """全実績定義を取得"""
        try:
            if include_inactive:
                response = self.table.query(KeyConditionExpression=Key("user_id").eq("#ACHIEVEMENT#"))
            else:
                response = self.table.query(
                    KeyConditionExpression=Key("user_id").eq("#ACHIEVEMENT#"),
                    FilterExpression=Attr("is_active").eq(True),
                )

            achievements = []
            for item in response.get("Items", []):
                item.pop("user_id", None)
                achievements.append(Achievement(**item))
            return achievements
        except ClientError as e:
            print(f"Error getting all achievements: {e}")
            return []

    def get_achievements_by_type(self, achievement_type: AchievementType) -> list[Achievement]:
        """タイプ別実績を取得"""
        try:
            response = self.table.query(
                IndexName="EarnedAtIndex",
                KeyConditionExpression=Key("achievement_id").begins_with(f"{achievement_type.value}_"),
                FilterExpression=Attr("user_id").eq("#ACHIEVEMENT#") & Attr("is_active").eq(True),
            )

            achievements = []
            for item in response.get("Items", []):
                item.pop("user_id", None)
                achievements.append(Achievement(**item))
            return achievements
        except ClientError as e:
            print(f"Error getting achievements by type {achievement_type}: {e}")
            return []

    def create_achievement(self, achievement: Achievement) -> bool:
        """実績定義を作成"""
        try:
            item = achievement.model_dump()
            item["user_id"] = "#ACHIEVEMENT#"

            self.table.put_item(Item=item)
            return True
        except ClientError as e:
            print(f"Error creating achievement: {e}")
            return False

    def update_achievement(self, achievement: Achievement) -> bool:
        """実績定義を更新"""
        try:
            item = achievement.model_dump()
            item["user_id"] = "#ACHIEVEMENT#"

            self.table.put_item(Item=item)
            return True
        except ClientError as e:
            print(f"Error updating achievement: {e}")
            return False

    def delete_achievement(self, achievement_id: str) -> bool:
        """実績定義を削除"""
        try:
            self.table.delete_item(Key={"user_id": "#ACHIEVEMENT#", "achievement_id": achievement_id})
            return True
        except ClientError as e:
            print(f"Error deleting achievement {achievement_id}: {e}")
            return False

    # ユーザー実績関連
    def get_user_achievement(self, user_id: str, achievement_id: str) -> UserAchievement | None:
        """ユーザー実績を取得"""
        try:
            response = self.table.get_item(Key={"user_id": user_id, "achievement_id": achievement_id})
            if "Item" not in response:
                return None
            return UserAchievement(**response["Item"])
        except ClientError as e:
            print(f"Error getting user achievement for {user_id}, {achievement_id}: {e}")
            return None

    def get_user_achievements(self, user_id: str, completed_only: bool = False) -> list[UserAchievement]:
        """ユーザーの全実績を取得"""
        try:
            if completed_only:
                response = self.table.query(
                    KeyConditionExpression=Key("user_id").eq(user_id), FilterExpression=Attr("is_completed").eq(True)
                )
            else:
                response = self.table.query(
                    KeyConditionExpression=Key("user_id").eq(user_id),
                    FilterExpression=Attr("achievement_id").ne("#ACHIEVEMENT#"),  # 実績定義を除外
                )

            return [UserAchievement(**item) for item in response.get("Items", [])]
        except ClientError as e:
            print(f"Error getting user achievements for {user_id}: {e}")
            return []

    def get_recent_achievements(self, user_id: str, limit: int = 10) -> list[UserAchievement]:
        """最近獲得した実績を取得"""
        try:
            response = self.table.query(
                KeyConditionExpression=Key("user_id").eq(user_id),
                FilterExpression=Attr("is_completed").eq(True),
                ScanIndexForward=False,  # 最新順
                Limit=limit,
            )

            achievements = [UserAchievement(**item) for item in response.get("Items", [])]
            # earned_atで降順ソート
            return sorted(achievements, key=lambda x: x.earned_at, reverse=True)
        except ClientError as e:
            print(f"Error getting recent achievements for {user_id}: {e}")
            return []

    def create_user_achievement(self, user_achievement: UserAchievement) -> bool:
        """ユーザー実績を作成"""
        try:
            self.table.put_item(Item=user_achievement.model_dump())
            return True
        except ClientError as e:
            print(f"Error creating user achievement: {e}")
            return False

    def update_user_achievement(self, user_achievement: UserAchievement) -> bool:
        """ユーザー実績を更新"""
        try:
            self.table.put_item(Item=user_achievement.model_dump())
            return True
        except ClientError as e:
            print(f"Error updating user achievement: {e}")
            return False

    def delete_user_achievement(self, user_id: str, achievement_id: str) -> bool:
        """ユーザー実績を削除"""
        try:
            self.table.delete_item(Key={"user_id": user_id, "achievement_id": achievement_id})
            return True
        except ClientError as e:
            print(f"Error deleting user achievement for {user_id}, {achievement_id}: {e}")
            return False

    def get_leaderboard_by_achievement(self, achievement_id: str, limit: int = 50) -> list[UserAchievement]:
        """実績のリーダーボード（最速達成者順）を取得"""
        try:
            response = self.table.query(
                IndexName="EarnedAtIndex",
                KeyConditionExpression=Key("achievement_id").eq(achievement_id),
                FilterExpression=Attr("is_completed").eq(True),
                ScanIndexForward=True,  # 古い順（最速達成順）
                Limit=limit,
            )

            return [UserAchievement(**item) for item in response.get("Items", [])]
        except ClientError as e:
            print(f"Error getting leaderboard for achievement {achievement_id}: {e}")
            return []

    def get_achievement_stats(self, achievement_id: str) -> dict:
        """実績の統計情報を取得"""
        try:
            # 完了者数を取得
            response = self.table.query(
                IndexName="EarnedAtIndex",
                KeyConditionExpression=Key("achievement_id").eq(achievement_id),
                FilterExpression=Attr("is_completed").eq(True),
                Select="COUNT",
            )
            completed_count = response.get("Count", 0)

            # 進行中の人数を取得
            response = self.table.query(
                IndexName="EarnedAtIndex",
                KeyConditionExpression=Key("achievement_id").eq(achievement_id),
                FilterExpression=Attr("is_completed").eq(False),
                Select="COUNT",
            )
            in_progress_count = response.get("Count", 0)

            return {
                "achievement_id": achievement_id,
                "completed_count": completed_count,
                "in_progress_count": in_progress_count,
                "total_attempts": completed_count + in_progress_count,
            }
        except ClientError as e:
            print(f"Error getting achievement stats for {achievement_id}: {e}")
            return {}
