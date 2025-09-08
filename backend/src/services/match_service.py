import uuid

from ..models.match import CreateMatchRequest, Match, ReportMatchResultRequest, MatchPlayer
from ..repositories.match_repository import MatchRepository
from ..services.user_service import UserService


class MatchService:
    def __init__(self):
        self.match_repository = MatchRepository()
        self.user_service = UserService()

    def get_match_by_id(self, match_id: str) -> Match | None:
        return self.match_repository.get_by_match_id(match_id)

    def get_recent_matches(self, limit: int = 50) -> list[Match]:
        return self.match_repository.get_recent_matches(limit)

    def get_user_matches(self, user_id: str, limit: int = 50) -> list[Match]:
        return self.match_repository.get_user_matches(user_id, limit)

    def get_active_matches(self) -> list[Match]:
        return self.match_repository.get_active_matches()

    def create_match(self, request: CreateMatchRequest) -> Match | None:
        # マッチIDを生成
        match_id = str(uuid.uuid4())

        # チームAのプレイヤー情報を取得
        team_a_players = []
        for user_id in request.team_a_players:
            user = self.user_service.get_user_by_user_id(user_id)
            if not user:
                print(f"User not found: {user_id}")
                return None
            team_a_players.append(
                MatchPlayer(
                    user_id=user_id,
                    trainer_name=user.trainer_name or user_id,
                    discord_username=user.discord_username or user_id,
                    discord_avatar_url=user.discord_avatar_url or "",
                    rate=user.rate,
                    max_rate=user.max_rate,
                )
            )

        # チームBのプレイヤー情報を取得
        team_b_players = []
        for user_id in request.team_b_players:
            user = self.user_service.get_user_by_user_id(user_id)
            if not user:
                print(f"User not found: {user_id}")
                return None
            team_b_players.append(
                MatchPlayer(
                    user_id=user_id,
                    trainer_name=user.trainer_name or user_id,
                    discord_username=user.discord_username or user_id,
                    discord_avatar_url=user.discord_avatar_url or "",
                    rate=user.rate,
                    max_rate=user.max_rate,
                )
            )

        # マッチを作成
        match = Match.create_new_match(
            namespace="default",
            match_id=int(match_id) if isinstance(match_id, str) else match_id,
            team_a_players=team_a_players,
            team_b_players=team_b_players,
            voice_channel_a=getattr(request, "vc_a", None),
            voice_channel_b=getattr(request, "vc_b", None),
        )

        if self.match_repository.create(match):
            return match
        return None

    def start_match(self, match_id: str) -> Match | None:
        match = self.match_repository.get_by_match_id(match_id)
        if not match:
            return None

        match.start_match()

        if self.match_repository.update(match):
            return match
        return None

    def report_match_result(self, match_id: str, request: ReportMatchResultRequest) -> Match | None:
        match = self.match_repository.get_by_match_id(match_id)
        if not match:
            return None

        # 報告者がマッチに参加しているかチェック
        if request.reporter_user_id not in match.all_players:
            print(f"Reporter {request.reporter_user_id} is not in match {match_id}")
            return None

        # 報告を追加
        match.add_user_report(request.reporter_user_id)

        # 過半数の報告があれば試合を完了
        total_players = len(match.all_players)
        required_reports = (total_players // 2) + 1

        if len(match.user_reports) >= required_reports:
            match.complete_match(request.winner_team)

            # レート更新処理
            user_rates = self._update_player_ratings(match)

            # レコード作成
            from ..services.record_service import RecordService

            record_service = RecordService()
            record_service.create_records_from_match(match)

            # レコードのレート情報を更新
            if user_rates:
                record_service.update_record_rates(match.match_id, user_rates)

        if self.match_repository.update(match):
            return match
        return None

    def cancel_match(self, match_id: str) -> Match | None:
        match = self.match_repository.get_by_match_id(match_id)
        if not match:
            return None

        match.cancel_match()

        if self.match_repository.update(match):
            return match
        return None

    def add_penalty_player(self, match_id: str, user_id: str) -> Match | None:
        match = self.match_repository.get_by_match_id(match_id)
        if not match:
            return None

        match.add_penalty_player(user_id)

        if self.match_repository.update(match):
            return match
        return None

    def _update_player_ratings(self, match: Match) -> dict:
        """マッチ結果に基づいてプレイヤーのレートを更新"""
        if not match.winner_team:
            return {}

        winner_team = match.team_a if match.winner_team == "A" else match.team_b
        loser_team = match.team_b if match.winner_team == "A" else match.team_a

        # 簡単なレート計算（実際のEloレーティングシステムを実装する場合は調整が必要）
        winner_avg_rate = sum(p.rate for p in winner_team) / len(winner_team)
        loser_avg_rate = sum(p.rate for p in loser_team) / len(loser_team)

        # 勝者には+30、敗者には-30の基本変動
        base_change = 30

        # レート差による調整
        rate_diff = winner_avg_rate - loser_avg_rate
        if rate_diff > 100:
            # 格上が勝った場合は変動を小さく
            winner_change = base_change - 10
            loser_change = -(base_change - 10)
        elif rate_diff < -100:
            # 格下が勝った場合は変動を大きく
            winner_change = base_change + 10
            loser_change = -(base_change + 10)
        else:
            winner_change = base_change
            loser_change = -base_change

        user_rates = {}

        # 勝者のレート更新
        for player in winner_team:
            updated_user = self.user_service.update_user_stats(player.user_id, winner_change, True)
            if updated_user:
                user_rates[player.user_id] = updated_user.rate

        # 敗者のレート更新
        for player in loser_team:
            updated_user = self.user_service.update_user_stats(player.user_id, loser_change, False)
            if updated_user:
                user_rates[player.user_id] = updated_user.rate

        return user_rates
