from ..models.pokemon import CreatePokemonRequest, Pokemon, PokemonRole, PokemonUsageStats, UpdatePokemonRequest
from ..repositories.pokemon_repository import PokemonRepository
from ..services.record_service import RecordService


class PokemonService:
    def __init__(self):
        self.pokemon_repository = PokemonRepository()
        self.record_service = RecordService()

    def get_pokemon_by_id(self, pokemon_id: str) -> Pokemon | None:
        return self.pokemon_repository.get_by_pokemon_id(pokemon_id)

    def get_all_pokemon(self, include_inactive: bool = False) -> list[Pokemon]:
        return self.pokemon_repository.get_all(include_inactive)

    def get_pokemon_by_role(self, role: PokemonRole, include_inactive: bool = False) -> list[Pokemon]:
        return self.pokemon_repository.get_by_role(role, include_inactive)

    def search_pokemon(self, keyword: str) -> list[Pokemon]:
        return self.pokemon_repository.search_by_name(keyword)

    def get_pokemon_by_difficulty(self, min_difficulty: int = 1, max_difficulty: int = 5) -> list[Pokemon]:
        return self.pokemon_repository.get_pokemon_by_difficulty(min_difficulty, max_difficulty)

    def create_pokemon(self, request: CreatePokemonRequest) -> Pokemon | None:
        pokemon = Pokemon.create_new_pokemon(
            pokemon_id=request.pokemon_id,
            name_ja=request.name_ja,
            name_en=request.name_en,
            role=request.role,
            style=request.style,
            difficulty=request.difficulty,
            hp=request.hp,
            attack=request.attack,
            defense=request.defense,
            sp_attack=request.sp_attack,
            sp_defense=request.sp_defense,
            mobility=request.mobility,
            scoring=request.scoring,
            support=request.support,
            image_url=request.image_url,
            release_date=request.release_date,
        )

        if self.pokemon_repository.create(pokemon):
            return pokemon
        return None

    def update_pokemon(self, pokemon_id: str, request: UpdatePokemonRequest) -> Pokemon | None:
        pokemon = self.pokemon_repository.get_by_pokemon_id(pokemon_id)
        if not pokemon:
            return None

        # ステータス更新
        pokemon.update_stats(
            hp=request.hp,
            attack=request.attack,
            defense=request.defense,
            sp_attack=request.sp_attack,
            sp_defense=request.sp_defense,
            mobility=request.mobility,
            scoring=request.scoring,
            support=request.support,
        )

        # その他のフィールド更新
        if request.image_url is not None:
            pokemon.image_url = request.image_url
        if request.is_active is not None:
            if request.is_active:
                pokemon.activate()
            else:
                pokemon.deactivate()

        if self.pokemon_repository.update(pokemon):
            return pokemon
        return None

    def deactivate_pokemon(self, pokemon_id: str) -> Pokemon | None:
        pokemon = self.pokemon_repository.get_by_pokemon_id(pokemon_id)
        if not pokemon:
            return None

        pokemon.deactivate()

        if self.pokemon_repository.update(pokemon):
            return pokemon
        return None

    def activate_pokemon(self, pokemon_id: str) -> Pokemon | None:
        pokemon = self.pokemon_repository.get_by_pokemon_id(pokemon_id)
        if not pokemon:
            return None

        pokemon.activate()

        if self.pokemon_repository.update(pokemon):
            return pokemon
        return None

    def get_pokemon_usage_stats(self, days: int = 30) -> list[PokemonUsageStats]:
        """ポケモンの使用統計を取得"""
        # 全ポケモンを取得
        all_pokemon = self.pokemon_repository.get_all(include_inactive=True)

        # 各ポケモンの統計を計算
        stats_list = []
        total_matches = 0

        for pokemon in all_pokemon:
            # RecordServiceから統計を取得（実装が必要）
            # ここでは仮の実装
            stats = PokemonUsageStats(
                pokemon_id=pokemon.pokemon_id,
                total_matches=0,
                wins=0,
                losses=0,
                win_rate=0.0,
                pick_rate=0.0,
                avg_rate_delta=0.0,
            )
            stats_list.append(stats)

        return stats_list

    def get_meta_report(self) -> dict:
        """メタレポート（人気ポケモンランキング）を取得"""
        stats = self.get_pokemon_usage_stats()

        # ピック率でソート
        most_picked = sorted(stats, key=lambda x: x.pick_rate, reverse=True)[:10]

        # 勝率でソート（最低10試合）
        win_rate_filtered = [s for s in stats if s.total_matches >= 10]
        highest_win_rate = sorted(win_rate_filtered, key=lambda x: x.win_rate, reverse=True)[:10]

        # ロール別統計
        role_stats = {}
        for role in PokemonRole:
            role_pokemon = self.pokemon_repository.get_by_role(role, include_inactive=True)
            role_ids = {p.pokemon_id for p in role_pokemon}
            role_specific_stats = [s for s in stats if s.pokemon_id in role_ids]

            if role_specific_stats:
                total_picks = sum(s.total_matches for s in role_specific_stats)
                avg_win_rate = (
                    sum(s.win_rate * s.total_matches for s in role_specific_stats) / total_picks
                    if total_picks > 0
                    else 0
                )

                role_stats[role.value] = {
                    "total_picks": total_picks,
                    "avg_win_rate": avg_win_rate,
                    "most_picked": sorted(role_specific_stats, key=lambda x: x.pick_rate, reverse=True)[0].pokemon_id
                    if role_specific_stats
                    else None,
                }

        return {
            "most_picked": [{"pokemon_id": s.pokemon_id, "pick_rate": s.pick_rate} for s in most_picked],
            "highest_win_rate": [{"pokemon_id": s.pokemon_id, "win_rate": s.win_rate} for s in highest_win_rate],
            "role_stats": role_stats,
            "total_active_pokemon": self.pokemon_repository.get_active_pokemon_count(),
        }
