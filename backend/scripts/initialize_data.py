#!/usr/bin/env python
"""
Initialize META data and Master data for Unitemate V2
METAデータとマスターデータを初期化するスクリプト

Usage:
    python initialize_data.py [--stage STAGE] [--yes]

    --stage STAGE: Specify the stage (dev, prd, etc.). Default is 'dev'
    --yes, -y: Auto-confirm all prompts
"""

import os
import sys
import json
import boto3
import argparse
from datetime import datetime

# コマンドライン引数を解析
parser = argparse.ArgumentParser(description="Initialize Unitemate V2 data")
parser.add_argument("--stage", default="dev", help="Stage name (dev, prd, etc.)")
parser.add_argument("--yes", "-y", action="store_true", help="Auto-confirm all prompts")
parser.add_argument("--region", default="ap-northeast-1", help="AWS Region")
args = parser.parse_args()

# ステージとリージョンの設定
STAGE = args.stage
REGION = args.region
AUTO_CONFIRM = args.yes

# テーブル名（serverless.ymlの命名規則に従う）
QUEUE_TABLE_NAME = f"unitemate-v2-queue-{STAGE}"
MASTER_DATA_TABLE_NAME = f"unitemate-v2-master-data-{STAGE}"  # master-data（ハイフン付き）に修正
MATCHES_TABLE_NAME = f"unitemate-v2-matches-{STAGE}"

# DynamoDB接続
dynamodb = boto3.resource("dynamodb", region_name=REGION)
queue_table = dynamodb.Table(QUEUE_TABLE_NAME)
master_data_table = dynamodb.Table(MASTER_DATA_TABLE_NAME)
matches_table = dynamodb.Table(MATCHES_TABLE_NAME)


def get_latest_match_id():
    """
    Matchesテーブルから最新のmatch_idを取得する
    """
    try:
        print("Querying latest match ID from matches table...")

        # matchesテーブルをスキャンして最大のmatch_idを取得
        response = matches_table.scan(
            ProjectionExpression="match_id", FilterExpression=boto3.dynamodb.conditions.Attr("namespace").eq("default")
        )

        matches = response.get("Items", [])
        if not matches:
            print("No matches found, using default match_id: 0")
            return 0

        # 最大のmatch_idを取得
        latest_match_id = max(int(match.get("match_id", 0)) for match in matches)
        print(f"Found latest match_id: {latest_match_id}")
        return latest_match_id

    except Exception as e:
        print(f"Warning: Could not query matches table ({e}), using default match_id: 0")
        return 0


def initialize_queue_meta():
    """
    Queue METAデータを初期化
    """
    print(f"Initializing Queue META data in {QUEUE_TABLE_NAME}...")

    # 実際の最新match_idを取得
    latest_match_id = get_latest_match_id()

    meta_data = {
        "namespace": "default",
        "user_id": "#META#",
        "lock": 0,
        "latest_match_id": latest_match_id,
        "unused_vc": list(range(1, 100, 2)),  # 1, 3, 5, ... 99 の奇数VCチャンネル
        "ongoing_matches": 0,
        "ongoing_match_ids": [],
        "ongoing_match_players": [],  # 現在試合中のプレイヤーIDリスト\
        "previous_matched_unixtime": 0,
        "previous_user_count": 0,
        "role_queues": {
            "TOP_LANE": [],  # ユーザーIDのリストのみ（新設計）
            "SUPPORT": [],  # ユーザーIDのリストのみ（新設計）
            "MIDDLE": [],  # ユーザーIDのリストのみ（新設計）
            "BOTTOM_LANE": [],  # ユーザーIDのリストのみ（新設計）
            "TANK": [],  # ユーザーIDのリストのみ（新設計）
        },
        "total_waiting": 0,
    }

    try:
        # 既存のMETAデータがあるか確認
        response = queue_table.get_item(Key={"namespace": "default", "user_id": "#META#"})

        if "Item" in response:
            if not AUTO_CONFIRM:
                print("META data already exists. Do you want to overwrite? (y/n): ", end="")
                answer = input().lower()
                if answer != "y":
                    print("Skipping META data initialization.")
                    return False
            else:
                print("META data already exists. Overwriting (auto-confirmed)...")

        # METAデータを書き込み
        queue_table.put_item(Item=meta_data)
        print("OK Queue META data initialized successfully")
        return True

    except Exception as e:
        print(f"ERROR Error initializing META data: {e}")
        return False


