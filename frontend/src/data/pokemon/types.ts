/**
 * Pokemon data types for Unite Mate
 */

// ポケモンのタイプ定義
export const POKEMON_TYPES = {
  ATTACKER: "アタック",
  ALL_ROUNDER: "バランス",
  SPEEDSTER: "スピード",
  DEFENDER: "ディフェンス",
  SUPPORTER: "サポート",
} as const;

export type PokemonType = (typeof POKEMON_TYPES)[keyof typeof POKEMON_TYPES];

export interface PokemonData {
  display: string;
  jp_name: string;
  index_number: string;
  type: string; // ポケモンタイプ
  _1a: string; // Move 1A
  _1b: string; // Move 1B
  _2a: string; // Move 2A
  _2b: string; // Move 2B
  icon: string;
}

export interface PokemonMoves {
  move_1a: string;
  move_1b: string;
  move_2a: string;
  move_2b: string;
}

export interface FormattedPokemon {
  pokemon_id: string;
  name_ja: string;
  name_en: string;
  index_number: number;
  type: string; // ポケモンタイプ
  moves: PokemonMoves;
  icon_url: string | null;
}

// Union type for all Pokemon IDs (will be generated based on actual data)
export type PokemonId = string;
