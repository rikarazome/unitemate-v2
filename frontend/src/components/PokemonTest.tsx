/**
 * Test component for Pokemon local data system
 */

import React from "react";
import {
  useAllPokemon,
  usePokemon,
  usePokemonSearch,
} from "../hooks/usePokemon";

export const PokemonTest: React.FC = () => {
  const { data: allPokemon } = useAllPokemon();
  const { data: pikachu } = usePokemon("PIKACHU");
  const { data: searchResults } = usePokemonSearch("ピカチュウ");

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Pokemon Data Test</h2>

      <div className="mb-4">
        <h3 className="font-semibold">Total Pokemon: {allPokemon.length}</h3>
      </div>

      {pikachu && (
        <div className="mb-4">
          <h3 className="font-semibold">Pikachu Data:</h3>
          <p>
            Name: {pikachu.name_ja} ({pikachu.name_en})
          </p>
          <p>Moves: {Object.values(pikachu.moves).join(", ")}</p>
        </div>
      )}

      <div className="mb-4">
        <h3 className="font-semibold">
          Search Results for &apos;ピカチュウ&apos;: {searchResults.length}
        </h3>
        {searchResults.map((pokemon) => (
          <div key={pokemon.pokemon_id} className="ml-4">
            {pokemon.name_ja} ({pokemon.name_en})
          </div>
        ))}
      </div>

      <div>
        <h3 className="font-semibold">First 5 Pokemon:</h3>
        {allPokemon.slice(0, 5).map((pokemon) => (
          <div key={pokemon.pokemon_id} className="ml-4">
            {pokemon.name_ja} - {Object.values(pokemon.moves).join(", ")}
          </div>
        ))}
      </div>
    </div>
  );
};
