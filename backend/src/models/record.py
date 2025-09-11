from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_serializer


class Record(BaseModel):
    record_id: str = Field(..., description="レコードID（match_id + user_id）")
    user_id: str = Field(..., description="プレイヤーのユーザーID")
    match_id: str = Field(..., description="マッチID")
    pokemon: str | None = Field(None, description="使用ポケモン")
    team: str = Field(..., description="所属チーム（A or B）")
    is_winner: bool = Field(..., description="勝利したかどうか")
    rate_before: int = Field(..., description="試合前のレート")
    rate_after: int = Field(..., description="試合後のレート")
    rate_delta: int = Field(..., description="レート変動")
    started_date: int = Field(..., description="試合開始日時（unixtime）")
    completed_date: int = Field(..., description="試合完了日時（unixtime）")
    team_a_players: list[str] = Field(..., description="チームAのプレイヤーリスト")
    team_b_players: list[str] = Field(..., description="チームBのプレイヤーリスト")
    created_at: int = Field(..., description="レコード作成日時（unixtime）")

    @field_serializer('rate_before', 'rate_after', 'rate_delta', 'started_date', 
                      'completed_date', 'created_at')
    def serialize_int_fields(self, value):
        """Convert integer fields to Decimal for DynamoDB compatibility"""
        if value is None:
            return None
        return Decimal(int(value))

    @classmethod
    def create_from_match_result(
        cls,
        user_id: str,
        match_id: str,
        team: str,
        is_winner: bool,
        rate_before: int,
        rate_after: int,
        started_date: int,
        completed_date: int,
        team_a_players: list[str],
        team_b_players: list[str],
        pokemon: str | None = None,
    ) -> "Record":
        now = int(datetime.now().timestamp())
        record_id = f"{match_id}#{user_id}"

        return cls(
            record_id=record_id,
            user_id=user_id,
            match_id=match_id,
            pokemon=pokemon,
            team=team,
            is_winner=is_winner,
            rate_before=rate_before,
            rate_after=rate_after,
            rate_delta=rate_after - rate_before,
            started_date=started_date,
            completed_date=completed_date,
            team_a_players=team_a_players,
            team_b_players=team_b_players,
            created_at=now,
        )

    @property
    def win_lose_str(self) -> str:
        return "WIN" if self.is_winner else "LOSE"


class RecordSearchFilter(BaseModel):
    user_id: str | None = None
    pokemon: str | None = None
    is_winner: bool | None = None
    start_date: int | None = None
    end_date: int | None = None
    limit: int = Field(default=50, ge=1, le=100)
