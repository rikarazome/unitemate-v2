/**
 * ポケモン選択コンポーネント
 * 横5×縦可変のアイコンリストで表示
 * タイプが選択された場合のみそのタイプのポケモン一覧を表示
 */

import React, { useState, useMemo } from "react";
import { useAllPokemon } from "../hooks/usePokemon";
import { POKEMON_TYPES } from "../data/pokemon/types";

interface PokemonSelectorProps {
  selectedPokemon: string[];
  onPokemonToggle: (pokemonId: string) => void;
  maxSelections?: number;
  className?: string;
}

const PokemonSelector: React.FC<PokemonSelectorProps> = ({
  selectedPokemon,
  onPokemonToggle,
  maxSelections = 3,
  className = "",
}) => {
  const { data: allPokemon } = useAllPokemon();
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // タイプでフィルタリングされたポケモン
  const filteredPokemon = useMemo(() => {
    if (!selectedType) return [];
    return allPokemon.filter((pokemon) => pokemon.type === selectedType);
  }, [allPokemon, selectedType]);

  // タイプフィルターボタン
  const typeFilters = Object.values(POKEMON_TYPES);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* タイプフィルター行 */}
      <div className="grid grid-cols-5 gap-2">
        {typeFilters.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setSelectedType(selectedType === type ? null : type)}
            className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
              selectedType === type
                ? "bg-blue-100 border-blue-500 text-blue-700"
                : "bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* ポケモンアイコンリスト */}
      {selectedType && (
        <div className="grid grid-cols-5 gap-2 max-h-96 overflow-y-auto">
          {filteredPokemon
            .filter((pokemon) => pokemon.pokemon_id !== "EMPTY") // 「未選択」を除外
            .map((pokemon) => {
              const isSelected = selectedPokemon.includes(pokemon.pokemon_id);
              const isDisabled =
                selectedPokemon.length >= maxSelections && !isSelected;

              return (
                <div key={pokemon.pokemon_id} className="relative">
                  <button
                    type="button"
                    onClick={() => onPokemonToggle(pokemon.pokemon_id)}
                    disabled={isDisabled}
                    className={`
                      w-full aspect-square rounded-lg border-2 text-xs font-medium transition-all
                      disabled:opacity-50 disabled:cursor-not-allowed
                      hover:scale-105 active:scale-95 overflow-hidden
                      ${
                        isSelected
                          ? "bg-green-100 border-green-500 text-green-700 shadow-md"
                          : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
                      }
                    `}
                    title={`${pokemon.name_ja} (${pokemon.type})`}
                  >
                    {pokemon.icon_url ? (
                      <div className="relative w-full h-full">
                        <img
                          src={pokemon.icon_url}
                          alt={pokemon.name_ja}
                          className="absolute inset-0 w-full h-full object-contain p-1"
                          onError={(e) => {
                            // 画像読み込み失敗時はテキストで代替
                            e.currentTarget.style.display = "none";
                          }}
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs px-1 py-0.5 rounded-b-lg">
                          <span className="text-center truncate block leading-tight">
                            {pokemon.name_ja}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full p-1">
                        <span className="text-xs leading-tight text-center">
                          {pokemon.name_ja}
                        </span>
                      </div>
                    )}
                  </button>

                  {/* 選択済みインジケーター */}
                  {isSelected && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* 選択状況表示 */}
      <div className="text-center">
        <p className="text-sm text-gray-600">
          選択済み: {selectedPokemon.length}/{maxSelections}
        </p>
        {selectedType && (
          <p className="text-xs text-gray-500 mt-1">
            フィルター: {selectedType} (
            {filteredPokemon.filter((p) => p.pokemon_id !== "EMPTY").length}匹)
          </p>
        )}
      </div>
    </div>
  );
};

export default PokemonSelector;
