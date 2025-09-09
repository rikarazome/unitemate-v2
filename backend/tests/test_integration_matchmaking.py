"""
マッチメイク処理の統合テスト

新マッチメイクシステム全体の統合テストを実行し、以下の検証を行う：
1. キューロック/アンロック機構の動作確認
2. プレイヤーデータ取得と新アルゴリズムへの変換
3. マッチメイク実行とロール割り当て
4. マッチレコード作成と正しいフォーマット
5. VC割り当ての正常動作
6. 複合キー構造での全DynamoDB操作
7. マッチしたプレイヤーのキューからの削除
"""

import json
import time
import pytest
import boto3
from moto import mock_aws
from decimal import Decimal
from unittest.mock import patch

from src.handlers.matchmaking import (
    match_make,
    matchmake_top_first,
    acquire_lock,
    release_lock,
    is_locked,
    get_queue_players,
    assign_voice_channels,
    get_next_match_id,
    create_match_record,
    remove_matched_players,
    NAMESPACE,
)


@mock_aws
class TestMatchmakingIntegration:
    """マッチメイク統合テスト"""

    def setup_method(self, method):
        """テストセットアップ"""
        # DynamoDBテーブル作成
        dynamodb = boto3.resource("dynamodb", region_name="us-east-1")

        # QueueTable作成（Legacy準拠の複合キー構造）
        self.queue_table = dynamodb.create_table(
            TableName="test-queue-table",
            KeySchema=[
                {"AttributeName": "namespace", "KeyType": "HASH"},
                {"AttributeName": "user_id", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "namespace", "AttributeType": "S"},
                {"AttributeName": "user_id", "AttributeType": "S"},
                {"AttributeName": "rate", "AttributeType": "N"},
            ],
            LocalSecondaryIndexes=[
                {
                    "IndexName": "rate_index",
                    "KeySchema": [
                        {"AttributeName": "namespace", "KeyType": "HASH"},
                        {"AttributeName": "rate", "KeyType": "RANGE"},
                    ],
                    "Projection": {"ProjectionType": "ALL"},
                }
            ],
            BillingMode="PAY_PER_REQUEST",
        )

        # MatchesTable作成（Legacy準拠の複合キー構造）
        self.matches_table = dynamodb.create_table(
            TableName="test-matches-table",
            KeySchema=[
                {"AttributeName": "namespace", "KeyType": "HASH"},
                {"AttributeName": "match_id", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "namespace", "AttributeType": "S"},
                {"AttributeName": "match_id", "AttributeType": "N"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )

        # UsersTable作成（Legacy準拠の複合キー構造）
        self.users_table = dynamodb.create_table(
            TableName="test-users-table",
            KeySchema=[
                {"AttributeName": "namespace", "KeyType": "HASH"},
                {"AttributeName": "user_id", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "namespace", "AttributeType": "S"},
                {"AttributeName": "user_id", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )

        # RecordsTable作成（Legacy準拠の複合キー構造）
        self.records_table = dynamodb.create_table(
            TableName="test-records-table",
            KeySchema=[
                {"AttributeName": "namespace", "KeyType": "HASH"},
                {"AttributeName": "record_id", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "namespace", "AttributeType": "S"},
                {"AttributeName": "record_id", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )

    def create_test_players(self, count=10):
        """テスト用プレイヤーデータ作成"""
        roles = ["TOP", "MID", "BOTTOM", "SUPPORT", "TANK"]
        players = []

        for i in range(count):
            user_id = f"player_{i + 1}"
            rate = 1500 + (i * 50)  # 1500, 1550, 1600, ...
            best_rate = rate + 100
            role = roles[i % len(roles)]

            # キューにプレイヤーを追加（Legacy準拠の複合キー）
            self.queue_table.put_item(
                Item={
                    "namespace": NAMESPACE,
                    "user_id": user_id,
                    "rate": rate,  # Decimal型ではなくint型で保存
                    "best": best_rate,  # Decimal型ではなくint型で保存
                    "desired_role": role,
                    "inqueued_at": int(time.time()),
                    "blocking": "",
                    "range_spread_speed": 10,
                    "range_spread_count": 0,
                }
            )

            players.append({"user_id": user_id, "rate": rate, "best": best_rate, "role": role})

        return players

    def initialize_meta_item(self):
        """META項目を初期化"""
        self.queue_table.put_item(
            Item={
                "namespace": NAMESPACE,
                "user_id": "#META#",
                "lock": 0,
                "UnusedVC": list(range(1, 100, 2)),  # [1, 3, 5, 7, ...]
                "LatestMatchID": 0,
            }
        )

    @patch.dict(
        "os.environ",
        {
            "QUEUE_TABLE_NAME": "test-queue-table",
            "MATCHES_TABLE_NAME": "test-matches-table",
            "USERS_TABLE_NAME": "test-users-table",
            "RECORDS_TABLE_NAME": "test-records-table",
        },
    )
    def test_full_matchmaking_process(self):
        """完全なマッチメイク処理の統合テスト"""
        # テストデータ準備
        self.create_test_players(10)
        self.initialize_meta_item()

        # Lambda関数呼び出し用のイベント作成
        event = {}
        context = {}

        # マッチメイク処理を実行
        response = match_make(event, context)

        # レスポンス検証
        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert body["message"] == "Match created successfully"
        assert "match_id" in body
        assert body["matched_players"] == 10

        # マッチレコードの検証
        match_id = body["match_id"]
        match_response = self.matches_table.get_item(Key={"namespace": NAMESPACE, "match_id": match_id})

        assert "Item" in match_response
        match_item = match_response["Item"]

        # マッチレコードの基本構造確認
        assert match_item["namespace"] == NAMESPACE
        assert match_item["match_id"] == match_id
        assert match_item["status"] == "matched"
        assert "team_a" in match_item
        assert "team_b" in match_item
        assert "vc_a" in match_item
        assert "vc_b" in match_item
        assert "matched_unixtime" in match_item

        # チーム構成確認（各チーム5人）
        team_a = match_item["team_a"]
        team_b = match_item["team_b"]
        assert len(team_a) == 5
        assert len(team_b) == 5

        # 新フォーマット確認：[user_id, rate, best_rate, role]
        for player_data in team_a + team_b:
            assert len(player_data) == 4  # [user_id, rate, best_rate, role]
            assert isinstance(player_data[0], str)  # user_id
            assert isinstance(player_data[1], int)  # rate
            assert isinstance(player_data[2], int)  # best_rate
            assert isinstance(player_data[3], str)  # role
            assert player_data[3] in ["TOP", "MID", "BOTTOM", "SUPPORT", "TANK"]

        # ロール分布確認（各ロールに1人ずつ）
        team_a_roles = [player[3] for player in team_a]
        team_b_roles = [player[3] for player in team_b]
        roles = ["TOP", "MID", "BOTTOM", "SUPPORT", "TANK"]

        assert set(team_a_roles) == set(roles)
        assert set(team_b_roles) == set(roles)

        # VC割り当て確認
        vc_a = match_item["vc_A"]
        vc_b = match_item["vc_B"]
        assert vc_a % 2 == 1  # 奇数
        assert vc_b == vc_a + 1  # 連続する偶数

        # キューからプレイヤーが削除されていることを確認
        remaining_players = get_queue_players()
        assert len(remaining_players) == 0

        # META項目のUnusedVCが更新されていることを確認
        meta_response = self.queue_table.get_item(Key={"namespace": NAMESPACE, "user_id": "#META#"})
        meta_item = meta_response["Item"]
        unused_vc = meta_item["UnusedVC"]
        assert vc_a not in unused_vc  # 使用されたVCが除外されている

    @patch.dict(
        "os.environ",
        {
            "QUEUE_TABLE_NAME": "test-queue-table",
            "MATCHES_TABLE_NAME": "test-matches-table",
            "USERS_TABLE_NAME": "test-users-table",
            "RECORDS_TABLE_NAME": "test-records-table",
        },
    )
    def test_insufficient_players(self):
        """プレイヤー不足時の処理テスト"""
        # 9人のプレイヤーを作成（10人未満）
        self.create_test_players(9)
        self.initialize_meta_item()

        event = {}
        context = {}

        response = match_make(event, context)

        # プレイヤー不足で正常にレスポンスが返ることを確認
        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert body["message"] == "Insufficient players"
        assert body["player_count"] == 9

    @patch.dict(
        "os.environ",
        {
            "QUEUE_TABLE_NAME": "test-queue-table",
            "MATCHES_TABLE_NAME": "test-matches-table",
            "USERS_TABLE_NAME": "test-users-table",
            "RECORDS_TABLE_NAME": "test-records-table",
        },
    )
    def test_lock_mechanism(self):
        """ロック機構のテスト"""
        self.initialize_meta_item()

        # ロック取得テスト
        assert not is_locked()
        assert acquire_lock()
        assert is_locked()

        # ロック中のマッチメイク試行
        self.create_test_players(10)
        event = {}
        context = {}

        response = match_make(event, context)

        # ロック中は423エラーが返る
        assert response["statusCode"] == 423
        body = json.loads(response["body"])
        assert "locked" in body["error"].lower()

        # ロック解除テスト
        assert release_lock()
        assert not is_locked()

    @patch.dict(
        "os.environ",
        {
            "QUEUE_TABLE_NAME": "test-queue-table",
            "MATCHES_TABLE_NAME": "test-matches-table",
            "USERS_TABLE_NAME": "test-users-table",
            "RECORDS_TABLE_NAME": "test-records-table",
        },
    )
    def test_voice_channel_assignment(self):
        """VC割り当ての詳細テスト"""
        self.initialize_meta_item()

        # 複数回VC割り当てを実行
        vc_assignments = []
        for i in range(5):
            vc_a, vc_b = assign_voice_channels()
            vc_assignments.append((vc_a, vc_b))

            # VC番号の妥当性確認
            assert vc_a % 2 == 1  # 奇数
            assert vc_b == vc_a + 1  # 連続する偶数

        # 重複がないことを確認
        used_vcs = [vc_a for vc_a, vc_b in vc_assignments]
        assert len(used_vcs) == len(set(used_vcs))  # 重複なし

        # 連続する奇数が割り当てられていることを確認
        assert vc_assignments == [(1, 2), (3, 4), (5, 6), (7, 8), (9, 10)]

    @patch.dict(
        "os.environ",
        {
            "QUEUE_TABLE_NAME": "test-queue-table",
            "MATCHES_TABLE_NAME": "test-matches-table",
            "USERS_TABLE_NAME": "test-users-table",
            "RECORDS_TABLE_NAME": "test-records-table",
        },
    )
    def test_match_id_generation(self):
        """マッチID生成の連続性テスト"""
        self.initialize_meta_item()

        # 複数回マッチID生成
        match_ids = []
        for i in range(5):
            match_id = get_next_match_id()
            match_ids.append(match_id)

        # 連続するIDが生成されることを確認
        assert match_ids == [1, 2, 3, 4, 5]

    @patch.dict(
        "os.environ",
        {
            "QUEUE_TABLE_NAME": "test-queue-table",
            "MATCHES_TABLE_NAME": "test-matches-table",
            "USERS_TABLE_NAME": "test-users-table",
            "RECORDS_TABLE_NAME": "test-records-table",
        },
    )
    def test_composite_key_operations(self):
        """複合キー構造での全DynamoDB操作テスト"""
        self.create_test_players(10)
        self.initialize_meta_item()

        # プレイヤーデータ取得テスト（複合キーでの操作）
        players = get_queue_players()
        assert len(players) == 10

        # 各プレイヤーデータの形式確認
        for player in players:
            assert "id" in player
            assert "rating" in player
            assert "roles" in player
            assert "original_data" in player

            # 複合キーでの元データ確認
            original = player["original_data"]
            assert original["namespace"] == NAMESPACE
            assert "user_id" in original

    @patch.dict(
        "os.environ",
        {
            "QUEUE_TABLE_NAME": "test-queue-table",
            "MATCHES_TABLE_NAME": "test-matches-table",
            "USERS_TABLE_NAME": "test-users-table",
            "RECORDS_TABLE_NAME": "test-records-table",
        },
    )
    def test_role_format_conversion(self):
        """ロール形式変換の確認テスト"""
        # 単一ロール形式でプレイヤーを作成
        self.queue_table.put_item(
            Item={
                "namespace": NAMESPACE,
                "user_id": "test_player",
                "rate": Decimal("1500"),
                "best": Decimal("1600"),
                "desired_role": "TOP",  # 単一文字列形式
                "inqueued_at": int(time.time()),
            }
        )

        # プレイヤーデータ取得
        players = get_queue_players()
        assert len(players) == 1

        player = players[0]
        # 新アルゴリズム用に配列形式に変換されていることを確認
        assert player["roles"] == ["TOP"]
        assert isinstance(player["roles"], list)

    @patch.dict(
        "os.environ",
        {
            "QUEUE_TABLE_NAME": "test-queue-table",
            "MATCHES_TABLE_NAME": "test-matches-table",
            "USERS_TABLE_NAME": "test-users-table",
            "RECORDS_TABLE_NAME": "test-records-table",
        },
    )
    def test_error_handling_and_cleanup(self):
        """エラーハンドリングとクリーンアップのテスト"""
        self.initialize_meta_item()

        # ロックを取得
        assert acquire_lock()
        assert is_locked()

        # エラー発生をシミュレート（プレイヤーなしでマッチメイク実行）
        event = {}
        context = {}

        # プレイヤーが不足している状態でマッチメイク実行
        response = match_make(event, context)

        # レスポンス確認
        assert response["statusCode"] == 200  # プレイヤー不足は正常なレスポンス

        # ロックが適切に解放されていることを確認
        assert not is_locked()
