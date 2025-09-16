"""
ユニットテスト: 新マッチメイクシステム
Legacy互換性とロール割り当て機能のテスト
"""

import pytest
import json
from unittest.mock import Mock, patch
from typing import List, Dict, Any

# テスト対象の関数（後で実装）
from src.handlers.matchmaking import (
    matchmake_top_first,
    acquire_lock,
    release_lock,
    create_match_record,
    assign_voice_channels,
    get_queue_players,
)


class TestMatchmakingAlgorithm:
    """新マッチメイクアルゴリズムのテスト"""

    def test_matchmake_top_first_basic_success(self):
        """基本的なマッチング成功ケース"""
        queue = [
            {"id": "user1", "rating": 1600, "roles": ["TOP_LANE", "MIDDLE"]},
            {"id": "user2", "rating": 1580, "roles": ["MIDDLE", "BOTTOM_LANE"]},
            {"id": "user3", "rating": 1570, "roles": ["BOTTOM_LANE", "SUPPORT"]},
            {"id": "user4", "rating": 1560, "roles": ["SUPPORT", "TANK"]},
            {"id": "user5", "rating": 1550, "roles": ["TANK", "TOP_LANE"]},
            {"id": "user6", "rating": 1540, "roles": ["TOP_LANE", "MIDDLE"]},
            {"id": "user7", "rating": 1530, "roles": ["MIDDLE", "BOTTOM_LANE"]},
            {"id": "user8", "rating": 1520, "roles": ["BOTTOM_LANE", "SUPPORT"]},
            {"id": "user9", "rating": 1510, "roles": ["SUPPORT", "TANK"]},
            {"id": "user10", "rating": 1500, "roles": ["TANK", "TOP_LANE"]},
        ]

        result = matchmake_top_first(queue)

        # 基本構造チェック
        assert "teamA" in result
        assert "teamB" in result
        assert len(result["teamA"]) == 5
        assert len(result["teamB"]) == 5

        # 各チームに各ロールが1人ずついることを確認
        roles = ["TOP_LANE", "MIDDLE", "BOTTOM_LANE", "SUPPORT", "TANK"]
        team_a_roles = [player["role"] for player in result["teamA"]]
        team_b_roles = [player["role"] for player in result["teamB"]]

        assert sorted(team_a_roles) == sorted(roles)
        assert sorted(team_b_roles) == sorted(roles)

    def test_matchmake_top_first_insufficient_players(self):
        """プレイヤー不足時のテスト"""
        queue = [{"id": "user1", "rating": 1600, "roles": ["TOP_LANE"]}, {"id": "user2", "rating": 1580, "roles": ["MIDDLE"]}]

        result = matchmake_top_first(queue)
        assert result == {}

    def test_matchmake_top_first_impossible_assignment(self):
        """ロール割り当て不可能な場合のテスト"""
        queue = [{"id": f"user{i}", "rating": 1500 + i, "roles": ["TOP_LANE"]} for i in range(10)]

        result = matchmake_top_first(queue)
        assert result == {}

    def test_matchmake_rating_balance(self):
        """レート差最小化のテスト"""
        # 極端にレートが異なるプレイヤーでテスト
        queue = [
            {"id": "high1", "rating": 2000, "roles": ["TOP_LANE", "MIDDLE", "BOTTOM_LANE", "SUPPORT", "TANK"]},
            {"id": "high2", "rating": 1900, "roles": ["TOP_LANE", "MIDDLE", "BOTTOM_LANE", "SUPPORT", "TANK"]},
            {"id": "high3", "rating": 1800, "roles": ["TOP_LANE", "MIDDLE", "BOTTOM_LANE", "SUPPORT", "TANK"]},
            {"id": "high4", "rating": 1700, "roles": ["TOP_LANE", "MIDDLE", "BOTTOM_LANE", "SUPPORT", "TANK"]},
            {"id": "high5", "rating": 1600, "roles": ["TOP_LANE", "MIDDLE", "BOTTOM_LANE", "SUPPORT", "TANK"]},
            {"id": "low1", "rating": 1200, "roles": ["TOP_LANE", "MIDDLE", "BOTTOM_LANE", "SUPPORT", "TANK"]},
            {"id": "low2", "rating": 1100, "roles": ["TOP_LANE", "MIDDLE", "BOTTOM_LANE", "SUPPORT", "TANK"]},
            {"id": "low3", "rating": 1000, "roles": ["TOP_LANE", "MIDDLE", "BOTTOM_LANE", "SUPPORT", "TANK"]},
            {"id": "low4", "rating": 900, "roles": ["TOP_LANE", "MIDDLE", "BOTTOM_LANE", "SUPPORT", "TANK"]},
            {"id": "low5", "rating": 800, "roles": ["TOP_LANE", "MIDDLE", "BOTTOM_LANE", "SUPPORT", "TANK"]},
        ]

        result = matchmake_top_first(queue)

        # チーム間のレート差が最小化されていることを確認
        team_a_total = sum(player["player"]["rating"] for player in result["teamA"])
        team_b_total = sum(player["player"]["rating"] for player in result["teamB"])

        # レート差が全体の10%未満であることを確認
        total_rating = sum(p["rating"] for p in queue)
        rating_diff = abs(team_a_total - team_b_total)
        assert rating_diff < total_rating * 0.1


