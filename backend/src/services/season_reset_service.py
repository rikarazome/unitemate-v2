"""Season reset service for handling season transitions."""

import os
from datetime import datetime

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from src.models.season import Season
from src.models.user import SeasonRecord, User


def _log(message: str) -> None:
    """ログ出力（本番環境では抑制）."""
    stage = os.environ.get("STAGE", "dev")
    if stage != "prod":
        print(message)


class SeasonResetService:
    """シーズンリセット処理サービス."""

    def __init__(self):
        """初期化."""
        self.dynamodb = boto3.resource("dynamodb")
        self.users_table = self.dynamodb.Table(os.environ["USERS_TABLE_NAME"])
        self.rankings_table = self.dynamodb.Table(os.environ["RANKINGS_TABLE_NAME"])
        self.namespace = "default"

    def _batch_write_users(self, items: list[dict]) -> None:
        """ユーザーデータをバッチ書き込み.

        Args:
            items: 書き込むユーザーデータのリスト（最大25件）
        """
        if not items:
            return

        try:
            with self.users_table.batch_writer() as batch:
                for item in items:
                    batch.put_item(Item=item)
        except ClientError as e:
            print(f"Error in batch write: {e}")
            raise

    def get_current_rankings(self) -> list[dict]:
        """現在のランキングを取得.

        ランキングテーブルから上位100位までのデータを取得する。
        パーティションキー: ranking_type = "rate"
        ソートキー: rank (1～100)
        """
        try:
            # ranking_type="rate" かつ rank が 1～100 のレコードを取得
            response = self.rankings_table.query(
                KeyConditionExpression=Key("ranking_type").eq("rate") & Key("rank").between(1, 100),
                ScanIndexForward=True,  # rankの昇順（1位から100位）
            )
            return response.get("Items", [])
        except ClientError as e:
            _log(f"Error getting rankings: {e}")
            return []

    def determine_badges_for_user(
        self,
        season_id: str,
        match_count: int,
        win_count: int,
        final_rank: int | None,
        penalty_count: int,
        penalty_correction: int,
        badge_mapping: dict,
    ) -> list[str]:
        """ユーザーの成績に応じて付与するバッジを決定.

        処理フロー:
        1. 実効ペナルティを計算
        2. 順位バッジの判定
           - 1位、2位、3位
           - TOP10（4～10位）
           - TOP100（11～100位）
        3. 試合数バッジの判定
           - 100戦～1000戦（100戦刻み）
           - 最大到達数のバッジのみ付与
        4. 特別バッジの判定
           - ゴールド免許（ペナルティ0で50戦以上）

        Args:
            season_id: シーズンID（例: "season_2024_winter"）
            match_count: 試合数
            win_count: 勝利数
            final_rank: 最終順位（Noneの場合はランク外）
            penalty_count: 累積ペナルティ数
            penalty_correction: ペナルティ軽減数
            badge_mapping: 管理者が設定したバッジマッピング

        Returns:
            list[str]: 付与するバッジIDのリスト
        """
        earned_badges = []

        # ステップ1: 実効ペナルティ数を計算
        # 累積ペナルティから軽減数を引いた値（0未満にはならない）
        effective_penalty = max(0, penalty_count - penalty_correction)

        # ステップ2: 順位バッジ（ランキング報酬）
        # 管理者が設定したバッジマッピングから該当する順位のバッジを付与
        if final_rank is not None:
            if final_rank == 1 and badge_mapping.get("rank_1st"):
                earned_badges.append(badge_mapping["rank_1st"])
            elif final_rank == 2 and badge_mapping.get("rank_2nd"):
                earned_badges.append(badge_mapping["rank_2nd"])
            elif final_rank == 3 and badge_mapping.get("rank_3rd"):
                earned_badges.append(badge_mapping["rank_3rd"])
            elif final_rank <= 10 and badge_mapping.get("rank_top10"):
                earned_badges.append(badge_mapping["rank_top10"])
            elif final_rank <= 100 and badge_mapping.get("rank_top100"):
                earned_badges.append(badge_mapping["rank_top100"])

        # ステップ3: 試合数バッジ（最大到達数のみ）
        # 例: 350戦の場合、300戦バッジのみ付与（100戦、200戦は付与しない）
        battle_thresholds = [
            (1000, "battle_1000"),
            (900, "battle_900"),
            (800, "battle_800"),
            (700, "battle_700"),
            (600, "battle_600"),
            (500, "battle_500"),
            (400, "battle_400"),
            (300, "battle_300"),
            (200, "battle_200"),
            (100, "battle_100"),
        ]
        for threshold, key in battle_thresholds:
            if match_count >= threshold and badge_mapping.get(key):
                earned_badges.append(badge_mapping[key])
                break  # 最大到達数のみ付与

        # ステップ4: ゴールド免許バッジ（ペナルティなしで50戦以上）
        # 実効ペナルティが0で、試合数が50以上の場合に付与
        if (
            match_count >= 50
            and effective_penalty == 0
            and badge_mapping.get("gold_license")
        ):
            earned_badges.append(badge_mapping["gold_license"])

        return earned_badges

    def archive_season_data_for_user(
        self,
        user: User,
        season: Season,
        final_rank: int | None,
        badge_mapping: dict,
    ) -> SeasonRecord:
        """ユーザーの現在シーズンデータをアーカイブ用に変換.

        処理フロー:
        1. ユーザーの戦績とランクからバッジを決定
        2. SeasonRecord オブジェクトを作成
           - シーズンID、名前
           - 試合数、勝利数
           - 最終レート、最高レート、最終順位
           - 獲得バッジリスト

        Args:
            user: ユーザーデータ
            season: 終了するシーズン
            final_rank: 最終順位（ランク外の場合はNone）
            badge_mapping: 管理者が設定したバッジマッピング

        Returns:
            SeasonRecord: アーカイブ用のシーズンレコード
        """
        # ステップ1: バッジを決定
        # ユーザーの戦績（試合数、順位、ペナルティ）に基づいて付与するバッジを決定
        earned_badges = self.determine_badges_for_user(
            season_id=season.id,
            match_count=user.match_count,
            win_count=user.win_count,
            final_rank=final_rank,
            penalty_count=user.penalty_count,
            penalty_correction=user.penalty_correction,
            badge_mapping=badge_mapping,
        )

        # ステップ2: SeasonRecord オブジェクトを作成
        # このレコードは user.past_seasons に追加される
        return SeasonRecord(
            season_id=season.id,
            season_name=season.name,
            total_matches=user.match_count,
            win_count=user.win_count,
            final_rate=user.rate,
            max_rate=user.max_rate,  # シーズン中の最高レートを保存
            final_rank=final_rank,
            earned_badges=earned_badges,
        )

    def reset_user_stats(self, user: User) -> User:
        """ユーザーの統計情報をリセット.

        処理フロー:
        1. レート情報をリセット（1500に戻す）
        2. 試合数・勝利数をリセット（0に戻す）
        3. ペナルティを条件付きリセット
           - 実効ペナルティが5以下の場合のみリセット
           - それ以外は維持（悪質なプレイヤーの保護）

        Args:
            user: ユーザーデータ

        Returns:
            User: リセット後のユーザーデータ
        """
        # ステップ1: レートを1500にリセット
        user.rate = 1500
        user.max_rate = 1500

        # ステップ2: 試合数・勝利数をリセット
        user.match_count = 0
        user.win_count = 0
        user.win_rate = 0.0

        # ステップ3: ペナルティリセット（実効ペナルティが5以下の場合）
        # 実効ペナルティ = 累積ペナルティ - 軽減数
        effective_penalty = user.penalty_count - user.penalty_correction
        if effective_penalty <= 5:
            # 軽微なペナルティの場合はリセット
            user.penalty_count = 0
            user.penalty_correction = 0
            user.last_penalty_time = None
            user.penalty_timeout_until = None
        # else: 実効ペナルティが5を超える場合は維持

        user.updated_at = int(datetime.now().timestamp())
        return user

    def grant_badges_to_user(self, user: User, badge_ids: list[str]) -> User:
        """ユーザーにバッジを付与.

        処理フロー:
        1. 現在所有しているバッジをセットとして取得
        2. 付与するバッジIDリストをループ
           - 空でない
           - まだ所有していない
           → 新規バッジとして追加
        3. owned_badges を更新
        4. ログ出力（デバッグ・監査用）

        Args:
            user: ユーザーデータ
            badge_ids: 付与するバッジIDリスト

        Returns:
            User: バッジ付与後のユーザーデータ
        """
        # ステップ1: 現在所有しているバッジをセットとして取得
        current_badges = set(user.owned_badges)
        new_badges = []

        # ステップ2: 付与するバッジIDリストをループ
        for badge_id in badge_ids:
            if badge_id and badge_id not in current_badges:
                # 新規バッジの場合のみ追加
                current_badges.add(badge_id)
                new_badges.append(badge_id)

        # ステップ3: owned_badges を更新
        user.owned_badges = list(current_badges)
        user.updated_at = int(datetime.now().timestamp())

        # ステップ4: ログ出力（新規バッジがある場合）
        if new_badges:
            print(f"Granted new badges to user {user.user_id}: {new_badges}")

        return user

    def execute_badge_grant(self, season_id: str, badge_mapping: dict) -> dict:
        """勲章付与処理を実行（レートリセットなし）.

        処理フロー:
        1. 現在のランキングを取得（順位バッジ付与のため）
        2. 全ユーザーを取得
        3. 各ユーザーごとに以下を実行:
           a. 戦績に応じたバッジを決定
           b. シーズンデータをアーカイブ（past_seasons に追加）
           c. バッジを付与
           ※ レート・試合数はリセットしない
        4. 処理結果の統計情報を返却

        Args:
            season_id: 終了するシーズンID
            badge_mapping: 管理者が設定したバッジマッピング

        Returns:
            dict: 処理結果の統計情報
        """
        print(f"Starting badge grant for season: {season_id}")

        # ステップ1: 現在のランキングを取得
        rankings = self.get_current_rankings()
        rank_map = {}
        for ranking_entry in rankings:
            user_id = ranking_entry.get("user_id")
            rank = int(ranking_entry.get("rank", 0))
            if user_id:
                rank_map[user_id] = rank

        print(f"Retrieved {len(rank_map)} user rankings")

        # ステップ2: 全ユーザーを取得
        try:
            users = []
            last_evaluated_key = None
            page_count = 0

            while True:
                page_count += 1
                print(f"Fetching users page {page_count}...")

                if last_evaluated_key:
                    response = self.users_table.query(
                        KeyConditionExpression=Key("namespace").eq(self.namespace),
                        ExclusiveStartKey=last_evaluated_key
                    )
                else:
                    response = self.users_table.query(
                        KeyConditionExpression=Key("namespace").eq(self.namespace)
                    )

                page_items = response.get("Items", [])
                users.extend(page_items)
                print(f"Page {page_count}: Retrieved {len(page_items)} users (Total: {len(users)})")

                last_evaluated_key = response.get("LastEvaluatedKey")
                if not last_evaluated_key:
                    break

            print(f"Total users fetched: {len(users)} across {page_count} pages")

        except ClientError as e:
            print(f"Error fetching users: {e}")
            return {"error": "Failed to fetch users", "processed": 0}

        # シーズン情報を取得
        season = Season(
            data_type="SEASON",
            id=season_id,
            name=f"Season {season_id}",
            start_date=0,
            end_date=int(datetime.now().timestamp()),
            is_active=False,
        )

        processed_count = 0
        error_count = 0
        batch_items = []
        BATCH_SIZE = 25  # DynamoDBバッチ書き込みの最大サイズ

        # ステップ3: 各ユーザーの処理（勲章付与のみ）
        for user_data in users:
            try:
                user = User(**user_data)

                # 最終順位を取得
                final_rank = rank_map.get(user.user_id)

                # シーズンデータをアーカイブ
                season_record = self.archive_season_data_for_user(
                    user=user,
                    season=season,
                    final_rank=final_rank,
                    badge_mapping=badge_mapping,
                )

                # past_seasons に追加
                if not isinstance(user.past_seasons, list):
                    user.past_seasons = []
                user.past_seasons.append(season_record.model_dump())

                # バッジを付与
                user = self.grant_badges_to_user(user, season_record.earned_badges)

                # ⚠️ レート・試合数はリセットしない（execute_rate_reset で実行）

                # バッチ用にアイテムを追加
                batch_items.append(user.model_dump())
                processed_count += 1

                # バッチサイズに達したら書き込み
                if len(batch_items) >= BATCH_SIZE:
                    self._batch_write_users(batch_items)
                    print(f"Batch write completed. Processed {processed_count} users...")
                    batch_items = []

            except Exception as e:
                print(f"Error processing user {user_data.get('user_id', 'unknown')}: {e}")
                error_count += 1
                continue

        # 残りのアイテムを書き込み
        if batch_items:
            self._batch_write_users(batch_items)
            print(f"Final batch write completed. Total processed: {processed_count} users")

        print(f"Badge grant completed. Processed: {processed_count}, Errors: {error_count}")

        return {
            "season_id": season_id,
            "processed_users": processed_count,
            "error_count": error_count,
            "rankings_count": len(rank_map),
        }

    def execute_rate_reset(self, season_id: str) -> dict:
        """レートリセット処理を実行（レート・試合数リセット + レコード削除）.

        処理フロー:
        1. 全ユーザーを取得
        2. 各ユーザーごとに以下を実行:
           a. 統計情報をリセット（レート、試合数、ペナルティ）
        3. 全試合レコードを削除
        4. 処理結果の統計情報を返却

        Args:
            season_id: リセット対象のシーズンID（ログ用）

        Returns:
            dict: 処理結果の統計情報
        """
        print(f"Starting rate reset for season: {season_id}")

        # ステップ1: 全ユーザーを取得
        try:
            users = []
            last_evaluated_key = None
            page_count = 0

            while True:
                page_count += 1
                print(f"Fetching users page {page_count}...")

                if last_evaluated_key:
                    response = self.users_table.query(
                        KeyConditionExpression=Key("namespace").eq(self.namespace),
                        ExclusiveStartKey=last_evaluated_key
                    )
                else:
                    response = self.users_table.query(
                        KeyConditionExpression=Key("namespace").eq(self.namespace)
                    )

                page_items = response.get("Items", [])
                users.extend(page_items)
                print(f"Page {page_count}: Retrieved {len(page_items)} users (Total: {len(users)})")

                last_evaluated_key = response.get("LastEvaluatedKey")
                if not last_evaluated_key:
                    break

            print(f"Total users fetched: {len(users)} across {page_count} pages")

        except ClientError as e:
            print(f"Error fetching users: {e}")
            return {"error": "Failed to fetch users", "processed": 0}

        processed_count = 0
        error_count = 0
        batch_items = []
        BATCH_SIZE = 25  # DynamoDBバッチ書き込みの最大サイズ

        # ステップ2: 各ユーザーの統計情報をリセット
        for user_data in users:
            try:
                user = User(**user_data)

                # 統計情報をリセット
                user = self.reset_user_stats(user)

                # バッチ用にアイテムを追加
                batch_items.append(user.model_dump())
                processed_count += 1

                # バッチサイズに達したら書き込み
                if len(batch_items) >= BATCH_SIZE:
                    self._batch_write_users(batch_items)
                    print(f"Batch write completed. Processed {processed_count} users...")
                    batch_items = []

            except Exception as e:
                print(f"Error processing user {user_data.get('user_id', 'unknown')}: {e}")
                error_count += 1
                continue

        # 残りのアイテムを書き込み
        if batch_items:
            self._batch_write_users(batch_items)
            print(f"Final batch write completed. Total processed: {processed_count} users")

        # ステップ3: 全試合レコードを削除
        deleted_records = self.delete_all_match_records()

        print(f"Rate reset completed. Processed: {processed_count}, Errors: {error_count}, Deleted records: {deleted_records}")

        return {
            "season_id": season_id,
            "processed_users": processed_count,
            "error_count": error_count,
            "deleted_records": deleted_records,
        }

    def delete_all_match_records(self) -> int:
        """全試合レコードを削除.

        MATCHES_TABLE から全レコードを削除する。
        ページネーション対応で全レコードを取得してから削除。

        Returns:
            int: 削除したレコード数
        """
        matches_table_name = os.environ.get("MATCHES_TABLE_NAME")
        if not matches_table_name:
            print("[WARNING] MATCHES_TABLE_NAME not found in environment")
            return 0

        matches_table = self.dynamodb.Table(matches_table_name)
        deleted_count = 0

        try:
            # 全レコードをスキャンして削除
            last_evaluated_key = None
            page_count = 0

            while True:
                page_count += 1
                print(f"Scanning matches page {page_count}...")

                if last_evaluated_key:
                    response = matches_table.scan(ExclusiveStartKey=last_evaluated_key)
                else:
                    response = matches_table.scan()

                items = response.get("Items", [])
                print(f"Page {page_count}: Found {len(items)} match records")

                # バッチ削除を使用
                if items:
                    try:
                        with matches_table.batch_writer() as batch:
                            for item in items:
                                namespace = item.get("namespace")
                                match_id = item.get("match_id")
                                if namespace and match_id is not None:
                                    batch.delete_item(Key={
                                        "namespace": namespace,
                                        "match_id": match_id
                                    })
                                    deleted_count += 1

                        if deleted_count % 100 == 0:
                            print(f"Deleted {deleted_count} match records...")
                    except Exception as e:
                        print(f"Error in batch delete: {e}")
                        continue

                last_evaluated_key = response.get("LastEvaluatedKey")
                if not last_evaluated_key:
                    break

            print(f"Match record deletion completed. Total deleted: {deleted_count}")
            return deleted_count

        except ClientError as e:
            print(f"Error deleting match records: {e}")
            return deleted_count

    def execute_season_reset(self, season_id: str, badge_mapping: dict) -> dict:
        """シーズンリセット処理を実行（後方互換性のため残す）.

        処理フロー全体:
        1. 現在のランキングを取得（順位バッジ付与のため）
        2. 全ユーザーを取得
        3. 各ユーザーごとに以下を実行:
           a. 戦績に応じたバッジを決定
           b. シーズンデータをアーカイブ（past_seasons に追加）
           c. バッジを付与
           d. 統計情報をリセット（レート、試合数、ペナルティ）
        4. 処理結果の統計情報を返却

        Args:
            season_id: 終了するシーズンID
            badge_mapping: 管理者が設定したバッジマッピング

        Returns:
            dict: 処理結果の統計情報
        """
        print(f"Starting season reset for season: {season_id}")

        # ステップ1: 現在のランキングを取得
        # ランキング情報は順位バッジの付与に使用
        rankings = self.get_current_rankings()
        rank_map = {}
        for ranking_entry in rankings:
            user_id = ranking_entry.get("user_id")
            rank = int(ranking_entry.get("rank", 0))
            if user_id:
                rank_map[user_id] = rank

        print(f"Retrieved {len(rank_map)} user rankings")

        # ステップ2: 全ユーザーを取得（ページネーション対応）
        # DynamoDBは1回のクエリで最大1MBまでしか返さないため、
        # LastEvaluatedKeyを使って全ユーザーを取得する
        try:
            users = []
            last_evaluated_key = None
            page_count = 0

            while True:
                page_count += 1
                print(f"Fetching users page {page_count}...")

                if last_evaluated_key:
                    response = self.users_table.query(
                        KeyConditionExpression=Key("namespace").eq(self.namespace),
                        ExclusiveStartKey=last_evaluated_key
                    )
                else:
                    response = self.users_table.query(
                        KeyConditionExpression=Key("namespace").eq(self.namespace)
                    )

                page_items = response.get("Items", [])
                users.extend(page_items)
                print(f"Page {page_count}: Retrieved {len(page_items)} users (Total: {len(users)})")

                # 次のページがあるかチェック
                last_evaluated_key = response.get("LastEvaluatedKey")
                if not last_evaluated_key:
                    break

            print(f"Total users fetched: {len(users)} across {page_count} pages")

        except ClientError as e:
            print(f"Error fetching users: {e}")
            return {"error": "Failed to fetch users", "processed": 0}

        # シーズン情報を取得
        # TODO: SeasonService.get_season_by_id() を使用して実際のシーズンデータを取得
        season = Season(
            data_type="SEASON",
            id=season_id,
            name=f"Season {season_id}",
            start_date=0,
            end_date=int(datetime.now().timestamp()),
            is_active=False,
        )

        processed_count = 0
        error_count = 0
        batch_items = []
        BATCH_SIZE = 25  # DynamoDBバッチ書き込みの最大サイズ

        # ステップ3: 各ユーザーの処理
        for user_data in users:
            try:
                # DynamoDBから取得したデータをUserオブジェクトに変換
                # past_seasonsはdictのリストとして取得される可能性があるため、
                # まず生データとして保持し、後で適切に処理する
                user = User(**user_data)

                # 3a. 最終順位を取得（ランク外の場合はNone）
                final_rank = rank_map.get(user.user_id)

                # 3b. 現在のシーズンデータをアーカイブ
                # - 戦績、バッジ、最終順位を SeasonRecord として保存
                season_record = self.archive_season_data_for_user(
                    user=user,
                    season=season,
                    final_rank=final_rank,
                    badge_mapping=badge_mapping,
                )

                # past_seasons に追加（シーズン履歴として保存）
                # SeasonRecordオブジェクトをdictに変換してから追加
                # DynamoDBに保存する際はdict形式が必要
                if not isinstance(user.past_seasons, list):
                    user.past_seasons = []
                user.past_seasons.append(season_record.model_dump())

                # 3c. バッジを付与
                # - earned_badges に含まれるバッジIDを owned_badges に追加
                user = self.grant_badges_to_user(user, season_record.earned_badges)

                # 3d. 統計情報をリセット
                # - レート1500、試合数0、勝率0
                # - ペナルティは条件付きリセット（実効ペナルティ≤5）
                user = self.reset_user_stats(user)

                # バッチ用にアイテムを追加
                batch_items.append(user.model_dump())
                processed_count += 1

                # バッチサイズに達したら書き込み
                if len(batch_items) >= BATCH_SIZE:
                    self._batch_write_users(batch_items)
                    print(f"Batch write completed. Processed {processed_count} users...")
                    batch_items = []

            except Exception as e:
                print(f"Error processing user {user_data.get('user_id', 'unknown')}: {e}")
                error_count += 1
                continue

        # 残りのアイテムを書き込み
        if batch_items:
            self._batch_write_users(batch_items)
            print(f"Final batch write completed. Total processed: {processed_count} users")

        print(f"Season reset completed. Processed: {processed_count}, Errors: {error_count}")

        # ステップ4: 処理結果を返却
        return {
            "season_id": season_id,
            "processed_users": processed_count,
            "error_count": error_count,
            "rankings_count": len(rank_map),
        }
