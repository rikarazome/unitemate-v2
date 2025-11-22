#!/usr/bin/env python3
"""Season data reset script - resets user stats and deletes match records."""

import argparse
import os
import sys
from datetime import datetime

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

# プロジェクトルートをパスに追加
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.models.user import User


class SeasonResetScript:
    """シーズンデータリセットスクリプト."""

    def __init__(self, stage: str):
        """初期化."""
        self.dynamodb = boto3.resource("dynamodb", region_name="ap-northeast-1")
        self.users_table = self.dynamodb.Table(f"unitemate-v2-users-{stage}")
        self.matches_table = self.dynamodb.Table(f"unitemate-v2-matches-{stage}")
        self.records_table = self.dynamodb.Table(f"unitemate-v2-records-{stage}")
        self.namespace = "default"

    def _batch_write_users(self, items: list[dict]) -> None:
        """ユーザーデータをバッチ書き込み."""
        if not items:
            return

        try:
            with self.users_table.batch_writer() as batch:
                for item in items:
                    batch.put_item(Item=item)
        except ClientError as e:
            print(f"Error in batch write: {e}")
            raise

    def _sanitize_user_for_dynamodb(self, user: User) -> dict:
        """DynamoDB保存用にユーザーデータをサニタイズ（空文字列を削除）."""
        user_dict = user.model_dump()

        # discord_usernameが空文字列の場合は属性ごと削除（インデックスから除外）
        if user_dict.get("discord_username") == "":
            del user_dict["discord_username"]

        return user_dict

    def reset_user_stats(self, user: User) -> User:
        """ユーザーの統計情報をリセット."""
        # レートを1500にリセット
        user.rate = 1500
        user.max_rate = 1500

        # 試合数・勝利数をリセット
        user.match_count = 0
        user.win_count = 0
        user.win_rate = 0.0

        # ペナルティリセット（実効ペナルティが5以下の場合）
        effective_penalty = user.penalty_count - user.penalty_correction
        if effective_penalty <= 5:
            user.penalty_count = 0
            user.penalty_correction = 0
            user.last_penalty_time = None
            user.penalty_timeout_until = None

        user.updated_at = int(datetime.now().timestamp())
        return user

    def delete_all_matches(self) -> int:
        """全マッチデータを削除."""
        deleted_count = 0

        try:
            last_evaluated_key = None
            page_count = 0

            while True:
                page_count += 1
                print(f"  → マッチデータページ {page_count} をスキャン中...")

                if last_evaluated_key:
                    response = self.matches_table.scan(
                        ExclusiveStartKey=last_evaluated_key
                    )
                else:
                    response = self.matches_table.scan()

                items = response.get("Items", [])
                print(f"  → ページ {page_count}: {len(items)}件のマッチを発見")

                if items:
                    with self.matches_table.batch_writer() as batch:
                        for item in items:
                            namespace = item.get("namespace")
                            match_id = item.get("match_id")
                            if namespace and match_id is not None:
                                batch.delete_item(
                                    Key={"namespace": namespace, "match_id": match_id}
                                )
                                deleted_count += 1

                    if deleted_count % 100 == 0:
                        print(f"  → {deleted_count}件のマッチを削除...")

                last_evaluated_key = response.get("LastEvaluatedKey")
                if not last_evaluated_key:
                    break

            return deleted_count

        except ClientError as e:
            print(f"Error deleting matches: {e}")
            return deleted_count

    def delete_all_records(self) -> int:
        """全レコードデータを削除."""
        deleted_count = 0

        try:
            last_evaluated_key = None
            page_count = 0

            while True:
                page_count += 1
                print(f"  → レコードデータページ {page_count} をスキャン中...")

                if last_evaluated_key:
                    response = self.records_table.scan(
                        ExclusiveStartKey=last_evaluated_key
                    )
                else:
                    response = self.records_table.scan()

                items = response.get("Items", [])
                print(f"  → ページ {page_count}: {len(items)}件のレコードを発見")

                if items:
                    with self.records_table.batch_writer() as batch:
                        for item in items:
                            user_id = item.get("user_id")
                            match_id = item.get("match_id")
                            if user_id and match_id is not None:
                                batch.delete_item(
                                    Key={"user_id": user_id, "match_id": match_id}
                                )
                                deleted_count += 1

                    if deleted_count % 100 == 0:
                        print(f"  → {deleted_count}件のレコードを削除...")

                last_evaluated_key = response.get("LastEvaluatedKey")
                if not last_evaluated_key:
                    break

            return deleted_count

        except ClientError as e:
            print(f"Error deleting records: {e}")
            return deleted_count

    def execute(self, season_id: str) -> dict:
        """データリセット処理を実行."""
        print(f"\n{'='*60}")
        print(f"シーズンデータリセットスクリプト開始: {season_id}")
        print(f"{'='*60}\n")

        # ステップ1: 全ユーザー取得
        print("ステップ1: 全ユーザーデータ取得中...")
        users = []
        last_evaluated_key = None
        page_count = 0

        while True:
            page_count += 1
            if last_evaluated_key:
                response = self.users_table.query(
                    KeyConditionExpression=Key("namespace").eq(self.namespace),
                    ExclusiveStartKey=last_evaluated_key,
                )
            else:
                response = self.users_table.query(
                    KeyConditionExpression=Key("namespace").eq(self.namespace)
                )

            page_items = response.get("Items", [])
            users.extend(page_items)
            print(f"  → ページ {page_count}: {len(page_items)}人 (累計: {len(users)}人)")

            last_evaluated_key = response.get("LastEvaluatedKey")
            if not last_evaluated_key:
                break

        print(f"\n  → 合計 {len(users)}人のユーザーデータを取得\n")

        # ステップ2: ユーザー統計リセット
        print("ステップ2: ユーザー統計リセット中...")
        processed_count = 0
        error_count = 0
        batch_items = []
        BATCH_SIZE = 25

        for idx, user_data in enumerate(users, 1):
            try:
                user = User(**user_data)

                # 統計情報をリセット
                user = self.reset_user_stats(user)

                # バッチに追加（空文字列をNoneに変換）
                batch_items.append(self._sanitize_user_for_dynamodb(user))
                processed_count += 1

                # バッチ書き込み
                if len(batch_items) >= BATCH_SIZE:
                    self._batch_write_users(batch_items)
                    print(
                        f"  → 進捗: {processed_count}/{len(users)} "
                        f"({processed_count*100//len(users)}%)"
                    )
                    batch_items = []

            except Exception as e:
                print(f"  ✗ エラー ({user_data.get('user_id', 'unknown')}): {e}")
                error_count += 1
                continue

        # 残りのバッチ書き込み
        if batch_items:
            self._batch_write_users(batch_items)

        print(f"\n  → ユーザー統計リセット完了: {processed_count}人\n")

        # ステップ3: マッチデータ削除
        print("ステップ3: マッチデータ削除中...")
        deleted_matches = self.delete_all_matches()
        print(f"\n  → マッチデータ削除完了: {deleted_matches}件\n")

        # ステップ4: レコードデータ削除
        print("ステップ4: レコードデータ削除中...")
        deleted_records = self.delete_all_records()
        print(f"\n  → レコードデータ削除完了: {deleted_records}件\n")

        print(f"{'='*60}")
        print(f"処理完了")
        print(f"{'='*60}")
        print(f"リセットユーザー数: {processed_count}")
        print(f"エラー数: {error_count}")
        print(f"削除マッチ数: {deleted_matches}")
        print(f"削除レコード数: {deleted_records}")
        print(f"{'='*60}\n")

        return {
            "season_id": season_id,
            "reset_users": processed_count,
            "error_count": error_count,
            "deleted_matches": deleted_matches,
            "deleted_records": deleted_records,
        }


