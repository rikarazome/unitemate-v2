import boto3
import os

# DynamoDB設定
dynamodb = boto3.resource("dynamodb")
users_table = dynamodb.Table("unitemate-v2-users-dev")

# ダミーユーザーにtrainer_nameとdiscord_usernameを追加
for i in range(1, 11):
    user_id = f"dummy_user_{i}"

    # 英語のトレーナー名を設定
    trainer_names = ["Rika", "Taro", "Hanako", "Kenji", "Ai", "Yuki", "Sakura", "Hiroshi", "Miyuki", "Daichi"]
    trainer_name = trainer_names[i - 1]
    discord_username = f"TestUser{i:02d}#{1000 + i}"

    try:
        users_table.update_item(
            Key={"namespace": "default", "user_id": user_id},
            UpdateExpression="SET trainer_name = :tn, discord_username = :du",
            ExpressionAttributeValues={":tn": trainer_name, ":du": discord_username},
        )
        print(f"Updated {user_id}: {trainer_name} ({discord_username})")
    except Exception as e:
        print(f"Error updating {user_id}: {e}")

print("All dummy users updated with trainer names and discord usernames")
