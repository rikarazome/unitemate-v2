#!/usr/bin/env python3
"""
achievements.csvからbadges.jsonを生成し、DynamoDBも更新するスクリプト

このスクリプトは：
1. achievements.csvを読み込み
2. 各行をbadges.jsonのフォーマットに変換
3. 新しいbadges.jsonを出力
4. DynamoDBのMasterDataテーブルも更新
"""

import csv
import json
import os
import sys
import boto3
from typing import List, Dict, Any
from botocore.exceptions import ClientError

def csv_to_badges_json(csv_path: str) -> List[Dict[str, Any]]:
    """achievements.csvを読み込んでbadges.jsonフォーマットに変換"""
    badges = []

    with open(csv_path, 'r', encoding='utf-8') as file:
        reader = csv.DictReader(file)

        # 必要な列があるかチェック
        required_columns = ['id', 'display', 'condition', 'type', 'start_color', 'end_color', 'char_color']
        missing_columns = [col for col in required_columns if col not in reader.fieldnames]
        if missing_columns:
            print(f"Error: Missing required columns: {missing_columns}")
            return []

        for row_num, row in enumerate(reader, start=2):  # CSVの行番号（ヘッダー除く）
            # IDが空でないことを確認
            badge_id = row.get('id', '').strip()
            if not badge_id:
                print(f"Warning: Row {row_num} has empty ID, skipping")
                continue

            # 必須フィールドの検証
            display = row.get('display', '').strip()
            condition = row.get('condition', '').strip()
            if not display or not condition:
                print(f"Warning: Row {row_num} (ID: {badge_id}) missing display or condition")
            # badges.jsonの構造に合わせて変換
            # 価格文字列の処理
            price_str = row.get('price', '0')
            price = int(price_str) if price_str.isdigit() else 0

            badge = {
                "id": badge_id,
                "display": display,
                "condition": condition,
                "price": price,
                "type": row.get('type', 'gradient'),
                "start_color": row.get('start_color', ''),
                "end_color": row.get('end_color', ''),
                "char_color": row.get('char_color', ''),
                "is_active": True,
                "image_card": row.get('image_card', ''),
                "banner_image": row.get('banner_image', ''),
                "current_sales": 0,
                "max_sales": 0
            }

            badges.append(badge)

    return badges

def update_dynamodb_badges(badges: List[Dict[str, Any]], stage: str = 'dev') -> bool:
    """DynamoDBのMasterDataテーブルを更新（put_itemで上書き）"""
    try:
        # ステージ検証
        if stage not in ['dev', 'prod']:
            print(f"Error: Invalid stage '{stage}'. Must be 'dev' or 'prod'")
            return False

        table_name = f'unitemate-v2-master-data-{stage}'

        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table(table_name)

        print(f"Updating DynamoDB table: {table_name}")

        # バッジデータをDynamoDB形式に変換
        items_to_put = []
        for badge in badges:
            # バッジIDの検証
            if not badge.get('id'):
                print(f"Warning: Skipping badge with empty ID: {badge}")
                continue

            item = {
                'data_type': 'BADGE',
                'id': badge['id'],
                'display': badge['display'],
                'condition': badge['condition'],
                'price': badge['price'],
                'type': badge['type'],
                'start_color': badge['start_color'],
                'end_color': badge['end_color'],
                'char_color': badge['char_color'],
                'is_active': badge['is_active'],
                'image_card': badge['image_card'],
                'banner_image': badge['banner_image'],
                'current_sales': badge['current_sales'],
                'max_sales': badge['max_sales']
            }
            items_to_put.append(item)

        if not items_to_put:
            print("Warning: No valid badges to insert")
            return True

        # バッジデータを挿入/上書き（25件ずつ）
        print("Updating badge data...")
        batch_size = 25
        for i in range(0, len(items_to_put), batch_size):
            batch = items_to_put[i:i + batch_size]

            with table.batch_writer() as batch_writer:
                for item in batch:
                    batch_writer.put_item(Item=item)

            print(f"Updated batch {i//batch_size + 1}/{(len(items_to_put) + batch_size - 1)//batch_size}")

        print(f"Successfully updated {len(items_to_put)} badges in DynamoDB")
        return True

    except ClientError as e:
        print(f"Error updating DynamoDB: {e}")
        return False
    except Exception as e:
        print(f"Error updating DynamoDB: {e}")
        return False

def main():
    """メイン処理"""
    # コマンドライン引数でステージを指定（デフォルトはdev）
    stage = 'dev'
    if len(sys.argv) > 1:
        stage = sys.argv[1]

    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.abspath(os.path.join(script_dir, "..", "achievements.csv"))
    output_path = os.path.abspath(os.path.join(script_dir, "..", "frontend", "src", "data", "badges", "badges.json"))

    if not os.path.exists(csv_path):
        print(f"Error: achievements.csv not found at {csv_path}")
        return

    print(f"Stage: {stage}")
    print("Reading achievements.csv...")

    # CSVからバッジデータを生成
    badges = csv_to_badges_json(csv_path)
    print(f"Loaded {len(badges)} badges from CSV")

    # JSON出力ディレクトリが存在するか確認し、必要に応じて作成
    output_dir = os.path.dirname(output_path)
    try:
        os.makedirs(output_dir, exist_ok=True)
        print(f"Output directory ensured: {output_dir}")
    except OSError as e:
        print(f"Error creating output directory: {e}")
        return

    # JSONファイルとして出力
    print("Updating badges.json...")
    try:
        with open(output_path, 'w', encoding='utf-8') as file:
            json.dump(badges, file, ensure_ascii=False, indent=2)
        print(f"Updated: {output_path}")
    except IOError as e:
        print(f"Error writing JSON file: {e}")
        return

    # DynamoDBを更新
    print("Updating DynamoDB...")
    try:
        if update_dynamodb_badges(badges, stage):
            print("DynamoDB update completed successfully")
            print(f"\nCompleted! Updated {len(badges)} badges in both JSON and DynamoDB ({stage})")
        else:
            print("DynamoDB update failed - JSON was updated but database sync incomplete")
            print("You may need to run the script again to sync DynamoDB")
    except Exception as e:
        print(f"Error during DynamoDB update: {e}")
        print("JSON file was successfully updated, but DynamoDB sync failed")
        print("You may need to run the script again to sync DynamoDB")

if __name__ == "__main__":
    main()