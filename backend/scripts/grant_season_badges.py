#!/usr/bin/env python3
"""Season badge grant script - runs locally to avoid API Gateway timeout."""

import argparse
import os
import sys
from datetime import datetime

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

# プロジェクトルートをパスに追加
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.models.season import Season
from src.models.user import SeasonRecord, User


class BadgeGrantScript:
    """勲章付与スクリプト."""

    def __init__(self, stage: str):
        """初期化."""
        self.dynamodb = boto3.resource("dynamodb", region_name="ap-northeast-1")
        self.users_table = self.dynamodb.Table(f"unitemate-v2-users-{stage}")
        self.rankings_table = self.dynamodb.Table(f"unitemate-v2-rankings-{stage}")
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

    def get_current_rankings(self) -> dict:
        """現在のランキングを取得してuser_id -> rank のマップを返す."""
        try:
            response = self.rankings_table.query(
                KeyConditionExpression=Key("ranking_type").eq("rate")
                & Key("rank").between(1, 100),
                ScanIndexForward=True,
            )
            rank_map = {}
            for ranking_entry in response.get("Items", []):
                user_id = ranking_entry.get("user_id")
                rank = int(ranking_entry.get("rank", 0))
                if user_id:
                    rank_map[user_id] = rank
            return rank_map
        except ClientError as e:
            print(f"Error getting rankings: {e}")
            return {}

    def determine_badges_for_user(
        self,
        match_count: int,
        final_rank: int | None,
        penalty_count: int,
        penalty_correction: int,
    ) -> list[str]:
        """ユーザーの成績に応じて付与するバッジを決定."""
        earned_badges = []
        effective_penalty = max(0, penalty_count - penalty_correction)

        # 順位バッジ
        if final_rank is not None:
            if final_rank == 1:
                earned_badges.append("badge_148")  # 1位
            elif final_rank == 2:
                earned_badges.append("badge_149")  # 2位
            elif final_rank == 3:
                earned_badges.append("badge_150")  # 3位
            elif final_rank <= 10:
                earned_badges.append("badge_151")  # TOP10
            elif final_rank <= 100:
                earned_badges.append("badge_152")  # TOP100

        # 試合数バッジ（最大到達数のみ）
        if match_count >= 200:
            earned_badges.append("badge_154")  # 200戦
        elif match_count >= 100:
            earned_badges.append("badge_153")  # 100戦

        # ゴールド免許（ペナルティなしで50戦以上）
        if match_count >= 50 and effective_penalty == 0:
            earned_badges.append("badge_155")  # ゴールド免許

        return earned_badges

    def grant_badges_to_user(self, user: User, badge_ids: list[str]) -> User:
        """ユーザーにバッジを付与."""
        current_badges = set(user.owned_badges)
        new_badges = []

        for badge_id in badge_ids:
            if badge_id and badge_id not in current_badges:
                current_badges.add(badge_id)
                new_badges.append(badge_id)

        user.owned_badges = list(current_badges)
        user.updated_at = int(datetime.now().timestamp())

        if new_badges:
            print(f"  → 新規バッジ付与: {new_badges}")

        return user

    def _sanitize_user_for_dynamodb(self, user: User) -> dict:
        """DynamoDB保存用にユーザーデータをサニタイズ（空文字列を削除）."""
        user_dict = user.model_dump()

        # discord_usernameが空文字列の場合は属性ごと削除（インデックスから除外）
        if user_dict.get("discord_username") == "":
            del user_dict["discord_username"]

        return user_dict

    def execute(self, season_id: str) -> dict:
        """勲章付与処理を実行."""
        print(f"\n{'='*60}")
        print(f"シーズン勲章付与スクリプト開始: {season_id}")
        print(f"{'='*60}\n")

        # ランキング取得
        print("ステップ1: ランキングデータ取得中...")
        rank_map = self.get_current_rankings()
        print(f"  → {len(rank_map)}件のランキングデータを取得\n")

        # 全ユーザー取得
        print("ステップ2: 全ユーザーデータ取得中...")
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

        # シーズン情報
        season = Season(
            data_type="SEASON",
            id=season_id,
            name=f"Season {season_id}",
            start_date=0,
            end_date=int(datetime.now().timestamp()),
            is_active=False,
        )

        # ユーザー処理
        print("ステップ3: 勲章付与処理中...")
        processed_count = 0
        error_count = 0
        batch_items = []
        BATCH_SIZE = 25

        for idx, user_data in enumerate(users, 1):
            try:
                user = User(**user_data)

                # 最終順位取得
                final_rank = rank_map.get(user.user_id)

                # バッジ決定
                earned_badges = self.determine_badges_for_user(
                    match_count=user.match_count,
                    final_rank=final_rank,
                    penalty_count=user.penalty_count,
                    penalty_correction=user.penalty_correction,
                )

                # シーズンレコード作成
                season_record = SeasonRecord(
                    season_id=season.id,
                    season_name=season.name,
                    total_matches=user.match_count,
                    win_count=user.win_count,
                    final_rate=user.rate,
                    max_rate=user.max_rate,
                    final_rank=final_rank,
                    earned_badges=earned_badges,
                )

                # past_seasonsに追加
                if not isinstance(user.past_seasons, list):
                    user.past_seasons = []
                user.past_seasons.append(season_record.model_dump())

                # バッジ付与
                user = self.grant_badges_to_user(user, season_record.earned_badges)

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

        print(f"\n{'='*60}")
        print(f"処理完了")
        print(f"{'='*60}")
        print(f"処理ユーザー数: {processed_count}")
        print(f"エラー数: {error_count}")
        print(f"ランキング取得数: {len(rank_map)}")
        print(f"{'='*60}\n")

        return {
            "season_id": season_id,
            "processed_users": processed_count,
            "error_count": error_count,
            "rankings_count": len(rank_map),
        }


def main():
    """メイン処理."""
    parser = argparse.ArgumentParser(description="Season badge grant script")
    parser.add_argument("--stage", required=True, choices=["dev", "prod"], help="Environment stage")
    parser.add_argument("--season-id", required=True, help="Season ID (e.g., season_7)")

    args = parser.parse_args()

    # スクリプト実行
    script = BadgeGrantScript(stage=args.stage)
    result = script.execute(season_id=args.season_id)

    print("\n実行結果:")
    import json
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
