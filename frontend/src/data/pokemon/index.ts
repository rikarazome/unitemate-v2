/**
 * Pokemon data module - centralizes access to Pokemon data
 */

import pokemonRawData from "./pokemon.json";
import type { PokemonData, FormattedPokemon } from "./types";

// Cast the imported data to proper type
const rawData = pokemonRawData as PokemonData[];

// Transform raw data to formatted structure
export const POKEMON_DATA: FormattedPokemon[] = rawData.map((pokemon) => ({
  pokemon_id: pokemon.display.toUpperCase(),
  name_ja: pokemon.jp_name,
  name_en: pokemon.display.charAt(0).toUpperCase() + pokemon.display.slice(1),
  index_number: parseInt(pokemon.index_number),
  type: pokemon.type,
  moves: {
    move_1a: pokemon._1a,
    move_1b: pokemon._1b,
    move_2a: pokemon._2a,
    move_2b: pokemon._2b,
  },
  icon_url: pokemon.icon || null,
}));

// Create a map for O(1) lookups
export const POKEMON_MAP = new Map<string, FormattedPokemon>(
  POKEMON_DATA.map((pokemon) => [pokemon.pokemon_id, pokemon]),
);

// Extract all Pokemon IDs for type checking
export const POKEMON_IDS = POKEMON_DATA.map((pokemon) => pokemon.pokemon_id);

// Helper functions
export const getPokemonById = (id: string): FormattedPokemon | undefined => {
  return POKEMON_MAP.get(id.toUpperCase());
};

export const getAllPokemon = (): FormattedPokemon[] => {
  return POKEMON_DATA;
};

export const searchPokemon = (query: string): FormattedPokemon[] => {
  const lowerQuery = query.toLowerCase();
  return POKEMON_DATA.filter(
    (pokemon) =>
      pokemon.name_ja.toLowerCase().includes(lowerQuery) ||
      pokemon.name_en.toLowerCase().includes(lowerQuery) ||
      pokemon.pokemon_id.toLowerCase().includes(lowerQuery),
  );
};

export const getPokemonByMove = (moveName: string): FormattedPokemon[] => {
  const lowerMove = moveName.toLowerCase();
  return POKEMON_DATA.filter((pokemon) =>
    Object.values(pokemon.moves).some((move) =>
      move.toLowerCase().includes(lowerMove),
    ),
  );
};

// Export types
export type { PokemonData, FormattedPokemon } from "./types";