def main():
    """メイン処理."""
    parser = argparse.ArgumentParser(description="Season data reset script")
    parser.add_argument(
        "--stage", required=True, choices=["dev", "prod"], help="Environment stage"
    )
    parser.add_argument(
        "--season-id", required=True, help="Season ID (e.g., season_6)"
    )
    parser.add_argument(
        "--confirm", action="store_true", help="Skip confirmation prompt"
    )

    args = parser.parse_args()

    # 確認プロンプト
    print("\n" + "=" * 60)
    print("⚠️  警告: データリセット処理を実行します")
    print("=" * 60)
    print(f"環境: {args.stage}")
    print(f"シーズン: {args.season_id}")
    print("\n以下のデータが削除/リセットされます:")
    print("  - 全ユーザーのレート → 1500")
    print("  - 全ユーザーの試合数・勝利数 → 0")
    print("  - 全ユーザーのペナルティ（条件付き）")
    print("  - 全マッチデータ")
    print("  - 全レコードデータ")
    print("=" * 60)

    if not args.confirm:
        confirmation = input("\n本当に実行しますか？ (yes/no): ")
        if confirmation.lower() != "yes":
            print("処理をキャンセルしました。")
            return

    # スクリプト実行
    script = SeasonResetScript(stage=args.stage)
    result = script.execute(season_id=args.season_id)

    print("\n実行結果:")
    import json

    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
