import os
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_serializer

# Discord Guild (Server) ID
DISCORD_GUILD_ID = os.environ.get("DISCORD_GUILD_ID", "1146296887801024603")


class MatchPlayer(BaseModel):
    """マッチプレイヤー情報(Legacy YML仕様準拠)"""

    user_id: str = Field(description="ユーザーID")
    trainer_name: str = Field(description="トレーナー名")
    discord_username: str = Field(description="Discordユーザー名")
    discord_discriminator: str | None = Field(None, description="Discord識別子")
    discord_avatar_url: str = Field(description="Discordアバター画像URL")
    twitter_id: str | None = Field(None, description="TwitterID")
    rate: int = Field(description="現在のレート")
    max_rate: int = Field(description="最高レート")
    current_badge: str | None = Field(None, description="現在の勲章ID")
    current_badge_2: str | None = Field(None, description="2つ目の勲章ID")
    role: str | None = Field(None, description="希望ロール")
    pokemon: str | None = Field(None, description="選択ポケモン")

    @field_serializer("rate", "max_rate")
    def serialize_int_fields(self, value: int | None) -> Decimal | None:
        """Convert integer fields to Decimal for DynamoDB compatibility"""
        if value is None:
            return None
        return Decimal(int(value))


class MatchTeam(BaseModel):
    """マッチチーム情報"""

    team_id: Literal["A", "B"] = Field(description="チームID")
    team_name: str = Field(description="チーム名")
    is_first_attack: bool = Field(description="先攻かどうか")
    voice_channel: str | None = Field(None, description="VCチャンネル番号")
    players: list[MatchPlayer] = Field(description="チームプレイヤーリスト")
    average_rate: float = Field(description="チーム平均レート")

    @field_serializer("average_rate")
    def serialize_average_rate(self, value: float | None) -> Decimal | None:
        """Convert average_rate to Decimal for DynamoDB compatibility"""
        if value is None:
            return None
        return Decimal(str(value))


class Match(BaseModel):
    """マッチ情報(Legacy YML DynamoDBMatchTable準拠)"""

    # Legacy YML仕様のフィールド
    namespace: str = Field(description="名前空間(環境識別用)")
    match_id: int = Field(description="マッチID(数値)")
    status: Literal["matched", "done"] = Field(description="マッチステータス")
    matched_unixtime: int = Field(description="マッチング成立時刻(UNIX時間)")

    # 拡張フィールド
    team_a: MatchTeam = Field(description="チームA情報")
    team_b: MatchTeam = Field(description="チームB情報")
    vc_link_a: str | None = Field(None, description="チームAのDiscord VCリンク")
    vc_link_b: str | None = Field(None, description="チームBのDiscord VCリンク")
    match_type: str = Field(default="ranked", description="マッチタイプ")
    estimated_duration: int = Field(default=600, description="予想試合時間(秒)")

    # 試合結果関連
    winner_team: Literal["A", "B"] | None = Field(None, description="勝利チーム")
    finished_unixtime: int | None = Field(None, description="試合終了時刻(UNIX時間)")
    match_result_reported: bool = Field(default=False, description="試合結果報告済みフラグ")

    # レガシー互換性フィールド
    user_reports: list[str] = Field(default_factory=list, description="ユーザーからの報告")
    penalty_players: list[str] = Field(default_factory=list, description="ペナルティプレイヤー")
    judge_timeout_count: int = Field(default=0, description="ジャッジタイムアウト回数")

    # メタデータ
    created_at: int = Field(description="作成日時(UNIX時間)")
    updated_at: int = Field(description="更新日時(UNIX時間)")

    @field_serializer("match_id", "matched_unixtime", "estimated_duration",
                      "finished_unixtime", "judge_timeout_count", "created_at", "updated_at")
    def serialize_int_fields(self, value: int | None) -> Decimal | None:
        """Convert integer fields to Decimal for DynamoDB compatibility"""
        if value is None:
            return None
        return Decimal(int(value))

    @classmethod
    def create_new_match(
        cls,
        namespace: str,
        match_id: int,
        team_a_players: list[MatchPlayer],
        team_b_players: list[MatchPlayer],
        voice_channel_a: str | None = None,
        voice_channel_b: str | None = None,
        vc_channel_id_a: str | None = None,
        vc_channel_id_b: str | None = None,
    ) -> "Match":
        """新しいマッチを作成(Legacy YML仕様準拠)"""
        current_time = int(datetime.now().timestamp())

        # チーム平均レートを計算
        team_a_avg_rate = sum(p.rate for p in team_a_players) / len(team_a_players) if team_a_players else 0
        team_b_avg_rate = sum(p.rate for p in team_b_players) / len(team_b_players) if team_b_players else 0

        # 先攻後攻を決定(平均レートが高い方が後攻)
        team_a_first = team_a_avg_rate <= team_b_avg_rate

        # Discord VC リンクを生成
        vc_link_a = None
        vc_link_b = None
        if vc_channel_id_a:
            vc_link_a = f"https://discord.com/channels/{DISCORD_GUILD_ID}/{vc_channel_id_a}"
        if vc_channel_id_b:
            vc_link_b = f"https://discord.com/channels/{DISCORD_GUILD_ID}/{vc_channel_id_b}"

        # チーム情報を作成
        team_a = MatchTeam(
            team_id="A",
            team_name="チームA",
            is_first_attack=team_a_first,
            voice_channel=voice_channel_a,
            players=sorted(team_a_players, key=lambda p: p.rate, reverse=True),
            average_rate=team_a_avg_rate,
        )

        team_b = MatchTeam(
            team_id="B",
            team_name="チームB",
            is_first_attack=not team_a_first,
            voice_channel=voice_channel_b,
            players=sorted(team_b_players, key=lambda p: p.rate, reverse=True),
            average_rate=team_b_avg_rate,
        )

        return cls(
            namespace=namespace,
            match_id=match_id,
            status="matched",
            matched_unixtime=current_time,
            team_a=team_a,
            team_b=team_b,
            vc_link_a=vc_link_a,
            vc_link_b=vc_link_b,
            created_at=current_time,
            updated_at=current_time,
        )

    def start_match(self) -> None:
        """マッチを開始"""
        self.status = "matched"
        self.updated_at = int(datetime.now().timestamp())

    def finish_match(self, winner_team: Literal["A", "B"]) -> None:
        """マッチを終了"""
        self.status = "done"
        self.winner_team = winner_team
        self.finished_unixtime = int(datetime.now().timestamp())
        self.updated_at = int(datetime.now().timestamp())

    def cancel_match(self) -> None:
        """マッチをキャンセル"""
        self.status = "done"
        self.updated_at = int(datetime.now().timestamp())

    def report_result(self) -> None:
        """試合結果報告済みにマーク"""
        self.match_result_reported = True
        self.updated_at = int(datetime.now().timestamp())

    def add_user_report(self, user_id: str) -> None:
        """ユーザー報告を追加"""
        if user_id not in self.user_reports:
            self.user_reports.append(user_id)
        self.updated_at = int(datetime.now().timestamp())

    def add_penalty_player(self, user_id: str) -> None:
        """ペナルティプレイヤーを追加"""
        if user_id not in self.penalty_players:
            self.penalty_players.append(user_id)
        self.updated_at = int(datetime.now().timestamp())

    def increment_judge_timeout(self) -> None:
        """ジャッジタイムアウト回数を増加"""
        self.judge_timeout_count += 1
        self.updated_at = int(datetime.now().timestamp())

    @property
    def all_players(self) -> list[str]:
        """全プレイヤーのuser_idリストを取得"""
        return [p.user_id for p in self.team_a.players] + [p.user_id for p in self.team_b.players]

    def get_player_team(self, user_id: str) -> Literal["A", "B"] | None:
        """プレイヤーがどのチームに所属しているかを取得"""
        if any(p.user_id == user_id for p in self.team_a.players):
            return "A"
        if any(p.user_id == user_id for p in self.team_b.players):
            return "B"
        return None


