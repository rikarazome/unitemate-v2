import os
from datetime import datetime

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from ..models.user import User


class UserRepository:
    def __init__(self):
        if os.environ.get("IS_OFFLINE"):
            self.dynamodb = boto3.resource(
                "dynamodb",
                endpoint_url="http://localhost:8000",
                region_name="ap-northeast-1",
            )
        else:
            self.dynamodb = boto3.resource("dynamodb")
        self.table = self.dynamodb.Table(os.environ["USERS_TABLE_NAME"])

    def get_by_user_id(self, user_id: str) -> User | None:
        try:
            response = self.table.get_item(Key={"namespace": "default", "user_id": user_id})
            if "Item" not in response:
                return None

            item = response["Item"]
            print(f"Raw DynamoDB item for user_id {user_id}: {item}")

            # 新しいフィールドがない場合はデフォルト値を設定
            item.setdefault("twitter_id", None)
            item.setdefault("preferred_roles", None)
            item.setdefault("favorite_pokemon", None)
            item.setdefault("current_badge", None)
            item.setdefault("current_badge_2", None)
            item.setdefault("bio", None)
            item.setdefault("is_admin", False)
            item.setdefault("penalty_count", 0)
            item.setdefault("penalty_correction", 0)
            item.setdefault("last_penalty_time", None)
            item.setdefault("penalty_timeout_until", None)
            item.setdefault("is_banned", False)
            
            # win_rateフィールドがない場合は計算して設定
            if "win_rate" not in item:
                match_count = item.get("match_count", 0)
                win_count = item.get("win_count", 0)
                if match_count > 0:
                    item["win_rate"] = round((win_count / match_count) * 100, 1)
                else:
                    item["win_rate"] = 0.0

            # レガシーフィールドの処理: app_username -> trainer_name
            if "trainer_name" not in item and "app_username" in item:
                item["trainer_name"] = item["app_username"]

            # updated_atが文字列形式の場合は整数値に変換
            if "updated_at" in item and isinstance(item["updated_at"], str):
                from datetime import datetime
                try:
                    # ISO形式の場合はパースして変換
                    dt = datetime.fromisoformat(item["updated_at"].replace('Z', '+00:00'))
                    item["updated_at"] = int(dt.timestamp())
                except (ValueError, AttributeError):
                    # パースできない場合は現在時刻を使用
                    item["updated_at"] = int(datetime.now().timestamp())

            return User(**item)
        except ClientError as e:
            print(f"Error getting user by user_id {user_id}: {e}")
            return None
        except Exception as e:
            print(f"Error creating User model from DynamoDB item: {e}")
            print(f"Item data: {response.get('Item', 'No Item')}")
            return None

    def get_by_auth0_sub(self, auth0_sub: str) -> User | None:
        try:
            response = self.table.query(
                IndexName="Auth0SubIndex",
                KeyConditionExpression=Key("auth0_sub").eq(auth0_sub),
            )
            items = response.get("Items", [])
            if not items:
                return None

            item = items[0]
            print(f"Raw DynamoDB item for auth0_sub {auth0_sub}: {item}")

            # 新しいフィールドがない場合はデフォルト値を設定
            item.setdefault("twitter_id", None)
            item.setdefault("preferred_roles", None)
            item.setdefault("favorite_pokemon", None)
            item.setdefault("current_badge", None)
            item.setdefault("current_badge_2", None)
            item.setdefault("bio", None)
            item.setdefault("is_admin", False)
            item.setdefault("penalty_count", 0)
            item.setdefault("penalty_correction", 0)
            item.setdefault("last_penalty_time", None)
            item.setdefault("penalty_timeout_until", None)
            item.setdefault("is_banned", False)
            
            # win_rateフィールドがない場合は計算して設定
            if "win_rate" not in item:
                match_count = item.get("match_count", 0)
                win_count = item.get("win_count", 0)
                if match_count > 0:
                    item["win_rate"] = round((win_count / match_count) * 100, 1)
                else:
                    item["win_rate"] = 0.0

            # レガシーフィールドの処理: app_username -> trainer_name
            if "trainer_name" not in item and "app_username" in item:
                item["trainer_name"] = item["app_username"]

            # updated_atが文字列形式の場合は整数値に変換
            if "updated_at" in item and isinstance(item["updated_at"], str):
                from datetime import datetime
                try:
                    # ISO形式の場合はパースして変換
                    dt = datetime.fromisoformat(item["updated_at"].replace('Z', '+00:00'))
                    item["updated_at"] = int(dt.timestamp())
                except (ValueError, AttributeError):
                    # パースできない場合は現在時刻を使用
                    item["updated_at"] = int(datetime.now().timestamp())

            return User(**item)
        except ClientError as e:
            print(f"Error getting user by auth0_sub {auth0_sub}: {e}")
            return None
        except Exception as e:
            print(f"Error creating User model from DynamoDB item: {e}")
            print(f"Item data: {items[0] if items else 'No Items'}")
            return None

    def create(self, user: User) -> bool:
        try:
            # user_idの重複チェック
            existing_user = self.get_by_user_id(user.user_id)
            if existing_user:
                print(f"User with user_id {user.user_id} already exists")
                return False

            # auth0_subの重複チェック
            existing_auth0_user = self.get_by_auth0_sub(user.auth0_sub)
            if existing_auth0_user:
                print(f"User with auth0_sub {user.auth0_sub} already exists")
                return False

            # DynamoDBの条件付きput_itemで二重作成を防止
            self.table.put_item(
                Item=user.model_dump(),
                ConditionExpression="attribute_not_exists(user_id) AND attribute_not_exists(auth0_sub)"
            )
            return True
        except ClientError as e:
            if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                print(f"User {user.user_id} already exists (race condition caught by DynamoDB)")
                return False
            print(f"Error creating user: {e}")
            return False

    def update(self, user: User) -> bool:
        try:
            user_data = user.model_dump()
            print(f"UserRepository.update - Updating user with data: {user_data}")
            self.table.put_item(Item=user_data)
            print(f"UserRepository.update - Update successful for user_id: {user.user_id}")
            return True
        except ClientError as e:
            print(f"Error updating user: {e}")
            return False
        except Exception as e:
            print(f"Unexpected error updating user: {e}")
            return False

    def delete(self, user_id: str) -> bool:
        try:
            self.table.delete_item(Key={"namespace": "default", "user_id": user_id})
            return True
        except ClientError as e:
            print(f"Error deleting user {user_id}: {e}")
            return False
