from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class PokemonRole(str, Enum):
    ATTACKER = "ATTACKER"
    SPEEDSTER = "SPEEDSTER"
    ALL_ROUNDER = "ALL_ROUNDER"
    DEFENDER = "DEFENDER"
    SUPPORTER = "SUPPORTER"


class PokemonStyle(str, Enum):
    MELEE = "MELEE"
    RANGED = "RANGED"


class Pokemon(BaseModel):
    pokemon_id: str = Field(..., description="ポケモンID（英語名）")
    name_ja: str = Field(..., description="ポケモン名（日本語）")
    name_en: str = Field(..., description="ポケモン名（英語）")
    role: PokemonRole = Field(..., description="ポケモンのロール")
    style: PokemonStyle = Field(..., description="攻撃スタイル（近接/遠隔）")
    difficulty: int = Field(..., ge=1, le=5, description="難易度（1-5）")
    hp: int = Field(..., description="HP統計値")
    attack: int = Field(..., description="攻撃統計値")
    defense: int = Field(..., description="防御統計値")
    sp_attack: int = Field(..., description="特攻統計値")
    sp_defense: int = Field(..., description="特防統計値")
    mobility: int = Field(..., description="移動能力統計値")
    scoring: int = Field(..., description="得点能力統計値")
    support: int = Field(..., description="サポート能力統計値")
    image_url: str | None = Field(None, description="ポケモン画像URL")
    release_date: int | None = Field(None, description="実装日（unixtime）")
    is_active: bool = Field(default=True, description="現在使用可能かどうか")
    created_at: int = Field(..., description="レコード作成日時（unixtime）")
    updated_at: int = Field(..., description="レコード更新日時（unixtime）")

    @classmethod
    def create_new_pokemon(
        cls,
        pokemon_id: str,
        name_ja: str,
        name_en: str,
        role: PokemonRole,
        style: PokemonStyle,
        difficulty: int,
        hp: int,
        attack: int,
        defense: int,
        sp_attack: int,
        sp_defense: int,
        mobility: int,
        scoring: int,
        support: int,
        image_url: str | None = None,
        release_date: int | None = None,
    ) -> "Pokemon":
        now = int(datetime.now().timestamp())
        return cls(
            pokemon_id=pokemon_id,
            name_ja=name_ja,
            name_en=name_en,
            role=role,
            style=style,
            difficulty=difficulty,
            hp=hp,
            attack=attack,
            defense=defense,
            sp_attack=sp_attack,
            sp_defense=sp_defense,
            mobility=mobility,
            scoring=scoring,
            support=support,
            image_url=image_url,
            release_date=release_date,
            is_active=True,
            created_at=now,
            updated_at=now,
        )

    def update_stats(
        self,
        hp: int | None = None,
        attack: int | None = None,
        defense: int | None = None,
        sp_attack: int | None = None,
        sp_defense: int | None = None,
        mobility: int | None = None,
        scoring: int | None = None,
        support: int | None = None,
    ) -> None:
        if hp is not None:
            self.hp = hp
        if attack is not None:
            self.attack = attack
        if defense is not None:
            self.defense = defense
        if sp_attack is not None:
            self.sp_attack = sp_attack
        if sp_defense is not None:
            self.sp_defense = sp_defense
        if mobility is not None:
            self.mobility = mobility
        if scoring is not None:
            self.scoring = scoring
        if support is not None:
            self.support = support
        self.updated_at = int(datetime.now().timestamp())

    def deactivate(self) -> None:
        self.is_active = False
        self.updated_at = int(datetime.now().timestamp())

    def activate(self) -> None:
        self.is_active = True
        self.updated_at = int(datetime.now().timestamp())


class PokemonUsageStats(BaseModel):
    """ポケモン使用統計"""

    pokemon_id: str
    total_matches: int = 0
    wins: int = 0
    losses: int = 0
    win_rate: float = 0.0
    pick_rate: float = 0.0
    avg_rate_delta: float = 0.0


class CreatePokemonRequest(BaseModel):
    pokemon_id: str
    name_ja: str
    name_en: str
    role: PokemonRole
    style: PokemonStyle
    difficulty: int = Field(..., ge=1, le=5)
    hp: int
    attack: int
    defense: int
    sp_attack: int
    sp_defense: int
    mobility: int
    scoring: int
    support: int
    image_url: str | None = None
    release_date: int | None = None


class UpdatePokemonRequest(BaseModel):
    hp: int | None = None
    attack: int | None = None
    defense: int | None = None
    sp_attack: int | None = None
    sp_defense: int | None = None
    mobility: int | None = None
    scoring: int | None = None
    support: int | None = None
    image_url: str | None = None
    is_active: bool | None = None
