#!/usr/bin/env python
"""
Clear all existing master data from the table
"""

import boto3

# DynamoDB接続
dynamodb = boto3.resource("dynamodb", region_name="ap-northeast-1")
table = dynamodb.Table("unitemate-v2-master-data-dev")


def clear_master_data():
    # 全アイテムをスキャン
    response = table.scan()
    items = response.get("Items", [])

    print(f"Found {len(items)} items to delete")

    # バッチで削除
    with table.batch_writer() as batch:
        for item in items:
            batch.delete_item(Key={"data_type": item["data_type"], "id": item["id"]})

    print("All items deleted successfully")


if __name__ == "__main__":
    clear_master_data()