# API レスポンス用の型定義
class MatchResponse(BaseModel):
    """マッチ情報レスポンス(フロントエンド用)"""

    match_id: str = Field(description="マッチID(文字列)")
    team_a: MatchTeam = Field(description="チームA情報")
    team_b: MatchTeam = Field(description="チームB情報")
    vc_link_a: str | None = Field(None, description="チームAのDiscord VCリンク")
    vc_link_b: str | None = Field(None, description="チームBのDiscord VCリンク")
    status: Literal["matched", "done"] = Field(description="マッチステータス")
    started_at: str | None = Field(None, description="マッチ開始時刻(ISO形式)")

    @classmethod
    def from_match(cls, match: Match) -> "MatchResponse":
        """MatchモデルからMatchResponseを作成"""
        started_at = None
        if match.status == "matched" and match.matched_unixtime:
            started_at = datetime.fromtimestamp(match.matched_unixtime).isoformat()

        return cls(
            match_id=str(match.match_id),
            team_a=match.team_a,
            team_b=match.team_b,
            vc_link_a=match.vc_link_a if hasattr(match, "vc_link_a") else None,
            vc_link_b=match.vc_link_b if hasattr(match, "vc_link_b") else None,
            status=match.status,
            started_at=started_at,
        )


# リクエスト用の型定義(Legacy YML準拠で更新)
class CreateMatchRequest(BaseModel):
    """マッチ作成リクエスト"""

    team_a_players: list[MatchPlayer] = Field(description="チームAのプレイヤー情報")
    team_b_players: list[MatchPlayer] = Field(description="チームBのプレイヤー情報")
    voice_channel_a: str | None = Field(None, description="チームAのVCチャンネル")
    voice_channel_b: str | None = Field(None, description="チームBのVCチャンネル")


class ReportMatchResultRequest(BaseModel):
    """マッチ結果報告リクエスト(Legacy YML準拠)"""

    match_id: int = Field(description="マッチID")
    winner_team: Literal["A", "B"] = Field(description="勝利チーム")
    reporter_user_id: str = Field(description="報告者のユーザーID")
    team_a_results: list[dict] | None = Field(None, description="チームAの結果詳細")
    team_b_results: list[dict] | None = Field(None, description="チームBの結果詳細")
    violation_reports: list[str] = Field(default_factory=list, description="迷惑行為通報対象のuser_idリスト")
    picked_pokemon: str | None = Field(None, description="使用したポケモンID")


class GetMatchInfoRequest(BaseModel):
    """マッチ情報取得リクエスト(Legacy YML準拠)"""

    user_id: str = Field(description="ユーザーID")


class UpdateMatchStatusRequest(BaseModel):
    """マッチステータス更新リクエスト"""

    match_id: int = Field(description="マッチID")
    status: Literal["matched", "done"] = Field(description="新しいステータス")
    winner_team: Literal["A", "B"] | None = Field(None, description="勝利チーム(done時のみ)")
