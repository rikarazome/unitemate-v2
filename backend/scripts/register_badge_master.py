#!/usr/bin/env python3
"""勲章マスターデータをDynamoDBに登録するスクリプト"""

import boto3
import json
import os
from datetime import datetime

# DynamoDB設定
dynamodb = boto3.resource("dynamodb")
MASTER_DATA_TABLE = os.environ.get("MASTER_DATA_TABLE_NAME", "unitemate-v2-master-data-dev")

# 勲章データを読み込み
with open("../frontend/src/data/badges.json", "r", encoding="utf-8") as f:
    badge_visuals = json.load(f)


# 勲章マスターデータを作成
def create_badge_master_data():
    """勲章マスターデータを作成"""
    master_table = dynamodb.Table(MASTER_DATA_TABLE)

    # 勲章カテゴリの定義
    categories = {
        # シーズン系
        "1st": "season",
        "2nd": "season",
        "3rd": "season",
        "TOP": "season",
        "戦": "season",
        "免許": "season",
        # 購入系
        "購入可能": "purchase",
        "支援者": "purchase",
        # イベント系
        "優勝": "event",
        "準優勝": "event",
        # その他
        "default": "special",
    }

    def get_category(condition):
        """条件から勲章カテゴリを判定"""
        for key, cat in categories.items():
            if key in condition:
                return cat
        return categories["default"]

    timestamp = datetime.now().isoformat()

    for badge in badge_visuals:
        # 購入可能かどうか判定
        is_purchasable = "購入可能" in badge["condition"] or "支援者" in badge["condition"]

        # 価格設定（仮）
        price = None
        if is_purchasable:
            if "支援者" in badge["condition"]:
                if "マスター" in badge["condition"]:
                    price = 10000
                elif "エキスパート" in badge["condition"]:
                    price = 5000
                elif "エリート" in badge["condition"]:
                    price = 3000
                elif "ハイパー" in badge["condition"]:
                    price = 1000
            else:
                price = 500  # 通常の購入可能勲章

        # マスターデータ作成
        master_data = {
            "data_type": "BADGE",
            "id": badge["id"],
            "condition": badge["condition"],
            "display": badge["display"],
            "is_purchasable": is_purchasable,
            "price": price,
            "is_active": True,
            "category": get_category(badge["condition"]),
            "created_at": timestamp,
            "updated_at": timestamp,
        }

        try:
            master_table.put_item(Item=master_data)
            print(f"Registered badge master data: {badge['id']}")
        except Exception as e:
            print(f"Failed to register badge {badge['id']}: {e}")


def main():
    """メイン処理"""
    print("Registering badge master data...")
    create_badge_master_data()
    print("Badge master data registration completed!")


if __name__ == "__main__":
    main()