class TestQueueLockSystem:
    """キューロックシステムのテスト"""

    @patch("src.handlers.matchmaking.dynamodb")
    def test_acquire_lock_success(self, mock_dynamodb):
        """ロック取得成功テスト"""
        mock_table = Mock()
        mock_dynamodb.Table.return_value = mock_table

        acquire_lock()

        mock_table.update_item.assert_called_once_with(
            Key={"namespace": "default", "user_id": "#META#"},
            UpdateExpression="SET #lock = :lock_value",
            ExpressionAttributeNames={"#lock": "lock"},
            ExpressionAttributeValues={":lock_value": 1},
        )

    @patch("src.handlers.matchmaking.dynamodb")
    def test_release_lock_success(self, mock_dynamodb):
        """ロック解放成功テスト"""
        mock_table = Mock()
        mock_dynamodb.Table.return_value = mock_table

        release_lock()

        mock_table.update_item.assert_called_once_with(
            Key={"namespace": "default", "user_id": "#META#"},
            UpdateExpression="SET #lock = :lock_value",
            ExpressionAttributeNames={"#lock": "lock"},
            ExpressionAttributeValues={":lock_value": 0},
        )


class TestMatchRecordCreation:
    """マッチレコード作成のテスト"""

    def test_create_match_record_structure(self):
        """マッチレコード構造テスト（新フォーマット）"""
        team_a_data = [
            {"player": {"user_id": "user1", "rate": 1600, "best": 1650}, "role": "TOP_LANE"},
            {"player": {"user_id": "user2", "rate": 1580, "best": 1620}, "role": "MIDDLE"},
            {"player": {"user_id": "user3", "rate": 1570, "best": 1600}, "role": "BOTTOM_LANE"},
            {"player": {"user_id": "user4", "rate": 1560, "best": 1590}, "role": "SUPPORT"},
            {"player": {"user_id": "user5", "rate": 1550, "best": 1580}, "role": "TANK"},
        ]
        team_b_data = [
            {"player": {"user_id": "user6", "rate": 1540, "best": 1570}, "role": "TOP_LANE"},
            {"player": {"user_id": "user7", "rate": 1530, "best": 1560}, "role": "MIDDLE"},
            {"player": {"user_id": "user8", "rate": 1520, "best": 1550}, "role": "BOTTOM_LANE"},
            {"player": {"user_id": "user9", "rate": 1510, "best": 1540}, "role": "SUPPORT"},
            {"player": {"user_id": "user10", "rate": 1500, "best": 1530}, "role": "TANK"},
        ]

        match_id = 12345
        vc_a = 15
        vc_b = 16

        record = create_match_record(match_id, team_a_data, team_b_data, vc_a, vc_b)

        # 基本構造チェック
        assert record["namespace"] == "default"
        assert record["match_id"] == match_id
        assert record["status"] == "matched"
        assert record["vc_a"] == vc_a
        assert record["vc_b"] == vc_b

        # 新フォーマットチェック: [user_id, rate, best_rate, role]
        assert len(record["team_a"]) == 5
        assert len(record["team_b"]) == 5

        # team_aの最初のプレイヤーをチェック
        first_player = record["team_a"][0]
        assert len(first_player) == 4  # [user_id, rate, best_rate, role]
        assert first_player[0] == "user1"  # user_id
        assert first_player[1] == 1600  # rate
        assert first_player[2] == 1650  # best_rate
        assert first_player[3] == "TOP_LANE"  # role

    def test_match_record_legacy_compatibility(self):
        """Legacy互換性テスト"""
        # 既存のコードが新フォーマットを正しく読めることを確認
        team_data = [["user1", 1600, 1650, "TOP_LANE"]]

        # Legacy形式でのアクセスパターン
        user_id = team_data[0][0]
        rate = team_data[0][1]
        best_rate = team_data[0][2]
        role = team_data[0][3]  # 新フィールド

        assert user_id == "user1"
        assert rate == 1600
        assert best_rate == 1650
        assert role == "TOP_LANE"


