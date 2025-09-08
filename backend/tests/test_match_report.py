"""Match report handler tests."""

import json
import pytest
from unittest.mock import Mock, patch
from moto import mock_dynamodb
import boto3

from src.handlers.match_report import report_match_result
from src.models.user import User


class TestMatchReport:
    """試合報告機能のテストクラス"""

    @mock_dynamodb
    @patch("src.handlers.match_report.users_table")
    @patch("src.handlers.match_report.matches_table")
    @patch("src.handlers.match_report.records_table")
    def test_report_match_result_success(self, mock_records, mock_matches, mock_users):
        """試合結果報告が正常に動作することをテスト"""
        # モックデータの設定
        mock_users.get_item.return_value = {"Item": {"user_id": "test_user", "assigned_match_id": 123, "rate": 1500}}

        mock_records.get_item.return_value = {
            "Item": {"user_id": "test_user", "match_id": 123, "pokemon": "old_pokemon"}
        }

        # テストイベント
        event = {
            "requestContext": {"authorizer": {"lambda": {"user_id": "test_user"}}},
            "pathParameters": {"matchId": "123"},
            "body": json.dumps(
                {
                    "result": "win",
                    "banned_pokemon": "pikachu",
                    "picked_pokemon": "charizard",
                    "pokemon_move1": "flamethrower",
                    "pokemon_move2": "dragon_claw",
                    "violation_report": "",
                }
            ),
        }

        # テスト実行
        result = report_match_result(event, None)

        # 検証
        assert result["statusCode"] == 200
        assert "Match result reported successfully" in json.loads(result["body"])["message"]

        # DynamoDB操作の確認
        mock_matches.update_item.assert_called_once()
        mock_users.update_item.assert_called_once()
        mock_records.update_item.assert_called_once()


    def test_report_match_result_validation_error(self):
        """バリデーションエラーのテスト"""
        event = {
            "requestContext": {"authorizer": {"lambda": {"user_id": "test_user"}}},
            "pathParameters": {"matchId": "123"},
            "body": json.dumps(
                {
                    "result": "invalid_result",  # 不正な値
                    "banned_pokemon": "pikachu",
                    "picked_pokemon": "charizard",
                    "pokemon_move1": "flamethrower",
                    "pokemon_move2": "dragon_claw",
                }
            ),
        }

        # テスト実行
        result = report_match_result(event, None)

        # 検証
        assert result["statusCode"] == 422
        assert "Validation error" in json.loads(result["body"])["error"]


class TestUserModel:
    """Userモデルのテストクラス"""

    def test_assign_to_match(self):
        """試合アサイン機能のテスト"""
        user = User.create_new_user(
            user_id="test_user", auth0_sub="auth0|test", discord_username="testuser", trainer_name="Test User"
        )

        # 初期状態の確認
        assert user.assigned_match_id == 0
        assert not user.is_in_match

        # 試合にアサイン
        user.assign_to_match(123)
        assert user.assigned_match_id == 123
        assert user.is_in_match

        # 試合から離脱
        user.leave_match()
        assert user.assigned_match_id == 0
        assert not user.is_in_match


if __name__ == "__main__":
    # テスト実行用のサンプルコード
    import sys

    sys.path.append("../")

    test_report = TestMatchReport()
    test_user = TestUserModel()

    print("Running basic tests...")

    try:
        test_user.test_assign_to_match()
        print("✓ User model match assignment test passed")

        test_report.test_report_match_result_validation_error()
        print("✓ Match report validation test passed")

        print("All basic tests passed!")

    except Exception as e:
        print(f"❌ Test failed: {e}")
        raise
