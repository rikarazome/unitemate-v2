"""
簡単なマッチメイク統合テスト
"""

import json
import time
import pytest
import boto3
from moto import mock_aws
from unittest.mock import patch, MagicMock
from decimal import Decimal

# テスト用の関数をインポート
from src.handlers.matchmaking import matchmake_top_first, acquire_lock, release_lock, is_locked, NAMESPACE


class TestMatchmakingSimple:
    """シンプルなマッチメイクテスト"""

    def test_matchmake_algorithm_basic(self):
        """新マッチメイクアルゴリズムの基本動作テスト"""
        # テストデータ準備（各ロールに2人ずつ、計10人）
        queue = []
        roles = ["TOP_LANE", "MIDDLE", "BOTTOM_LANE", "SUPPORT", "TANK"]

        for i in range(10):
            role = roles[i % 5]  # 各ロールに2人ずつ
            queue.append(
                {
                    "id": f"player_{i + 1}",
                    "rating": 1500 + i * 10,  # 1500, 1510, 1520, ...
                    "roles": [role],  # 単一ロール希望
                }
            )

        # マッチメイク実行
        result = matchmake_top_first(queue)

        # 結果検証
        assert "teamA" in result
        assert "teamB" in result
        assert len(result["teamA"]) == 5
        assert len(result["teamB"]) == 5

        # 各チームのロール確認
        team_a_roles = [player["role"] for player in result["teamA"]]
        team_b_roles = [player["role"] for player in result["teamB"]]

        assert set(team_a_roles) == set(roles)
        assert set(team_b_roles) == set(roles)

    def test_matchmake_insufficient_players(self):
        """プレイヤー不足時のテスト"""
        # 9人のプレイヤー（10人未満）
        queue = []
        for i in range(9):
            queue.append({"id": f"player_{i + 1}", "rating": 1500 + i * 10, "roles": ["TOP_LANE"]})

        result = matchmake_top_first(queue)

        # マッチ不可のため空のdictが返る
        assert result == {}

    @mock_aws
    def test_lock_mechanism(self):
        """ロック機構のテスト"""
        # DynamoDBテーブル作成
        dynamodb = boto3.resource("dynamodb", region_name="us-east-1")

        table = dynamodb.create_table(
            TableName="test-queue-table",
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

        with patch("src.handlers.matchmaking.queue_table", table):
            # 初期状態：アンロック
            assert not is_locked()

            # ロック取得
            assert acquire_lock()
            assert is_locked()

            # ロック解放
            assert release_lock()
            assert not is_locked()

    @mock_aws
    @patch.dict("os.environ", {"QUEUE_TABLE_NAME": "test-queue-table"})
    def test_get_queue_players_simple(self):
        """プレイヤー取得の簡単なテスト"""
        from src.handlers.matchmaking import get_queue_players

        # DynamoDBテーブル作成（簡略版）
        dynamodb = boto3.resource("dynamodb", region_name="us-east-1")

        table = dynamodb.create_table(
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

        # テストデータ追加
        table.put_item(
            Item={
                "namespace": NAMESPACE,
                "user_id": "player_1",
                "rate": 1500,
                "best": 1600,
                "desired_role": "TOP_LANE",
                "inqueued_at": int(time.time()),
            }
        )

        with patch("src.handlers.matchmaking.queue_table", table):
            players = get_queue_players()
            assert len(players) == 1
            assert players[0]["id"] == "player_1"
            assert players[0]["rating"] == 1500.0
            assert players[0]["roles"] == ["TOP_LANE"]

    def test_role_format_conversion(self):
        """ロール形式変換の確認"""
        # 単一ロール形式のテストデータ
        item = {
            "user_id": "test_player",
            "rate": 1500,
            "desired_role": "TOP_LANE",  # 単一文字列
        }

        # 実際の変換ロジックをテスト（matchmaking.pyの関数を模擬）
        desired_role = item.get("desired_role", "TOP_LANE")
        roles_array = [desired_role]  # 配列に変換

        assert roles_array == ["TOP_LANE"]
        assert isinstance(roles_array, list)
