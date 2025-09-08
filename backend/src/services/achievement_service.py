from typing import Any

from ..models.achievement import (
    Achievement,
    AchievementProgress,
    AchievementType,
    CreateAchievementRequest,
    UpdateAchievementRequest,
    UserAchievement,
)
from ..repositories.achievement_repository import AchievementRepository
from ..services.record_service import RecordService
from ..services.user_service import UserService


class AchievementService:
    def __init__(self):
        self.achievement_repository = AchievementRepository()
        self.user_service = UserService()
        self.record_service = RecordService()

    def get_achievement(self, achievement_id: str) -> Achievement | None:
        return self.achievement_repository.get_achievement(achievement_id)

    def get_all_achievements(self, include_inactive: bool = False) -> list[Achievement]:
        return self.achievement_repository.get_all_achievements(include_inactive)

    def get_achievements_by_type(self, achievement_type: AchievementType) -> list[Achievement]:
        return self.achievement_repository.get_achievements_by_type(achievement_type)

    def create_achievement(self, request: CreateAchievementRequest) -> Achievement | None:
        achievement = Achievement.create_new_achievement(
            achievement_id=request.achievement_id,
            name_ja=request.name_ja,
            name_en=request.name_en,
            description_ja=request.description_ja,
            description_en=request.description_en,
            type=request.type,
            tier=request.tier,
            requirement=request.requirement,
            reward_points=request.reward_points,
            icon_url=request.icon_url,
        )

        if self.achievement_repository.create_achievement(achievement):
            return achievement
        return None

    def update_achievement(self, achievement_id: str, request: UpdateAchievementRequest) -> Achievement | None:
        achievement = self.achievement_repository.get_achievement(achievement_id)
        if not achievement:
            return None

        # フィールドを更新
        if request.name_ja is not None:
            achievement.name_ja = request.name_ja
        if request.name_en is not None:
            achievement.name_en = request.name_en
        if request.description_ja is not None:
            achievement.description_ja = request.description_ja
        if request.description_en is not None:
            achievement.description_en = request.description_en
        if request.icon_url is not None:
            achievement.icon_url = request.icon_url
        if request.requirement is not None:
            achievement.requirement = request.requirement
        if request.reward_points is not None:
            achievement.reward_points = request.reward_points
        if request.is_active is not None:
            achievement.is_active = request.is_active

        achievement.updated_at = int(__import__("datetime").datetime.now().timestamp())

        if self.achievement_repository.update_achievement(achievement):
            return achievement
        return None

    def get_user_achievements(self, user_id: str, completed_only: bool = False) -> list[AchievementProgress]:
        """ユーザーの実績進捗を取得"""
        # 全実績を取得
        all_achievements = self.achievement_repository.get_all_achievements()

        # ユーザーの実績進捗を取得
        user_achievements = {ua.achievement_id: ua for ua in self.achievement_repository.get_user_achievements(user_id)}

        progress_list = []
        for achievement in all_achievements:
            user_achievement = user_achievements.get(achievement.achievement_id)

            if completed_only and (not user_achievement or not user_achievement.is_completed):
                continue

            # 進捗率を計算
            progress_percentage = self._calculate_progress_percentage(achievement, user_achievement, user_id)

            progress = AchievementProgress(
                achievement=achievement,
                user_achievement=user_achievement,
                progress_percentage=progress_percentage,
                is_completed=user_achievement.is_completed if user_achievement else False,
                earned_at=user_achievement.earned_at if user_achievement and user_achievement.is_completed else None,
            )
            progress_list.append(progress)

        return progress_list

    def get_recent_achievements(self, user_id: str, limit: int = 10) -> list[UserAchievement]:
        return self.achievement_repository.get_recent_achievements(user_id, limit)

    def check_and_update_achievements(self, user_id: str) -> list[UserAchievement]:
        """ユーザーの実績を自動チェックして更新"""
        newly_earned = []

        # 全実績を取得
        all_achievements = self.achievement_repository.get_all_achievements()

        for achievement in all_achievements:
            # 既に完了している実績はスキップ
            user_achievement = self.achievement_repository.get_user_achievement(user_id, achievement.achievement_id)
            if user_achievement and user_achievement.is_completed:
                continue

            # 達成条件をチェック
            is_achieved, progress_data = self._check_achievement_condition(achievement, user_id)

            if user_achievement:
                # 既存の進捗を更新
                user_achievement.update_progress(progress_data)
                if is_achieved and not user_achievement.is_completed:
                    user_achievement.complete()
                    newly_earned.append(user_achievement)
                self.achievement_repository.update_user_achievement(user_achievement)
            else:
                # 新しい実績進捗を作成
                user_achievement = UserAchievement.create_new_user_achievement(
                    user_id=user_id,
                    achievement_id=achievement.achievement_id,
                    progress=progress_data,
                    is_completed=is_achieved,
                )
                if is_achieved:
                    newly_earned.append(user_achievement)
                self.achievement_repository.create_user_achievement(user_achievement)

        return newly_earned

    def get_leaderboard(self, achievement_id: str, limit: int = 50) -> list[UserAchievement]:
        return self.achievement_repository.get_leaderboard_by_achievement(achievement_id, limit)

    def get_achievement_stats(self, achievement_id: str) -> dict:
        return self.achievement_repository.get_achievement_stats(achievement_id)

    def _calculate_progress_percentage(
        self, achievement: Achievement, user_achievement: UserAchievement | None, user_id: str
    ) -> float:
        """実績の進捗率を計算"""
        if user_achievement and user_achievement.is_completed:
            return 100.0

        # 実績タイプに応じて進捗を計算
        if achievement.type == AchievementType.MILESTONE:
            return self._calculate_milestone_progress(achievement, user_achievement, user_id)
        if achievement.type == AchievementType.RATING:
            return self._calculate_rating_progress(achievement, user_achievement, user_id)
        if achievement.type == AchievementType.WIN_STREAK:
            return self._calculate_win_streak_progress(achievement, user_achievement, user_id)
        if achievement.type == AchievementType.POKEMON_MASTERY:
            return self._calculate_pokemon_mastery_progress(achievement, user_achievement, user_id)

        return 0.0

    def _check_achievement_condition(self, achievement: Achievement, user_id: str) -> tuple[bool, dict[str, Any]]:
        """実績の達成条件をチェック"""
        if achievement.type == AchievementType.MILESTONE:
            return self._check_milestone_condition(achievement, user_id)
        if achievement.type == AchievementType.RATING:
            return self._check_rating_condition(achievement, user_id)
        if achievement.type == AchievementType.WIN_STREAK:
            return self._check_win_streak_condition(achievement, user_id)
        if achievement.type == AchievementType.POKEMON_MASTERY:
            return self._check_pokemon_mastery_condition(achievement, user_id)

        return False, {}

    def _calculate_milestone_progress(
        self, achievement: Achievement, user_achievement: UserAchievement | None, user_id: str
    ) -> float:
        """マイルストーン実績の進捗率を計算"""
        requirement = achievement.requirement
        target = requirement.get("target", 1)

        if requirement.get("type") == "total_matches":
            user = self.user_service.get_user_by_user_id(user_id)
            current = user.match_count if user else 0
        elif requirement.get("type") == "total_wins":
            user = self.user_service.get_user_by_user_id(user_id)
            current = user.win_count if user else 0
        else:
            current = 0

        return min(100.0, (current / target) * 100.0)

    def _check_milestone_condition(self, achievement: Achievement, user_id: str) -> tuple[bool, dict[str, Any]]:
        """マイルストーン実績の達成条件をチェック"""
        requirement = achievement.requirement
        target = requirement.get("target", 1)

        user = self.user_service.get_user_by_user_id(user_id)
        if not user:
            return False, {}

        if requirement.get("type") == "total_matches":
            current = user.match_count
        elif requirement.get("type") == "total_wins":
            current = user.win_count
        else:
            return False, {}

        progress_data = {"current": current, "target": target}
        return current >= target, progress_data

    def _calculate_rating_progress(
        self, achievement: Achievement, user_achievement: UserAchievement | None, user_id: str
    ) -> float:
        """レート実績の進捗率を計算"""
        requirement = achievement.requirement
        target_rate = requirement.get("target_rate", 2000)

        user = self.user_service.get_user_by_user_id(user_id)
        current_rate = user.max_rate if user else 1500

        # 初期レート1500を基準とした進捗
        base_rate = 1500
        progress = max(0, current_rate - base_rate) / max(1, target_rate - base_rate)
        return min(100.0, progress * 100.0)

    def _check_rating_condition(self, achievement: Achievement, user_id: str) -> tuple[bool, dict[str, Any]]:
        """レート実績の達成条件をチェック"""
        requirement = achievement.requirement
        target_rate = requirement.get("target_rate", 2000)

        user = self.user_service.get_user_by_user_id(user_id)
        if not user:
            return False, {}

        current_rate = user.max_rate
        progress_data = {"current_rate": current_rate, "target_rate": target_rate}
        return current_rate >= target_rate, progress_data

    def _calculate_win_streak_progress(
        self, achievement: Achievement, user_achievement: UserAchievement | None, user_id: str
    ) -> float:
        """連勝実績の進捗率を計算"""
        requirement = achievement.requirement
        target_streak = requirement.get("target_streak", 5)

        # 最近の成績から現在の連勝数を取得
        performance = self.record_service.get_recent_performance(user_id, 20)
        current_streak = 0

        if performance.get("streak", {}).get("type") == "win":
            current_streak = performance["streak"]["count"]

        return min(100.0, (current_streak / target_streak) * 100.0)

    def _check_win_streak_condition(self, achievement: Achievement, user_id: str) -> tuple[bool, dict[str, Any]]:
        """連勝実績の達成条件をチェック"""
        requirement = achievement.requirement
        target_streak = requirement.get("target_streak", 5)

        performance = self.record_service.get_recent_performance(user_id, 50)
        current_streak = 0

        if performance.get("streak", {}).get("type") == "win":
            current_streak = performance["streak"]["count"]

        progress_data = {"current_streak": current_streak, "target_streak": target_streak}
        return current_streak >= target_streak, progress_data

    def _calculate_pokemon_mastery_progress(
        self, achievement: Achievement, user_achievement: UserAchievement | None, user_id: str
    ) -> float:
        """ポケモンマスタリー実績の進捗率を計算"""
        requirement = achievement.requirement
        pokemon_id = requirement.get("pokemon_id")
        target_wins = requirement.get("target_wins", 10)

        if not pokemon_id:
            return 0.0

        # ポケモン別統計を取得
        pokemon_stats = self.record_service.get_pokemon_win_rates(user_id, 100)
        pokemon_data = pokemon_stats.get(pokemon_id, {"wins": 0})
        current_wins = pokemon_data.get("wins", 0)

        return min(100.0, (current_wins / target_wins) * 100.0)

    def _check_pokemon_mastery_condition(self, achievement: Achievement, user_id: str) -> tuple[bool, dict[str, Any]]:
        """ポケモンマスタリー実績の達成条件をチェック"""
        requirement = achievement.requirement
        pokemon_id = requirement.get("pokemon_id")
        target_wins = requirement.get("target_wins", 10)

        if not pokemon_id:
            return False, {}

        pokemon_stats = self.record_service.get_pokemon_win_rates(user_id, 100)
        pokemon_data = pokemon_stats.get(pokemon_id, {"wins": 0})
        current_wins = pokemon_data.get("wins", 0)

        progress_data = {"pokemon_id": pokemon_id, "current_wins": current_wins, "target_wins": target_wins}
        return current_wins >= target_wins, progress_data
