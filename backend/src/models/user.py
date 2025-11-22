from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_serializer


class SeasonRecord(BaseModel):
    """過去シーズンデータ."""

    season_id: str = Field(..., description="シーズンID")
    season_name: str = Field(..., description="シーズン名")
    total_matches: int = Field(..., description="試合数")
    win_count: int = Field(..., description="勝利数")
    final_rate: int = Field(..., description="最終レート")
    max_rate: int = Field(..., description="シーズン中の最高レート")
    final_rank: int | None = Field(None, description="最終順位")
    earned_badges: list[str] = Field(default_factory=list, description="獲得した勲章IDリスト")

    @field_serializer('total_matches', 'win_count', 'final_rate', 'max_rate', 'final_rank')
    def serialize_int_fields(self, value):
        """Convert integer fields to Decimal for DynamoDB compatibility"""
        if value is None:
            return None
        return Decimal(int(value))


class User(BaseModel):
    namespace: str = Field(default="default", description="名前空間（Legacy準拠）")
    user_id: str = Field(..., description="ユーザーのプライマリキー（Discord ID）")
    discord_username: str = Field(..., description="Discordのユーザー名")
    discord_discriminator: str | None = Field(None, description="Discordの識別子（#1234）")
    discord_avatar_url: str | None = Field(None, description="DiscordのアバターURL")
    trainer_name: str = Field(..., description="トレーナー名（アプリ内表示名）")
    twitter_id: str | None = Field(None, description="TwitterのユーザーID")
    preferred_roles: list[str] | None = Field(None, description="希望ロールのリスト")
    favorite_pokemon: list[str] | None = Field(None, description="得意ポケモンのIDリスト")
    owned_badges: list[str] = Field(default_factory=list, description="所持している勲章IDのリスト")
    current_badge: str | None = Field(None, description="現在設定している勲章ID")
    current_badge_2: str | None = Field(None, description="2つ目の勲章ID")
    bio: str | None = Field(None, description="プロフィールの一言")
    past_seasons: list[dict] = Field(default_factory=list, description="過去シーズンデータのリスト")
    rate: int = Field(default=1500, description="現在のレート")
    max_rate: int = Field(default=1500, description="最高レート")
    match_count: int = Field(default=0, description="総試合数")
    win_count: int = Field(default=0, description="勝利数")
    win_rate: float = Field(default=0.0, description="勝率（小数点1位）")
    assigned_match_id: int = Field(default=0, description="現在アサインされた試合ID (0=非試合中)")
    penalty_count: int = Field(default=0, description="累積ペナルティ数（減らない）")
    penalty_correction: int = Field(default=0, description="ペナルティ軽減数")
    last_penalty_time: int | None = Field(None, description="最後のペナルティ付与時刻（unixtime）")
    penalty_timeout_until: int | None = Field(None, description="ペナルティタイムアウト終了時刻（unixtime）")
    is_admin: bool = Field(default=False, description="管理者権限フラグ")
    is_banned: bool = Field(default=False, description="アカウント凍結フラグ")
    created_at: int = Field(..., description="作成日時（unixtime）")
    updated_at: int = Field(..., description="更新日時（unixtime）")

    @classmethod
    def create_new_user(
        cls,
        user_id: str,
        discord_username: str,
        discord_discriminator: str | None = None,
        discord_avatar_url: str | None = None,
        trainer_name: str | None = None,
    ) -> "User":
        now = int(datetime.now().timestamp())
        return cls(
            namespace="default",
            user_id=user_id,
            discord_username=discord_username,
            discord_discriminator=discord_discriminator,
            discord_avatar_url=discord_avatar_url,
            trainer_name=trainer_name or "",
            twitter_id=None,
            preferred_roles=None,
            favorite_pokemon=None,
            owned_badges=[],
            current_badge=None,
            current_badge_2=None,
            bio=None,
            is_admin=False,
            created_at=now,
            updated_at=now,
        )

    def update_profile(
        self,
        trainer_name: str | None = None,
        twitter_id: str | None = None,
        preferred_roles: list[str] | None = None,
        favorite_pokemon: list[str] | None = None,
        current_badge: str | None = None,
        current_badge_2: str | None = None,
        bio: str | None = None,
    ) -> None:
        if trainer_name is not None:
            self.trainer_name = trainer_name
        if twitter_id is not None:
            self.twitter_id = twitter_id if twitter_id else None
        if preferred_roles is not None:
            self.preferred_roles = preferred_roles
        if favorite_pokemon is not None:
            self.favorite_pokemon = favorite_pokemon
        if current_badge is not None:
            self.current_badge = current_badge if current_badge else None
        if current_badge_2 is not None:
            self.current_badge_2 = current_badge_2 if current_badge_2 else None
        if bio is not None:
            self.bio = bio
        self.updated_at = int(datetime.now().timestamp())

    def update_stats(self, rate_change: int, is_win: bool) -> None:
        self.rate += rate_change
        self.max_rate = max(self.max_rate, self.rate)
        self.match_count += 1
        if is_win:
            self.win_count += 1
        # Recalculate win_rate
        if self.match_count > 0:
            self.win_rate = round((self.win_count / self.match_count) * 100, 1)
        else:
            self.win_rate = 0.0
        self.updated_at = int(datetime.now().timestamp())

    def assign_to_match(self, match_id: int) -> None:
        """ユーザーを試合にアサイン"""
        self.assigned_match_id = match_id
        self.updated_at = int(datetime.now().timestamp())

    def leave_match(self) -> None:
        """ユーザーを試合から離脱"""
        self.assigned_match_id = 0
        self.updated_at = int(datetime.now().timestamp())

    @property
    def is_in_match(self) -> bool:
        """試合中かどうか"""
        return self.assigned_match_id != 0


    @property
    def effective_penalty(self) -> int:
        """実効ペナルティ数を計算"""
        return max(0, self.penalty_count - self.penalty_correction)

    @field_serializer('rate', 'max_rate', 'match_count', 'win_count', 'assigned_match_id', 
                      'penalty_count', 'penalty_correction', 'last_penalty_time', 
                      'penalty_timeout_until', 'created_at', 'updated_at')
    def serialize_int_fields(self, value):
        """Convert integer fields to Decimal for DynamoDB compatibility"""
        if value is None:
            return None
        return Decimal(int(value))

    @field_serializer('win_rate')
    def serialize_win_rate(self, value):
        """Convert win_rate to Decimal for DynamoDB compatibility"""
        if value is None:
            return None
        return Decimal(str(value))


class CreateUserRequest(BaseModel):
    discord_username: str
    discord_discriminator: str | None = None
    discord_avatar_url: str | None = None
    trainer_name: str | None = None


class UpdateProfileRequest(BaseModel):
    trainer_name: str | None = None
    twitter_id: str | None = None
    preferred_roles: list[str] | None = None
    favorite_pokemon: list[str] | None = None
    current_badge: str | None = None
    current_badge_2: str | None = None
    bio: str | None = None
