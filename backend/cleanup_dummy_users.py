import boto3

# DynamoDB設定
dynamodb = boto3.resource("dynamodb")
users_table = dynamodb.Table("unitemate-v2-users-dev")

# ダミーユーザーのtrainer_nameフィールドを更新し、不要なapp_usernameを削除
for i in range(1, 11):
    user_id = f"dummy_user_{i}"

    # 英語のトレーナー名を設定
    trainer_names = ["Rika", "Taro", "Hanako", "Kenji", "Ai", "Yuki", "Sakura", "Hiroshi", "Miyuki", "Daichi"]
    trainer_name = trainer_names[i - 1]
    discord_username = f"TestUser{i:02d}#{1000 + i}"

    try:
        # trainer_nameを更新し、不要なapp_usernameを削除
        users_table.update_item(
            Key={"namespace": "default", "user_id": user_id},
            UpdateExpression="SET trainer_name = :tn, discord_username = :du REMOVE app_username, discord_display_name",
            ExpressionAttributeValues={":tn": trainer_name, ":du": discord_username},
        )
        print(f"Updated {user_id}: trainer_name={trainer_name}, discord_username={discord_username}")
    except Exception as e:
        print(f"Error updating {user_id}: {e}")

print("All dummy users cleaned up")
