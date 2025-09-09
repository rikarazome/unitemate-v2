/**
 * Custom hooks for Pokemon data access
 * Replaces API calls with local data access for better performance
 */

import { useMemo } from "react";
import {
  POKEMON_DATA,
  getPokemonById,
  searchPokemon,
  getPokemonByMove,
} from "../data/pokemon";

/**
 * Hook to get all Pokemon data
 */
export const useAllPokemon = () => {
  return useMemo(
    () => ({
      data: POKEMON_DATA,
      isLoading: false,
      error: null,
    }),
    [],
  );
};

/**
 * Hook to get a specific Pokemon by ID
 */
export const usePokemon = (pokemonId: string | undefined) => {
  const pokemon = useMemo(() => {
    if (!pokemonId) return null;
    return getPokemonById(pokemonId);
  }, [pokemonId]);

  return useMemo(
    () => ({
      data: pokemon,
      isLoading: false,
      error:
        pokemon === undefined && pokemonId
          ? new Error(`Pokemon ${pokemonId} not found`)
          : null,
    }),
    [pokemon, pokemonId],
  );
};

/**
 * Hook to search Pokemon by name or ID
 */
export const usePokemonSearch = (query: string) => {
  const results = useMemo(() => {
    if (!query.trim()) return [];
    return searchPokemon(query);
  }, [query]);

  return useMemo(
    () => ({
      data: results,
      isLoading: false,
      error: null,
    }),
    [results],
  );
};

/**
 * Hook to get Pokemon by move name
 */
export const usePokemonByMove = (moveName: string) => {
  const results = useMemo(() => {
    if (!moveName.trim()) return [];
    return getPokemonByMove(moveName);
  }, [moveName]);

  return useMemo(
    () => ({
      data: results,
      isLoading: false,
      error: null,
    }),
    [results],
  );
};

/**
 * Hook to get Pokemon statistics
 */
export const usePokemonStats = () => {
  const stats = useMemo(() => {
    const totalCount = POKEMON_DATA.length;

    // Count moves
    const allMoves = new Set<string>();
    POKEMON_DATA.forEach((pokemon) => {
      Object.values(pokemon.moves).forEach((move) => {
        if (move) allMoves.add(move);
      });
    });

    return {
      totalPokemon: totalCount,
      totalMoves: allMoves.size,
    };
  }, []);

  return useMemo(
    () => ({
      data: stats,
      isLoading: false,
      error: null,
    }),
    [stats],
  );
};

/**
 * Hook for Pokemon dropdown/select options
 */
export const usePokemonOptions = () => {
  const options = useMemo(
    () =>
      POKEMON_DATA.map((pokemon) => ({
        value: pokemon.pokemon_id,
        label: `${pokemon.name_ja} (${pokemon.name_en})`,
        pokemon,
      })),
    [],
  );

  return useMemo(
    () => ({
      data: options,
      isLoading: false,
      error: null,
    }),
    [options],
  );
};
