#!/usr/bin/env python3
"""
データ移行スクリプト: CSVからDev環境のDynamoDBへ
過去のユーザーデータをCSVから読み取り、新しいUserモデル形式でDynamoDBに挿入
"""

import csv
import os
import boto3
from datetime import datetime
from dateutil import parser
from decimal import Decimal
import sys
sys.path.append('src')

from src.models.user import User
from dotenv import load_dotenv

# Dev環境の設定読み込み
load_dotenv('.env.dev')

def parse_creation_date(date_str: str) -> int:
    """Creation Dateを解析してunixtimeに変換"""
    if not date_str:
        # デフォルト値として2023年8月31日を使用
        return int(datetime(2023, 8, 31).timestamp())
    
    try:
        # "Aug 31, 2023 4:36 pm" 形式をパース
        parsed_date = parser.parse(date_str)
        return int(parsed_date.timestamp())
    except Exception as e:
        print(f"Date parse error: {date_str}, Error: {e}")
        # デフォルト値として2023年8月31日を使用
        return int(datetime(2023, 8, 31).timestamp())

def process_awards_badges(awards_str: str) -> tuple[list[str], str | None, str | None]:
    """
    awards文字列から勲章情報を解析
    Returns: (owned_badges, current_badge, current_badge_2)
    """
    if not awards_str:
        return [], None, None
    
    # カンマ区切りで分割
    badges = [badge.strip() for badge in awards_str.split(',') if badge.strip()]
    
    current_badge = badges[0] if len(badges) > 0 else None
    current_badge_2 = badges[1] if len(badges) > 1 else None
    
    return badges, current_badge, current_badge_2

def process_selected_awards(selected_1: str, selected_2: str) -> tuple[str | None, str | None]:
    """selected_award_1/2の処理"""
    current_badge = selected_1 if selected_1 else None
    current_badge_2 = selected_2 if selected_2 else None
    return current_badge, current_badge_2

