#!/usr/bin/env python
"""
Update only master data (without touching META data)
METAデータを変更せずにマスターデータのみを更新するスクリプト
"""

import boto3
import json
import argparse
from typing import List, Dict, Any


def load_master_data() -> List[Dict[str, Any]]:
    """master-data-seed.jsonからデータを読み込み"""
    try:
        with open("./migrations/master-data-seed.json", "r", encoding="utf-8") as f:
            data = json.load(f)
            print(f"Loaded {len(data)} items from master-data-seed.json")
            return data
    except FileNotFoundError:
        print("ERROR: master-data-seed.json not found. Run convert_achievements.py first.")
        raise
    except Exception as e:
        print(f"ERROR: Failed to load master data: {e}")
        raise


def clear_master_data(table, data_types: List[str] = None):
    """指定されたdata_typeのマスターデータをクリア"""
    if data_types is None:
        data_types = ["BADGE", "SETTING"]

    for data_type in data_types:
        print(f"Clearing existing {data_type} data...")

        # 指定されたdata_typeのアイテムをクエリ
        response = table.query(KeyConditionExpression="data_type = :dt", ExpressionAttributeValues={":dt": data_type})

        items = response.get("Items", [])
        print(f"Found {len(items)} {data_type} items to delete")

        # バッチで削除
        if items:
            with table.batch_writer() as batch:
                for item in items:
                    batch.delete_item(Key={"data_type": item["data_type"], "id": item["id"]})
            print(f"Deleted {len(items)} {data_type} items")


def insert_master_data(table, data: List[Dict[str, Any]]):
    """マスターデータを挿入"""
    print(f"Inserting {len(data)} master data items...")

    # データタイプ別の集計
    data_type_count = {}
    for item in data:
        dt = item.get("data_type", "UNKNOWN")
        data_type_count[dt] = data_type_count.get(dt, 0) + 1

    # バッチで挿入
    with table.batch_writer() as batch:
        for item in data:
            batch.put_item(Item=item)

    print("Master data inserted successfully")
    print("Inserted data breakdown:")
    for data_type, count in data_type_count.items():
        print(f"  - {data_type}: {count} items")

    return data_type_count


def verify_master_data(table):
    """マスターデータの検証"""
    print("Verifying master data...")

    data_types = ["BADGE", "SETTING"]
    verification_results = {}

    for data_type in data_types:
        response = table.query(
            KeyConditionExpression="data_type = :dt", ExpressionAttributeValues={":dt": data_type}, Select="COUNT"
        )
        count = response["Count"]
        verification_results[data_type] = count
        print(f"  - {data_type}: {count} items")

    return verification_results


def main():
    parser = argparse.ArgumentParser(description="マスターデータのみを更新（METAデータは変更しない）")
    parser.add_argument("--stage", default="dev", help="Stage name (dev, prd, etc.)")
    parser.add_argument("--region", default="ap-northeast-1", help="AWS region")
    parser.add_argument("--yes", "-y", action="store_true", help="Auto-confirm all prompts")
    parser.add_argument(
        "--clear-only",
        nargs="+",
        choices=["BADGE", "SETTING"],
        help="Clear only specified data types (e.g., --clear-only BADGE)",
    )

    args = parser.parse_args()

    # テーブル名の構築
    master_table_name = f"unitemate-v2-master-data-{args.stage}"

    print("=" * 60)
    print("Unitemate V2 Master Data Update Script")
    print(f"Stage: {args.stage}")
    print(f"Region: {args.region}")
    print(f"Master data table: {master_table_name}")
    print("=" * 60)

    # DynamoDB接続
    try:
        dynamodb = boto3.resource("dynamodb", region_name=args.region)
        master_table = dynamodb.Table(master_table_name)

        # テーブルの存在確認
        master_table.load()
        print(f"OK Connected to {master_table_name}")

    except Exception as e:
        print(f"ERROR: Failed to connect to DynamoDB table: {e}")
        return 1

    try:
        # マスターデータの読み込み
        master_data = load_master_data()

        # クリア対象の決定
        if args.clear_only:
            clear_types = args.clear_only
            print(f"Will clear and update only: {', '.join(clear_types)}")
            # 指定されたdata_typeのみフィルタ
            master_data = [item for item in master_data if item.get("data_type") in clear_types]
        else:
            clear_types = ["BADGE", "SETTING"]
            print("Will clear and update all master data types")

        if not args.yes:
            print(f"\nThis will update master data in {master_table_name}")
            print(f"Data types to update: {', '.join(clear_types)}")
            print(f"Items to insert: {len(master_data)}")
            confirm = input("Continue? (y/N): ")
            if confirm.lower() != "y":
                print("Aborted")
                return 0

        # 既存データのクリア
        clear_master_data(master_table, clear_types)

        # 新しいデータの挿入
        insert_result = insert_master_data(master_table, master_data)

        # 検証
        verify_result = verify_master_data(master_table)

        print("\n" + "=" * 60)
        print("OK Master data update completed successfully!")
        print("=" * 60)

        return 0

    except Exception as e:
        print(f"ERROR: Master data update failed: {e}")
        return 1


if __name__ == "__main__":
    exit(main())
