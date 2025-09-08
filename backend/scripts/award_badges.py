#!/usr/bin/env python3
"""勲章を付与するスクリプト"""

import boto3
import json
import os
import random
from datetime import datetime

# DynamoDB設定
dynamodb = boto3.resource("dynamodb")

# テーブル名
USERS_TABLE = os.environ.get("USERS_TABLE_NAME", "unitemate-v2-users-dev")
USER_BADGES_TABLE = os.environ.get("USER_BADGES_TABLE_NAME", "unitemate-v2-user-badges-dev")

# 勲章データを読み込み
with open("../frontend/src/data/badges.json", "r", encoding="utf-8") as f:
    ALL_BADGES = json.load(f)


def award_badges_to_user(user_id: str, badge_ids: list):
    """ユーザーに勲章を付与"""
    user_badges_table = dynamodb.Table(USER_BADGES_TABLE)
    timestamp = int(datetime.now().timestamp())

    for badge_id in badge_ids:
        try:
            user_badges_table.put_item(
                Item={"user_id": user_id, "badge_id": badge_id, "earned_at": timestamp},
                ConditionExpression="attribute_not_exists(badge_id)",
            )
            print(f"Awarded badge {badge_id} to user {user_id}")
        except Exception as e:
            if "ConditionalCheckFailedException" in str(e):
                print(f"User {user_id} already has badge {badge_id}")
            else:
                print(f"Failed to award badge {badge_id}: {e}")


def award_all_badges_to_rikarazome():
    """rikarazomeに全勲章を付与"""
    print("Awarding all badges to rikarazome...")
    rikarazome_id = "1046351234654654535"  # rikarazomeのDiscord ID

    # 全勲章のIDリスト
    all_badge_ids = [badge["id"] for badge in ALL_BADGES]
    award_badges_to_user(rikarazome_id, all_badge_ids)

    # デフォルトでかっこいい勲章をセット
    users_table = dynamodb.Table(USERS_TABLE)
    users_table.update_item(
        Key={"namespace": "default", "user_id": rikarazome_id},
        UpdateExpression="SET current_badge = :primary, current_badge_2 = :secondary",
        ExpressionAttributeValues={
            ":primary": "badge_017",  # 退紅りか（画像）
            ":secondary": "badge_001",  # [S1]1st（グラデーション）
        },
    )
    print(f"Set default equipped badges for rikarazome")


def award_random_badges_to_dummy_users():
    """ダミーユーザーにランダムに勲章を付与"""
    print("Awarding random badges to dummy users...")

    # 人気がありそうな勲章を優先的に選ぶためのウェイト
    interesting_badges = [
        # シーズン上位系
        "badge_001",
        "badge_002",
        "badge_003",
        "badge_004",
        "badge_005",
        "badge_069",
        "badge_070",
        "badge_071",
        "badge_093",
        "badge_094",
        # 画像系の派手な勲章
        "badge_013",
        "badge_014",
        "badge_015",
        "badge_016",
        "badge_017",
        "badge_018",
        "badge_019",
        "badge_020",
        "badge_021",
        "badge_022",
        "badge_041",
        "badge_042",
        "badge_043",
        "badge_044",
        "badge_045",
        "badge_051",
        "badge_052",
        "badge_053",
        "badge_054",
        "badge_055",
        # 戦績系
        "badge_007",
        "badge_008",
        "badge_009",
        "badge_010",
        "badge_011",
        "badge_048",
        "badge_049",
        "badge_050",
        "badge_058",
        "badge_059",
        # 支援者系
        "badge_121",
        "badge_122",
        "badge_123",
        "badge_124",
    ]

    # ダミーユーザーIDリスト
    dummy_user_ids = []
    for i in range(1, 31):  # dummy_1 から dummy_30
        dummy_user_ids.append(f"dummy_{i}")

    for user_id in dummy_user_ids:
        # 各ユーザーに3〜7個の勲章をランダムに選択
        num_badges = random.randint(3, 7)

        # 興味深い勲章から優先的に選ぶ（50%の確率）
        selected_badges = []
        for _ in range(num_badges):
            if random.random() < 0.5 and interesting_badges:
                badge = random.choice(interesting_badges)
                if badge not in selected_badges:
                    selected_badges.append(badge)
            else:
                # 全勲章からランダムに選ぶ
                badge = random.choice([b["id"] for b in ALL_BADGES])
                if badge not in selected_badges:
                    selected_badges.append(badge)

        award_badges_to_user(user_id, selected_badges)

        # ランダムに装着勲章も設定
        if len(selected_badges) >= 2:
            users_table = dynamodb.Table(USERS_TABLE)
            primary = random.choice(selected_badges)
            secondary = random.choice([b for b in selected_badges if b != primary])

            try:
                users_table.update_item(
                    Key={"namespace": "default", "user_id": user_id},
                    UpdateExpression="SET current_badge = :primary, current_badge_2 = :secondary",
                    ExpressionAttributeValues={
                        ":primary": primary,
                        ":secondary": secondary,
                    },
                )
                print(f"Set equipped badges for {user_id}: {primary}, {secondary}")
            except Exception as e:
                print(f"Failed to set equipped badges for {user_id}: {e}")


def main():
    """メイン処理"""
    # UserBadgesテーブルの存在確認
    try:
        user_badges_table = dynamodb.Table(USER_BADGES_TABLE)
        user_badges_table.load()
        print(f"UserBadges table exists: {USER_BADGES_TABLE}")
    except Exception as e:
        print(f"UserBadges table not found. Creating dummy data in Users table only.")
        # テーブルがない場合は、Usersテーブルのcurrent_badge/current_badge_2のみ更新
        award_all_badges_to_rikarazome()
        award_random_badges_to_dummy_users()
        return

    # 勲章を付与
    award_all_badges_to_rikarazome()
    award_random_badges_to_dummy_users()

    print("Badge awarding completed!")


if __name__ == "__main__":
    main()
