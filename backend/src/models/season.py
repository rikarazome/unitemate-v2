"""Season data models."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class Season(BaseModel):
    """シーズンデータモデル."""

    data_type: str = Field(default="SEASON", description="データタイプ（固定値：SEASON）")
    id: str = Field(description="シーズンID（例：season_2024_winter）")
    name: str = Field(description="シーズン名（例：2024年冬シーズン）")
    description: Optional[str] = Field(default=None, description="シーズンの説明")
    start_date: int = Field(description="シーズン開始日時（UNIXタイムスタンプ、JST）")
    end_date: int = Field(description="シーズン終了日時（UNIXタイムスタンプ、JST）")
    image_url: Optional[str] = Field(default=None, description="シーズンイメージのURL")
    theme_color: Optional[str] = Field(default="#ff6b35", description="シーズンテーマカラー（HEX）")
    is_active: bool = Field(default=False, description="現在アクティブなシーズンかどうか")
    created_at: int = Field(default_factory=lambda: int(datetime.now().timestamp()), description="作成日時")
    updated_at: int = Field(default_factory=lambda: int(datetime.now().timestamp()), description="更新日時")


class SeasonCreateRequest(BaseModel):
    """シーズン作成リクエスト."""

    id: str = Field(description="シーズンID")
    name: str = Field(description="シーズン名")
    description: Optional[str] = Field(default=None, description="シーズンの説明")
    start_date: int = Field(description="シーズン開始日時（UNIXタイムスタンプ、JST）")
    end_date: int = Field(description="シーズン終了日時（UNIXタイムスタンプ、JST）")
    image_url: Optional[str] = Field(default=None, description="シーズンイメージのURL")
    theme_color: Optional[str] = Field(default="#ff6b35", description="シーズンテーマカラー")


class SeasonUpdateRequest(BaseModel):
    """シーズン更新リクエスト."""

    name: Optional[str] = Field(default=None, description="シーズン名")
    description: Optional[str] = Field(default=None, description="シーズンの説明")
    start_date: Optional[int] = Field(default=None, description="シーズン開始日時")
    end_date: Optional[int] = Field(default=None, description="シーズン終了日時")
    image_url: Optional[str] = Field(default=None, description="シーズンイメージのURL")
    theme_color: Optional[str] = Field(default=None, description="シーズンテーマカラー")
    is_active: Optional[bool] = Field(default=None, description="アクティブ状態")


class ActiveSeasonResponse(BaseModel):
    """アクティブシーズンレスポンス."""

    current_season: Optional[Season] = Field(default=None, description="現在のアクティブシーズン")
    is_season_active: bool = Field(description="シーズンが有効かどうか")
    next_season: Optional[Season] = Field(default=None, description="次のシーズン（予告用）")