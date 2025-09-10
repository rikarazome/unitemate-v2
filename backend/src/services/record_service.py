from ..models.match import Match
from ..models.record import Record, RecordSearchFilter
from ..repositories.record_repository import RecordRepository


class RecordService:
    def __init__(self):
        self.record_repository = RecordRepository()

    def get_user_records(self, user_id: str, limit: int = 50) -> list[Record]:
        return self.record_repository.get_user_records(user_id, limit)

    def get_user_records_by_date_range(
        self, user_id: str, start_date: int, end_date: int, limit: int = 50
    ) -> list[Record]:
        return self.record_repository.get_user_records_by_date_range(user_id, start_date, end_date, limit)

    def get_records_by_match_id(self, match_id: str) -> list[Record]:
        return self.record_repository.get_records_by_match_id(match_id)

    def search_records(self, search_filter: RecordSearchFilter) -> list[Record]:
        return self.record_repository.search_records(search_filter)

    def create_records_from_match(self, match: Match) -> bool:
        """マッチ結果からレコードを作成"""
        if not match.winner_team or not match.completed_at or not match.started_at:
            print(f"Match {match.match_id} is not completed or missing data")
            return False

        records = []

        # チームAのレコード作成
        for player in match.team_a:
            is_winner = match.winner_team == "A"
            record = Record.create_from_match_result(
                user_id=player.user_id,
                match_id=match.match_id,
                team="A",
                is_winner=is_winner,
                rate_before=player.rate,
                rate_after=player.rate,  # 実際のレート更新は別途処理
                started_date=match.started_at,
                completed_date=match.completed_at,
                team_a_players=[p.user_id for p in match.team_a],
                team_b_players=[p.user_id for p in match.team_b],
                pokemon=player.pokemon,
            )
            records.append(record)

        # チームBのレコード作成
        for player in match.team_b:
            is_winner = match.winner_team == "B"
            record = Record.create_from_match_result(
                user_id=player.user_id,
                match_id=match.match_id,
                team="B",
                is_winner=is_winner,
                rate_before=player.rate,
                rate_after=player.rate,  # 実際のレート更新は別途処理
                started_date=match.started_at,
                completed_date=match.completed_at,
                team_a_players=[p.user_id for p in match.team_a],
                team_b_players=[p.user_id for p in match.team_b],
                pokemon=player.pokemon,
            )
            records.append(record)

        return self.record_repository.create_multiple(records)

    def update_record_rates(self, match_id: str, user_rates: dict) -> bool:
        """レコードのレート情報を更新"""
        records = self.record_repository.get_records_by_match_id(match_id)

        for record in records:
            if record.user_id in user_rates:
                rate_after = user_rates[record.user_id]
                record.rate_after = rate_after
                record.rate_delta = rate_after - record.rate_before
                self.record_repository.update(record)

        return True

    def delete_records_by_match_id(self, match_id: str) -> bool:
        return self.record_repository.delete_by_match_id(match_id)

    def get_user_stats(self, user_id: str, days: int = 30) -> dict:
        return self.record_repository.get_user_stats(user_id, days)

    def get_pokemon_win_rates(self, user_id: str, limit: int = 100) -> dict:
        """ユーザーのポケモン別勝率を取得"""
        records = self.record_repository.get_user_records(user_id, limit)

        pokemon_stats = {}
        for record in records:
            if not record.pokemon:
                continue

            if record.pokemon not in pokemon_stats:
                pokemon_stats[record.pokemon] = {"total": 0, "wins": 0}

            pokemon_stats[record.pokemon]["total"] += 1
            if record.is_winner:
                pokemon_stats[record.pokemon]["wins"] += 1

        # 勝率を計算
        for pokemon, stats in pokemon_stats.items():
            stats["win_rate"] = round((stats["wins"] / stats["total"]) * 100, 1) if stats["total"] > 0 else 0.0

        return pokemon_stats

    def get_recent_performance(self, user_id: str, limit: int = 10) -> dict:
        """最近の成績を取得"""
        records = self.record_repository.get_user_records(user_id, limit)

        if not records:
            return {
                "recent_matches": 0,
                "recent_wins": 0,
                "recent_win_rate": 0.0,
                "recent_rate_change": 0,
                "streak": {"type": None, "count": 0},
            }

        recent_wins = sum(1 for r in records if r.is_winner)
        recent_rate_change = sum(r.rate_delta for r in records)

        # 連勝/連敗の計算
        streak_type = None
        streak_count = 0

        if records:
            current_result = records[0].is_winner
            streak_type = "win" if current_result else "loss"
            streak_count = 1

            for record in records[1:]:
                if record.is_winner == current_result:
                    streak_count += 1
                else:
                    break

        return {
            "recent_matches": len(records),
            "recent_wins": recent_wins,
            "recent_win_rate": round((recent_wins / len(records)) * 100, 1),
            "recent_rate_change": recent_rate_change,
            "streak": {"type": streak_type, "count": streak_count},
        }
