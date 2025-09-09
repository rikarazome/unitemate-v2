from datetime import datetime

from pydantic import BaseModel, Field


class QueueEntry(BaseModel):
    user_id: str = Field(..., description="プレイヤーのユーザーID（Discord ID）")
    blocking: str | None = Field(None, description="ブロックするユーザーID")
    selected_roles: list[str] = Field(..., description="選択したロールのリスト")
    inqueued_at: int = Field(..., description="キュー参加日時（unixtime）")

    @classmethod
    def create_new_entry(
        cls,
        user_id: str,
        selected_roles: list[str],
        blocking: str | None = None,
    ) -> "QueueEntry":
        now = int(datetime.now().timestamp())
        return cls(
            user_id=user_id,
            blocking=blocking,
            selected_roles=selected_roles,
            inqueued_at=now,
        )


class QueueMeta(BaseModel):
    """キューのメタ情報（統計データ）"""

    lock: int = Field(default=0, description="マッチメイキングロック（0:解放, 1:ロック中）")
    rate_list: list[int] = Field(default_factory=list, description="現在キューにいるプレイヤーのレートリスト")
    range_list: list[int] = Field(default_factory=list, description="現在キューにいるプレイヤーのレンジリスト")
    latest_match_id: int = Field(default=0, description="最新のマッチID")
    unused_vc: list[int] = Field(
        default_factory=lambda: list(range(1, 100, 2)), description="未使用のVC番号リスト（奇数）"
    )
    ongoing_matches: int = Field(default=0, description="進行中のマッチ数")
    ongoing_match_ids: list[int] = Field(default_factory=list, description="進行中のマッチIDリスト")
    total_queued: int = Field(default=0, description="累計キュー参加者数")
    total_matched: int = Field(default=0, description="累計マッチ成立数")
    previous_matched_unixtime: int = Field(default=0, description="前回マッチ成立時刻（unixtime）")
    previous_user_count: int = Field(default=0, description="前回マッチメイキング時のユーザー数")


class InQueueRequest(BaseModel):
    blocking: str | None = None
    selected_roles: list[str] = Field(..., description="選択したロールのリスト")


class DeQueueRequest(BaseModel):
    user_id: str
