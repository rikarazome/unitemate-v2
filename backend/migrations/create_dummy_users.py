"""
テスト用ダミーユーザーアカウント作成スクリプト

実運用テスト用に10個のダミーユーザーアカウントをDynamoDBに作成する。
Discord認証なしでログインできるテスト用アカウントを作成。
"""

import boto3
import json
import random
from decimal import Decimal


def create_dummy_users():
    """10個のダミーユーザーを作成"""

    # DynamoDB設定
    dynamodb = boto3.resource("dynamodb", region_name="ap-northeast-1")
    users_table = dynamodb.Table("unitemate-v2-users-dev")

    # ダミーユーザーデータ
    dummy_users = []
    roles = ["TOP_LANE", "MIDDLE", "BOTTOM_LANE", "SUPPORT", "TANK"]

    for i in range(11, 21):  # 追加で11〜20番を作成
        user_id = f"dummy_user_{i:02d}"

        # レートはランダムに設定（1200-2000）
        base_rate = random.randint(1200, 2000)
        max_rate = base_rate + random.randint(50, 200)

        # 実際のユーザーモデルに合わせたフィールド構造
        win_count = random.randint(10, 50)
        match_count = win_count + random.randint(5, 30)
        win_rate = round(win_count / match_count, 3) if match_count > 0 else 0

        user_data = {
            "namespace": "default",  # Legacy準拠の複合キー
            "user_id": user_id,  # Discord IDの代わりに使用
            "auth0_sub": f"dummy|discord|{user_id}",  # ダミーAuth0 ID
            "discord_username": f"TestUser{i:02d}",
            "discord_discriminator": f"#{1000 + i}",
            "discord_avatar_url": "",
            "trainer_name": f"テストユーザー{i:02d}",  # メイン表示名
            "twitter_id": None,
            "preferred_roles": [roles[i % len(roles)]],  # リスト形式
            "favorite_pokemon": [],
            "owned_badges": [],
            "current_badge": None,
            "current_badge_2": None,
            "bio": None,
            "rate": Decimal(base_rate),
            "max_rate": Decimal(max_rate),
            "win_rate": Decimal(str(win_rate)),
            "match_count": Decimal(match_count),
            "win_count": Decimal(win_count),
            "assigned_match_id": Decimal(0),
            "penalty_count": Decimal(0),
            "penalty_correction": Decimal(0),
            "last_penalty_time": None,
            "penalty_timeout_until": None,
            "is_admin": False,
            "is_banned": False,
            "created_at": Decimal(1735689600),  # 2025-01-01 00:00:00 UTC timestamp
            "updated_at": Decimal(1735689600),
            "is_dummy": True,  # ダミーアカウント識別フラグ
            "dummy_password": f"test_password_{i:02d}",  # テスト用パスワード
        }

        dummy_users.append(user_data)

        # DynamoDBに保存
        try:
            users_table.put_item(Item=user_data)
            print(f"Created dummy user: {user_id} (Rate: {base_rate})")
        except Exception as e:
            print(f"Failed to create {user_id}: {e}")

    # 作成したユーザー一覧をJSONファイルに保存
    with open("dummy_users_list.json", "w", encoding="utf-8") as f:
        json.dump(dummy_users, f, ensure_ascii=False, indent=2, default=str)

    print(f"\nCreated {len(dummy_users)} dummy users")
    print("User list saved to dummy_users_list.json")

    return dummy_users


def verify_dummy_users():
    """作成したダミーユーザーを確認"""

    dynamodb = boto3.resource("dynamodb", region_name="ap-northeast-1")
    users_table = dynamodb.Table("unitemate-v2-users-dev")

    print("\nVerifying created dummy users:")

    for i in range(11, 21):  # 11〜20番をチェック
        user_id = f"dummy_user_{i:02d}"

        try:
            response = users_table.get_item(Key={"namespace": "default", "user_id": user_id})

            if "Item" in response:
                user = response["Item"]
                roles = user.get('preferred_roles', ['Unknown'])
                print(f"{user_id}: Rate {user['rate']}, Role {roles[0] if roles else 'None'}")
            else:
                print(f"{user_id}: Not found")

        except Exception as e:
            print(f"{user_id}: Error - {e}")


if __name__ == "__main__":
    print("Creating dummy users for testing...")

    # ダミーユーザー作成
    users = create_dummy_users()

    # 作成確認
    verify_dummy_users()

    print("\nDummy user creation completed!")
    print("\nNew dummy accounts created:")
    for i in range(11, 21):  # 11〜20番
        user_id = f"dummy_user_{i:02d}"
        password = f"test_password_{i:02d}"
        print(f"   - Username: {user_id}, Password: {password}")
