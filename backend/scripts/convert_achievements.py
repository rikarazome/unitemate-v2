#!/usr/bin/env python
"""
Convert achievements.csv to BADGE format for master data
"""

import csv
import json


def convert_achievements():
    """achievements.csvをBADGEデータ形式に変換"""
    badges = []
    settings = [
        {
            "data_type": "SETTING",
            "id": "lobby_create_timeout",
            "name": "ロビー作成制限時間",
            "description": "マッチ成立後にロビーを作成するまでの制限時間（秒）",
            "value": 150,
            "is_active": True,
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z",
        },
        {
            "data_type": "SETTING",
            "id": "lobby_join_timeout",
            "name": "ロビー入室制限時間",
            "description": "ロビー作成後に全員が入室するまでの制限時間（秒）",
            "value": 250,
            "is_active": True,
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z",
        },
    ]

    with open("../../achievements.csv", "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if row["display"].strip():  # displayが空でない場合のみ
                badge_id = f"badge_{i + 1:03d}"  # badge_001, badge_002, etc.
                badge = {
                    "data_type": "BADGE",
                    "id": badge_id,
                    "condition": row["condition"].strip(),
                    "display": row["display"].strip(),
                    "start_color": row["start_color"].strip(),
                    "end_color": row["end_color"].strip(),
                    "char_color": row["char_color"].strip(),
                    "image_card": row["image_card"].strip(),
                    "banner_image": row["banner_image"].strip(),
                    "is_active": True,
                    "created_at": "2024-01-01T00:00:00Z",
                    "updated_at": "2024-01-01T00:00:00Z",
                }
                badges.append(badge)

    # 設定データとバッジデータを結合
    all_data = settings + badges

    print(f"Generated {len(badges)} badge entries and {len(settings)} setting entries")
    print(f"Total: {len(all_data)} entries")

    # master-data-seed.jsonに書き込み
    with open("../migrations/master-data-seed.json", "w", encoding="utf-8") as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)

    print("master-data-seed.json updated successfully")

    # サンプルを表示
    if badges:
        print("\nSample badge:")
        print(json.dumps(badges[0], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    convert_achievements()
