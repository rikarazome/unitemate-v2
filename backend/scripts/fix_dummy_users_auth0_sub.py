"""ダミーユーザーのauth0_subを修正するスクリプト"""

import os
import sys

# プロジェクトルートをPythonパスに追加
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import boto3

# DynamoDB設定
if os.environ.get("IS_OFFLINE"):
    dynamodb = boto3.resource(
        "dynamodb",
        endpoint_url="http://localhost:8000",
        region_name="ap-northeast-1",
    )
else:
    dynamodb = boto3.resource("dynamodb", region_name="ap-northeast-1")

# テーブル名を環境変数から取得（デフォルト値も設定）
table_name = os.environ.get("USERS_TABLE_NAME", "unitemate-v2-users-dev")
print(f"Using table: {table_name}")

table = dynamodb.Table(table_name)

# ダミーユーザーのauth0_subを修正
for i in range(1, 11):
    user_id = f"dummy_user_{i}"

    try:
        # 既存ユーザーを取得
        response = table.get_item(Key={"namespace": "default", "user_id": user_id})
        if "Item" not in response:
            print(f"User {user_id} not found")
            continue

        user = response["Item"]
        old_auth0_sub = user.get("auth0_sub", "")
        new_auth0_sub = f"dummy|discord|{user_id}"

        # auth0_subを更新
        user["auth0_sub"] = new_auth0_sub

        # ユーザーを更新
        table.put_item(Item=user)
        print(f"Updated {user_id}: auth0_sub changed from '{old_auth0_sub}' to '{new_auth0_sub}'")

    except Exception as e:
        print(f"Error updating user {user_id}: {e}")

print("\nDummy users auth0_sub fix completed!")