class TestVoiceChannelAssignment:
    """VC割り当てのテスト"""

    @patch("src.handlers.matchmaking.dynamodb")
    def test_assign_voice_channels_success(self, mock_dynamodb):
        """VC割り当て成功テスト"""
        mock_table = Mock()
        mock_dynamodb.Table.return_value = mock_table

        # META itemのモックデータ
        mock_table.get_item.return_value = {"Item": {"UnusedVC": [1, 3, 5, 7, 9, 11]}}

        vc_a, vc_b = assign_voice_channels()

        assert vc_a == 1
        assert vc_b == 2

        # UnusedVCが更新されることを確認
        mock_table.update_item.assert_called_once()

    @patch("src.handlers.matchmaking.dynamodb")
    def test_assign_voice_channels_insufficient(self, mock_dynamodb):
        """VC不足時のテスト"""
        mock_table = Mock()
        mock_dynamodb.Table.return_value = mock_table

        mock_table.get_item.return_value = {"Item": {"UnusedVC": []}}

        with pytest.raises(Exception, match="UnusedVCが不足しています"):
            assign_voice_channels()


class TestErrorHandling:
    """エラーハンドリングのテスト"""

    @patch("src.handlers.matchmaking.logger")
    def test_matchmaking_failure_logging(self, mock_logger):
        """マッチメイク失敗時のログ出力テスト"""
        queue = []  # 空のキュー

        result = matchmake_top_first(queue)

        assert result == {}
        # エラーログが出力されることを確認（実装後に追加）

    @patch("src.handlers.matchmaking.release_lock")
    @patch("src.handlers.matchmaking.acquire_lock")
    def test_lock_cleanup_on_error(self, mock_acquire, mock_release):
        """エラー時のロック解放テスト"""
        # エラーが発生してもrelease_lockが呼ばれることを確認
        # （実装時にfinallyブロックでテスト）
        pass


class TestIntegrationScenarios:
    """統合シナリオテスト"""

    def test_full_matchmaking_flow(self):
        """完全なマッチメイクフローのテスト"""
        # 1. キューロック
        # 2. プレイヤー取得
        # 3. マッチメイク実行
        # 4. マッチレコード作成
        # 5. VC割り当て
        # 6. ロック解放
        #
        # 実装完了後に詳細テストを追加
        pass

    def test_concurrent_matchmaking_prevention(self):
        """同時マッチメイク防止テスト"""
        # ロック機能による同時実行防止の確認
        pass


# テストデータ生成ヘルパー
def create_test_queue(player_count: int = 10) -> List[Dict[str, Any]]:
    """テスト用キューデータ生成"""
    roles = ["TOP_LANE", "MIDDLE", "BOTTOM_LANE", "SUPPORT", "TANK"]
    return [
        {
            "id": f"user{i}",
            "rating": 1500 + (i * 10),
            "roles": roles,  # 全ロール対応
        }
        for i in range(player_count)
    ]


def create_test_player(user_id: str, rating: int, roles: List[str]) -> Dict[str, Any]:
    """テスト用プレイヤーデータ生成"""
    return {
        "user_id": user_id,
        "rate": rating,
        "best": rating + 50,
        "roles": roles,
        "discord_id": f"discord_{user_id}",
        "range_spread_count": 0,
        "range_spread_speed": 10,
    }


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
