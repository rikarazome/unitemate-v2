"""Season management service."""

import os
from datetime import datetime
from typing import Optional

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from ..models.season import Season, SeasonCreateRequest, SeasonUpdateRequest


class SeasonService:
    """シーズン管理サービス."""

    def __init__(self):
        """初期化."""
        self.dynamodb = boto3.resource("dynamodb")
        self.table = self.dynamodb.Table(os.environ["MASTER_DATA_TABLE_NAME"])

    def get_all_seasons(self) -> list[Season]:
        """全シーズンを取得."""
        try:
            response = self.table.query(
                KeyConditionExpression=Key("data_type").eq("SEASON"),
                ScanIndexForward=False,  # 最新順
            )
            return [Season(**item) for item in response.get("Items", [])]
        except ClientError as e:
            print(f"Error getting all seasons: {e}")
            return []

    def get_season_by_id(self, season_id: str) -> Optional[Season]:
        """シーズンIDで取得."""
        try:
            response = self.table.get_item(Key={"data_type": "SEASON", "id": season_id})
            if "Item" in response:
                return Season(**response["Item"])
            return None
        except ClientError as e:
            print(f"Error getting season {season_id}: {e}")
            return None

    def get_active_season(self) -> Optional[Season]:
        """現在アクティブなシーズンを取得."""
        try:
            current_time = int(datetime.now().timestamp())
            response = self.table.query(KeyConditionExpression=Key("data_type").eq("SEASON"))
            
            for item in response.get("Items", []):
                season = Season(**item)
                if season.is_active and season.start_date <= current_time <= season.end_date:
                    return season
            return None
        except ClientError as e:
            print(f"Error getting active season: {e}")
            return None

    def is_season_active_now(self) -> bool:
        """現在がシーズン期間中かどうかを判定."""
        active_season = self.get_active_season()
        return active_season is not None

    def create_season(self, request: SeasonCreateRequest) -> bool:
        """新しいシーズンを作成."""
        try:
            # 既存シーズンIDの重複チェック
            existing_season = self.get_season_by_id(request.id)
            if existing_season:
                print(f"Season with ID {request.id} already exists")
                return False

            # 新しいシーズンデータを作成
            now = int(datetime.now().timestamp())
            season = Season(
                data_type="SEASON",
                id=request.id,
                name=request.name,
                description=request.description,
                start_date=request.start_date,
                end_date=request.end_date,
                image_url=request.image_url,
                theme_color=request.theme_color or "#ff6b35",
                is_active=False,  # 作成時は非アクティブ
                created_at=now,
                updated_at=now,
            )

            self.table.put_item(Item=season.model_dump())
            return True
        except ClientError as e:
            print(f"Error creating season: {e}")
            return False

    def update_season(self, season_id: str, request: SeasonUpdateRequest) -> bool:
        """既存シーズンを更新."""
        try:
            # 既存シーズンを取得
            existing_season = self.get_season_by_id(season_id)
            if not existing_season:
                print(f"Season {season_id} not found")
                return False

            # 更新データを準備
            update_data = existing_season.model_dump()
            
            # 更新フィールドを適用
            if request.name is not None:
                update_data["name"] = request.name
            if request.description is not None:
                update_data["description"] = request.description
            if request.start_date is not None:
                update_data["start_date"] = request.start_date
            if request.end_date is not None:
                update_data["end_date"] = request.end_date
            if request.image_url is not None:
                update_data["image_url"] = request.image_url
            if request.theme_color is not None:
                update_data["theme_color"] = request.theme_color
            if request.is_active is not None:
                update_data["is_active"] = request.is_active
                
                # アクティブにする場合、他のシーズンを非アクティブにする
                if request.is_active:
                    self._deactivate_all_seasons()

            update_data["updated_at"] = int(datetime.now().timestamp())

            self.table.put_item(Item=update_data)
            return True
        except ClientError as e:
            print(f"Error updating season {season_id}: {e}")
            return False

    def delete_season(self, season_id: str) -> bool:
        """シーズンを削除."""
        try:
            self.table.delete_item(Key={"data_type": "SEASON", "id": season_id})
            return True
        except ClientError as e:
            print(f"Error deleting season {season_id}: {e}")
            return False

    def activate_season(self, season_id: str) -> bool:
        """指定したシーズンをアクティブにする（他は自動的に非アクティブ）."""
        try:
            # 他の全シーズンを非アクティブにする
            self._deactivate_all_seasons()
            
            # 指定シーズンをアクティブにする
            update_request = SeasonUpdateRequest(is_active=True)
            return self.update_season(season_id, update_request)
        except Exception as e:
            print(f"Error activating season {season_id}: {e}")
            return False

    def _deactivate_all_seasons(self) -> None:
        """全シーズンを非アクティブにする."""
        try:
            seasons = self.get_all_seasons()
            for season in seasons:
                if season.is_active:
                    season.is_active = False
                    season.updated_at = int(datetime.now().timestamp())
                    self.table.put_item(Item=season.model_dump())
        except Exception as e:
            print(f"Error deactivating all seasons: {e}")

    def get_next_season(self) -> Optional[Season]:
        """次に開始予定のシーズンを取得."""
        try:
            current_time = int(datetime.now().timestamp())
            response = self.table.query(KeyConditionExpression=Key("data_type").eq("SEASON"))
            
            future_seasons = []
            for item in response.get("Items", []):
                season = Season(**item)
                if season.start_date > current_time:
                    future_seasons.append(season)
            
            # 開始日が最も近いシーズンを返す
            if future_seasons:
                return min(future_seasons, key=lambda s: s.start_date)
            return None
        except ClientError as e:
            print(f"Error getting next season: {e}")
            return None