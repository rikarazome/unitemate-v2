from datetime import datetime
from pydantic import BaseModel, Field


class Report(BaseModel):
    """ユーザー通報のデータモデル"""

    namespace: str = Field(default="default", description="名前空間")
    report_id: str = Field(..., description="通報ID（uuid）")
    match_id: int = Field(..., description="試合ID")
    reporter_user_id: str = Field(..., description="通報者のユーザーID")
    reported_user_id: str = Field(..., description="通報されたユーザーID")
    report_reason: str = Field(..., description="通報理由")
    report_details: str | None = Field(None, description="通報の詳細")
    created_at: int = Field(..., description="通報日時（unixtime）")
    processed: bool = Field(default=False, description="処理済みフラグ")
    processed_at: int | None = Field(None, description="処理日時（unixtime）")
    admin_notes: str | None = Field(None, description="管理者メモ")

    @classmethod
    def create_new_report(
        cls,
        report_id: str,
        match_id: int,
        reporter_user_id: str,
        reported_user_id: str,
        report_reason: str,
        report_details: str | None = None,
    ) -> "Report":
        """新しい通報を作成"""
        now = int(datetime.now().timestamp())
        return cls(
            namespace="default",
            report_id=report_id,
            match_id=match_id,
            reporter_user_id=reporter_user_id,
            reported_user_id=reported_user_id,
            report_reason=report_reason,
            report_details=report_details,
            created_at=now,
            processed=False,
        )

    def mark_as_processed(self, admin_notes: str | None = None) -> None:
        """通報を処理済みにマーク"""
        self.processed = True
        self.processed_at = int(datetime.now().timestamp())
        if admin_notes:
            self.admin_notes = admin_notes


class CreateReportRequest(BaseModel):
    """通報作成リクエスト"""

    match_id: int = Field(..., description="試合ID")
    reported_user_id: str = Field(..., description="通報されたユーザーID")
    report_reason: str = Field(..., description="通報理由")
    report_details: str | None = Field(None, description="通報の詳細")


class ReportCountSummary(BaseModel):
    """ユーザーの通報集計データ"""

    user_id: str = Field(..., description="ユーザーID")
    match_id: int = Field(..., description="試合ID")
    total_reports: int = Field(..., description="総通報数")
    same_team_reports: int = Field(..., description="同チームからの通報数")
    different_team_reports: int = Field(..., description="異チームからの通報数")
    should_apply_penalty: bool = Field(..., description="ペナルティを適用すべきかどうか")

    @property
    def meets_penalty_threshold(self) -> bool:
        """ペナルティ閾値に達しているかチェック"""
        # 同チーム4人以上、または全体6人以上の通報でペナルティ
        return self.same_team_reports >= 4 or self.total_reports >= 6