def initialize_master_data():
    """
    マスターデータを初期化（既存のseed.jsonファイルのデータを使用）
    """
    print(f"Initializing Master data in {MASTER_DATA_TABLE_NAME}...")

    # 既存のマスターデータseedファイルを読み込み
    script_dir = os.path.dirname(os.path.abspath(__file__))
    seed_file_path = os.path.join(script_dir, "../migrations/master-data-seed.json")

    try:
        if not os.path.exists(seed_file_path):
            print(f"ERROR Master data seed file not found: {seed_file_path}")
            return False

        with open(seed_file_path, "r", encoding="utf-8") as f:
            master_data_items = json.load(f)

        print(f"Found {len(master_data_items)} master data items to insert")

        # バッチ書き込みで効率的に挿入
        batch_size = 25  # DynamoDBのbatch_writerの制限

        with master_data_table.batch_writer() as batch:
            for item in master_data_items:
                batch.put_item(Item=item)

        print("OK Master data initialized successfully")

        # データタイプ別の件数を表示
        data_types = {}
        for item in master_data_items:
            data_type = item.get("data_type", "UNKNOWN")
            data_types[data_type] = data_types.get(data_type, 0) + 1

        print("  Inserted data breakdown:")
        for data_type, count in sorted(data_types.items()):
            print(f"    - {data_type}: {count} items")

        return True

    except Exception as e:
        print(f"ERROR Error initializing Master data: {e}")
        return False


def verify_initialization():
    """
    初期化されたデータを確認
    """
    print("\nVerifying initialized data...")

    try:
        # METAデータの確認
        meta_response = queue_table.get_item(Key={"namespace": "default", "user_id": "#META#"})
        if "Item" in meta_response:
            meta_item = meta_response["Item"]
            print("\nOK Queue META data verified:")
            print(f"  - Latest match ID: {meta_item.get('latest_match_id', 0)}")
            print(f"  - Unused VCs: {len(meta_item.get('unused_vc', []))} channels available")
            print(f"  - Ongoing matches: {meta_item.get('ongoing_matches', 0)}")
            print(f"  - Total queued: {meta_item.get('total_queued', 0)}")
        else:
            print("ERROR Queue META data not found")

        # マスターデータの確認
        print("\nOK Master data verification:")
        data_types = ["POKEMON", "ROLE", "BADGE", "SEASON", "SETTING"]

        for data_type in data_types:
            try:
                response = master_data_table.query(
                    KeyConditionExpression=boto3.dynamodb.conditions.Key("data_type").eq(data_type)
                )
                count = len(response.get("Items", []))
                print(f"  - {data_type}: {count} items")
            except Exception as e:
                print(f"  - {data_type}: Error checking ({e})")

    except Exception as e:
        print(f"ERROR Error verifying data: {e}")


def main():
    """
    メイン処理
    """
    print("=" * 60)
    print("Unitemate V2 Data Initialization Script")
    print(f"Stage: {STAGE}")
    print(f"Region: {REGION}")
    print("=" * 60)

    # 確認メッセージ
    print(f"\nThis will initialize data in the following tables:")
    print(f"  - Queue table: {QUEUE_TABLE_NAME}")
    print(f"  - Master data table: {MASTER_DATA_TABLE_NAME}")
    print(f"  - Matches table (for latest match ID): {MATCHES_TABLE_NAME}")

    if not AUTO_CONFIRM:
        print("\nDo you want to continue? (y/n): ", end="")
        answer = input().lower()
        if answer != "y":
            print("Initialization cancelled.")
            return
    else:
        print("\nProceeding with initialization (auto-confirmed)...")

    print()

    # METAデータの初期化
    meta_success = initialize_queue_meta()

    # マスターデータの初期化
    master_success = initialize_master_data()

    # 結果の確認
    if meta_success or master_success:
        verify_initialization()

    print("\n" + "=" * 60)
    if meta_success and master_success:
        print("OK All data initialized successfully!")
    elif meta_success or master_success:
        print("WARNING Partial initialization completed.")
    else:
        print("ERROR No data was initialized.")
    print("=" * 60)


if __name__ == "__main__":
    main()
