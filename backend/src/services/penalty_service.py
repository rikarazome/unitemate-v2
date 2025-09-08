from datetime import datetime

from ..repositories.user_repository import UserRepository


class PenaltyService:
    def __init__(self):
        self.user_repository = UserRepository()

    def apply_penalty(self, user_id: str, report_reason: str = "match_reports") -> bool:
        """
        ユーザーにペナルティを適用する

        Args:
            user_id: ペナルティを適用するユーザーID
            report_reason: ペナルティの理由

        Returns:
            bool: ペナルティ適用が成功したかどうか

        """
        user = self.user_repository.get_by_user_id(user_id)
        if not user:
            print(f"[ERROR] apply_penalty: User {user_id} not found")
            return False

        # ペナルティ数を増加
        user.penalty_count += 1
        user.last_penalty_time = int(datetime.now().timestamp())

        # 実効ペナルティを計算
        effective_penalty = user.effective_penalty

        # タイムアウト時間を設定 (実効ペナルティ × 30分)
        if effective_penalty > 0:
            timeout_seconds = effective_penalty * 30 * 60  # 30分をSecondに変換
            user.penalty_timeout_until = user.last_penalty_time + timeout_seconds

        # ペナルティが6以上の場合はマッチング禁止
        if effective_penalty >= 6:
            print(f"[INFO] apply_penalty: User {user_id} penalty >= 6, matchmaking disabled")

        # レート減算 (ペナルティ × 4)
        rate_deduction = effective_penalty * 4
        user.rate = max(0, user.rate - rate_deduction)

        user.updated_at = int(datetime.now().timestamp())

        success = self.user_repository.update(user)
        if success:
            print(
                f"[INFO] apply_penalty: User {user_id} penalty applied. "
                f"penalty_count={user.penalty_count}, effective_penalty={effective_penalty}, "
                f"timeout_until={user.penalty_timeout_until}, rate_deduction={rate_deduction}"
            )
        else:
            print(f"[ERROR] apply_penalty: Failed to update user {user_id}")

        return success

    def can_join_matchmaking(self, user_id: str) -> tuple[bool, str]:
        """
        ユーザーがマッチングに参加できるかチェック

        Args:
            user_id: チェックするユーザーID

        Returns:
            tuple[bool, str]: (参加可能かどうか, 理由)

        """
        user = self.user_repository.get_by_user_id(user_id)
        if not user:
            return False, "ユーザーが見つかりません"

        # アカウント凍結チェック
        if user.is_banned:
            return False, "アカウントが凍結されています"

        effective_penalty = user.effective_penalty

        # ペナルティが6以上の場合はマッチング禁止
        if effective_penalty >= 6:
            return False, f"ペナルティが{effective_penalty}のため、マッチングに参加できません"

        # タイムアウト中かチェック
        if user.penalty_timeout_until:
            current_time = int(datetime.now().timestamp())
            if current_time < user.penalty_timeout_until:
                remaining_minutes = (user.penalty_timeout_until - current_time) // 60
                return False, f"ペナルティタイムアウト中です (残り{remaining_minutes}分)"

        return True, "参加可能です"

    def reduce_penalty_by_matches(self, user_id: str, matches_played: int) -> bool:
        """
        試合数に応じてペナルティを軽減
        50試合ごとにペナルティ軽減数を1増加

        Args:
            user_id: ユーザーID
            matches_played: プレイした試合数

        Returns:
            bool: 更新が成功したかどうか

        """
        user = self.user_repository.get_by_user_id(user_id)
        if not user:
            return False

        # 50試合ごとの軽減数を計算
        new_correction = matches_played // 50

        # 軽減数が増加した場合のみ更新
        if new_correction > user.penalty_correction:
            old_effective = user.effective_penalty
            user.penalty_correction = new_correction
            new_effective = user.effective_penalty

            user.updated_at = int(datetime.now().timestamp())

            success = self.user_repository.update(user)
            if success:
                print(
                    f"[INFO] reduce_penalty_by_matches: User {user_id} penalty reduced. "
                    f"correction={user.penalty_correction}, effective_penalty: {old_effective} -> {new_effective}"
                )
            return success

        return True  # 更新不要の場合も成功とする

    def reset_penalties_for_season(self, user_id: str) -> bool:
        """
        シーズンリセット時のペナルティリセット
        実効ペナルティが5以下の場合のみリセット

        Args:
            user_id: ユーザーID

        Returns:
            bool: リセットが実行されたかどうか

        """
        user = self.user_repository.get_by_user_id(user_id)
        if not user:
            return False

        effective_penalty = user.effective_penalty

        # 実効ペナルティが5以下の場合のみリセット
        if effective_penalty <= 5:
            user.penalty_count = 0
            user.penalty_correction = 0
            user.last_penalty_time = None
            user.penalty_timeout_until = None
            user.updated_at = int(datetime.now().timestamp())

            success = self.user_repository.update(user)
            if success:
                print(f"[INFO] reset_penalties_for_season: User {user_id} penalties reset (was {effective_penalty})")
            return success
        print(
            f"[INFO] reset_penalties_for_season: User {user_id} penalties NOT reset (effective_penalty={effective_penalty} > 5)"
        )
        return False

    def get_penalty_status(self, user_id: str) -> dict:
        """
        ユーザーのペナルティ状況を取得

        Args:
            user_id: ユーザーID

        Returns:
            dict: ペナルティ状況

        """
        user = self.user_repository.get_by_user_id(user_id)
        if not user:
            return {"error": "ユーザーが見つかりません"}

        current_time = int(datetime.now().timestamp())
        effective_penalty = user.effective_penalty

        # タイムアウト状況
        timeout_remaining = 0
        if user.penalty_timeout_until and current_time < user.penalty_timeout_until:
            timeout_remaining = user.penalty_timeout_until - current_time

        can_join, reason = self.can_join_matchmaking(user_id)

        return {
            "penalty_count": user.penalty_count,
            "penalty_correction": user.penalty_correction,
            "effective_penalty": effective_penalty,
            "last_penalty_time": user.last_penalty_time,
            "penalty_timeout_until": user.penalty_timeout_until,
            "timeout_remaining_seconds": timeout_remaining,
            "is_banned": user.is_banned,
            "can_join_matchmaking": can_join,
            "restriction_reason": reason if not can_join else None,
        }
