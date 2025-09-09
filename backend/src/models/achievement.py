from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class AchievementType(str, Enum):
    MILESTONE = "MILESTONE"  # マイルストーン（累計試合数など）
    RATING = "RATING"  # レート達成
    WIN_STREAK = "WIN_STREAK"  # 連勝
    POKEMON_MASTERY = "POKEMON_MASTERY"  # ポケモンマスタリー
    SEASONAL = "SEASONAL"  # シーズン限定
    SPECIAL = "SPECIAL"  # 特別実績


class AchievementTier(str, Enum):
    BRONZE = "BRONZE"
    SILVER = "SILVER"
    GOLD = "GOLD"
    PLATINUM = "PLATINUM"
    DIAMOND = "DIAMOND"


class Achievement(BaseModel):
    achievement_id: str = Field(..., description="実績ID")
    name_ja: str = Field(..., description="実績名（日本語）")
    name_en: str = Field(..., description="実績名（英語）")
    description_ja: str = Field(..., description="実績説明（日本語）")
    description_en: str = Field(..., description="実績説明（英語）")
    type: AchievementType = Field(..., description="実績タイプ")
    tier: AchievementTier = Field(..., description="実績ティア")
    icon_url: str | None = Field(None, description="実績アイコンURL")
    requirement: dict[str, Any] = Field(..., description="達成条件")
    reward_points: int = Field(default=0, description="報酬ポイント")
    is_active: bool = Field(default=True, description="現在有効かどうか")
    created_at: int = Field(..., description="作成日時（unixtime）")
    updated_at: int = Field(..., description="更新日時（unixtime）")

    @classmethod
    def create_new_achievement(
        cls,
        achievement_id: str,
        name_ja: str,
        name_en: str,
        description_ja: str,
        description_en: str,
        type: AchievementType,
        tier: AchievementTier,
        requirement: dict[str, Any],
        reward_points: int = 0,
        icon_url: str | None = None,
    ) -> "Achievement":
        now = int(datetime.now().timestamp())
        return cls(
            achievement_id=achievement_id,
            name_ja=name_ja,
            name_en=name_en,
            description_ja=description_ja,
            description_en=description_en,
            type=type,
            tier=tier,
            icon_url=icon_url,
            requirement=requirement,
            reward_points=reward_points,
            is_active=True,
            created_at=now,
            updated_at=now,
        )


class UserAchievement(BaseModel):
    user_id: str = Field(..., description="ユーザーID")
    achievement_id: str = Field(..., description="実績ID")
    earned_at: int = Field(..., description="獲得日時（unixtime）")
    progress: dict[str, Any] = Field(default_factory=dict, description="進捗データ")
    is_completed: bool = Field(default=False, description="完了フラグ")
    created_at: int = Field(..., description="レコード作成日時（unixtime）")

    @classmethod
    def create_new_user_achievement(
        cls,
        user_id: str,
        achievement_id: str,
        progress: dict[str, Any] | None = None,
        is_completed: bool = False,
    ) -> "UserAchievement":
        now = int(datetime.now().timestamp())
        return cls(
            user_id=user_id,
            achievement_id=achievement_id,
            earned_at=now if is_completed else 0,
            progress=progress or {},
            is_completed=is_completed,
            created_at=now,
        )

    def update_progress(self, progress_data: dict[str, Any]) -> None:
        """進捗を更新"""
        self.progress.update(progress_data)

    def complete(self) -> None:
        """実績を完了"""
        self.is_completed = True
        self.earned_at = int(datetime.now().timestamp())


class AchievementProgress(BaseModel):
    """実績進捗レスポンス"""

    achievement: Achievement
    user_achievement: UserAchievement | None = None
    progress_percentage: float = Field(default=0.0, description="進捗率（0-100）")
    is_completed: bool = Field(default=False)
    earned_at: int | None = None


class CreateAchievementRequest(BaseModel):
    achievement_id: str
    name_ja: str
    name_en: str
    description_ja: str
    description_en: str
    type: AchievementType
    tier: AchievementTier
    requirement: dict[str, Any]
    reward_points: int = 0
    icon_url: str | None = None


class UpdateAchievementRequest(BaseModel):
    name_ja: str | None = None
    name_en: str | None = None
    description_ja: str | None = None
    description_en: str | None = None
    icon_url: str | None = None
    requirement: dict[str, Any] | None = None
    reward_points: int | None = None
    is_active: bool | None = None