def migrate_users_from_csv(csv_file_path: str, dry_run: bool = True, limit: int | None = None):
    """CSVファイルからユーザーデータを移行"""
    
    # DynamoDB接続設定
    dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-1')
    users_table = dynamodb.Table('unitemate-v2-users-dev')
    
    migrated_count = 0
    error_count = 0
    
    print(f"Starting migration: {csv_file_path}")
    print(f"DRY RUN: {dry_run}")
    print(f"Migration limit: {limit if limit else 'ALL'} users")
    print("-" * 50)
    
    with open(csv_file_path, 'r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        
        for row_num, row in enumerate(reader, start=2):  # ヘッダー行は1行目
            # 制限チェック
            if limit and migrated_count >= limit:
                print(f"Reached limit ({limit} users), stopping.")
                break
                
            try:
                # CSVカラムから値を取得
                discord_id = row.get('Discord Num ID', '').strip()
                discord_username = row.get('Discord ID', '').strip()
                trainer_name = row.get('Trainer Name', '').strip()
                twitter_id = row.get('twitterID', '').strip()
                email = row.get('email', '').strip()
                profile_pic = row.get('profile pic', '').strip()
                penalty_str = row.get('Penalty', '0').strip()
                penalty_correction_str = row.get('penalty correction', '0').strip()
                awards = row.get('awards', '').strip()
                selected_award_1 = row.get('selected_award_1', '').strip()
                selected_award_2 = row.get('selected_award_2', '').strip()
                creation_date = row.get('Creation Date', '').strip()
                
                # Discord IDが空の場合はスキップ
                if not discord_id and not discord_username:
                    print(f"Row {row_num}: Discord ID not found - skip")
                    continue
                
                # user_idとしてDiscord Num IDを使用、なければDiscord IDを使用
                user_id = discord_id if discord_id else discord_username
                
                # トレーナー名が空の場合はDiscordユーザー名を使用
                if not trainer_name:
                    trainer_name = discord_username
                
                # ペナルティ数の変換
                try:
                    penalty_count = int(penalty_str) if penalty_str else 0
                except ValueError:
                    penalty_count = 0
                
                try:
                    penalty_correction = int(penalty_correction_str) if penalty_correction_str else 0
                except ValueError:
                    penalty_correction = 0
                
                # 勲章情報の処理（selected_award_1/2を優先）
                current_badge, current_badge_2 = process_selected_awards(selected_award_1, selected_award_2)
                owned_badges, awards_current, awards_current_2 = process_awards_badges(awards)
                
                # selected_awardsが空の場合はawardsから取得
                if not current_badge and awards_current:
                    current_badge = awards_current
                if not current_badge_2 and awards_current_2:
                    current_badge_2 = awards_current_2
                
                # 作成日時の処理
                created_at = parse_creation_date(creation_date)
                updated_at = created_at
                
                # Twitterアカウントの処理（@を除去）
                if twitter_id.startswith('@'):
                    twitter_id = twitter_id[1:]
                
                # Userオブジェクト作成
                user = User(
                    namespace="default",
                    user_id=user_id,
                    discord_username=discord_username,
                    discord_discriminator=None,  # CSVにはないためNone
                    discord_avatar_url=profile_pic if profile_pic else None,
                    trainer_name=trainer_name,
                    twitter_id=twitter_id if twitter_id else None,
                    preferred_roles=None,
                    favorite_pokemon=None,
                    owned_badges=owned_badges,
                    current_badge=current_badge,
                    current_badge_2=current_badge_2,
                    bio=None,
                    rate=1500,  # デフォルト値
                    max_rate=1500,  # デフォルト値
                    match_count=0,  # デフォルト値
                    win_count=0,  # デフォルト値
                    win_rate=0.0,  # デフォルト値
                    assigned_match_id=0,  # デフォルト値
                    penalty_count=penalty_count,
                    penalty_correction=penalty_correction,
                    last_penalty_time=None,
                    penalty_timeout_until=None,
                    is_admin=False,  # デフォルト値
                    is_banned=False,  # デフォルト値
                    created_at=created_at,
                    updated_at=updated_at
                )
                
                # Avoid Unicode issues in Windows console
                safe_trainer_name = trainer_name.encode('ascii', errors='replace').decode('ascii')
                print(f"Row {row_num}: {safe_trainer_name} ({user_id})")
                if not dry_run:
                    # DynamoDBに挿入
                    users_table.put_item(Item=user.model_dump())
                    
                migrated_count += 1
                
            except Exception as e:
                print(f"Error at row {row_num}: {e}")
                # Sanitize row data for Windows console
                safe_row = {k: str(v).encode('ascii', errors='replace').decode('ascii') for k, v in row.items()}
                print(f"Data: {safe_row}")
                error_count += 1
                continue
    
    print("-" * 50)
    print(f"Migration completed:")
    print(f"  Success: {migrated_count} users")
    print(f"  Errors: {error_count} users")
    if dry_run:
        print("  * DRY RUN - No actual insertions performed")

def main():
    """メイン関数"""
    import argparse
    
    parser = argparse.ArgumentParser(description="CSVからDynamoDBへのユーザーデータ移行")
    parser.add_argument('--limit', type=int, default=None, help='移行するユーザー数の上限（指定なしで全件）')
    parser.add_argument('--no-dry-run', action='store_true', help='DRY RUNをスキップして直接実行')
    args = parser.parse_args()
    
    csv_file = "../export_unitemate-export_2025-08-27_23-41-25.csv"
    
    if not os.path.exists(csv_file):
        print(f"CSV file not found: {csv_file}")
        return
    
    if not args.no_dry_run:
        # まずDRY RUNで確認
        print("=== DRY RUN ===")
        migrate_users_from_csv(csv_file, dry_run=True, limit=args.limit)
        
        print("\n" + "=" * 60)
        confirm = input("Execute actual migration? (y/N): ")
        if confirm.lower() != 'y':
            print("Migration cancelled.")
            return
    
    print("\n=== Actual Migration Execution ===")
    migrate_users_from_csv(csv_file, dry_run=False, limit=args.limit)

if __name__ == "__main__":
    main()