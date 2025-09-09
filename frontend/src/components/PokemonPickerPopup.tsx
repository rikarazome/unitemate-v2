/**
 * ポケモンピッカーポップアップコンポーネント
 * 1行目にタイプタブ（アタック/バランス/スピード/ディフェンス/サポート）
 * 2行目以降に該当タイプのポケモンアイコンリスト
 */

import React, { useState, useMemo } from "react";
import { useAllPokemon } from "../hooks/usePokemon";
import { POKEMON_TYPES } from "../data/pokemon/types";
import type { PokemonPickerProps, PokemonSlot } from "../types/lfg";

const PokemonPickerPopup: React.FC<PokemonPickerProps> = ({
  isOpen,
  onClose,
  selectedRole,
  slotIndex,
  onSelectPokemon,
  currentRoleSlots = [], // 現在のロールで既に選択済みのポケモン
}) => {
  const { data: allPokemon } = useAllPokemon();
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // タイプでフィルタリングされたポケモン
  const filteredPokemon = useMemo(() => {
    if (!selectedType) return [];
    // POKEMON_TYPESのキーからvalue（日本語名）を取得してフィルタリング
    const typeValue = POKEMON_TYPES[selectedType as keyof typeof POKEMON_TYPES];
    return allPokemon.filter((pokemon) => pokemon.type === typeValue);
  }, [allPokemon, selectedType]);

  // ポケモン選択処理
  const handleSelectPokemon = (pokemon: {
    pokemon_id: string;
    name_ja: string;
    type: string;
    icon_url: string;
  }) => {
    // 同じロール内での重複チェック
    const isAlreadySelected = currentRoleSlots.some(
      (slot) => slot.id === pokemon.pokemon_id,
    );
    if (isAlreadySelected) return; // 既に選択済みの場合は何もしない

    const pokemonSlot: PokemonSlot = {
      id: pokemon.pokemon_id,
      name: pokemon.name_ja,
      type: pokemon.type,
      iconUrl: pokemon.icon_url,
    };

    onSelectPokemon(selectedRole, slotIndex, pokemonSlot);
    onClose();
  };

  // ポケモンが選択済みかどうかをチェック
  const isPokemonSelected = (pokemonId: string) => {
    return currentRoleSlots.some((slot) => slot.id === pokemonId);
  };

  // タイプタブのリスト（色付き）
  const typeFilters = Object.entries(POKEMON_TYPES);

  // タイプ別の色定義
  const getTypeColor = (typeKey: string) => {
    switch (typeKey) {
      case "ATTACKER":
        return "bg-red-600 text-white border-red-600 hover:bg-red-700";
      case "ALL_ROUNDER":
        return "bg-purple-600 text-white border-purple-600 hover:bg-purple-700";
      case "SPEEDSTER":
        return "bg-blue-600 text-white border-blue-600 hover:bg-blue-700";
      case "DEFENDER":
        return "bg-green-600 text-white border-green-600 hover:bg-green-700";
      case "SUPPORTER":
        return "bg-yellow-500 text-white border-yellow-500 hover:bg-yellow-600";
      default:
        return "bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 max-[500px]:p-0">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden max-[500px]:rounded-none max-[500px]:max-h-full max-[500px]:h-full max-[500px]:mx-0">
        {/* ヘッダー */}
        <div className="flex justify-between items-center p-6 max-[500px]:p-2 border-b">
          <h2 className="text-xl max-[500px]:text-lg font-bold text-gray-800">
            ポケモンを選択
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl max-[500px]:text-lg p-1"
            aria-label="ポップアップを閉じる"
          >
            ×
          </button>
        </div>

        <div className="p-6 max-[500px]:px-[5px] max-[500px]:py-2">
          {/* タイプフィルター行 */}
          <div className="mb-6 max-[500px]:mb-1">
            <div className="grid grid-cols-5 gap-2 max-[500px]:gap-0">
              {typeFilters.map(([typeKey, typeLabel]) => (
                <button
                  key={typeKey}
                  type="button"
                  onClick={() =>
                    setSelectedType(selectedType === typeKey ? null : typeKey)
                  }
                  className={`px-1 py-2 sm:px-3 sm:py-3 max-[500px]:px-0.5 max-[500px]:py-1 rounded-lg border text-xs sm:text-sm max-[500px]:text-[10px] font-medium transition-all duration-200 whitespace-nowrap text-center flex items-center justify-center ${
                    selectedType === typeKey
                      ? `${getTypeColor(typeKey)} shadow-lg scale-105`
                      : getTypeColor(typeKey).replace("hover:", "") +
                        " opacity-70 hover:opacity-100"
                  }`}
                  aria-label={`${typeLabel}タイプを${selectedType === typeKey ? "選択解除" : "選択"}する`}
                >
                  {typeLabel}
                </button>
              ))}
            </div>
          </div>

          {/* ポケモンリスト */}
          <div className="overflow-y-auto max-h-96">
            {!selectedType ? (
              <div className="text-center py-12 text-gray-500">
                <svg
                  className="w-12 h-12 mx-auto mb-4 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p>タイプを選択してポケモンを表示してください</p>
              </div>
            ) : filteredPokemon.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>該当するポケモンが見つかりません</p>
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-3 max-[500px]:gap-0">
                {filteredPokemon
                  .filter((pokemon) => pokemon.pokemon_id !== "EMPTY")
                  .sort((a, b) => a.index_number - b.index_number)
                  .map((pokemon) => {
                    const isSelected = isPokemonSelected(pokemon.pokemon_id);

                    return (
                      <button
                        key={pokemon.pokemon_id}
                        type="button"
                        onClick={() =>
                          handleSelectPokemon({
                            pokemon_id: pokemon.pokemon_id,
                            name_ja: pokemon.name_ja,
                            type: pokemon.type,
                            icon_url: pokemon.icon_url || "",
                          })
                        }
                        disabled={isSelected}
                        className={`
                          relative aspect-square rounded-lg border-2 transition-all duration-200 overflow-hidden group
                          ${
                            isSelected
                              ? "border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed"
                              : "border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400 hover:scale-105 active:scale-95"
                          }
                        `}
                        title={
                          isSelected
                            ? `${pokemon.name_ja}は既に選択済み`
                            : `${pokemon.name_ja}を選択`
                        }
                        aria-label={
                          isSelected
                            ? `${pokemon.name_ja}は既に選択済み`
                            : `${pokemon.name_ja}を選択する`
                        }
                      >
                        {pokemon.icon_url ? (
                          <div className="relative w-full h-full">
                            <img
                              src={pokemon.icon_url}
                              alt={pokemon.name_ja}
                              className="absolute inset-0 w-full h-full object-contain"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                            {/* 選択済みの場合のグレーオーバーレイ */}
                            {isSelected && (
                              <div className="absolute inset-0 bg-gray-500 bg-opacity-60 rounded-lg"></div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-80 text-white px-1 py-1 max-[500px]:px-0.5 max-[500px]:py-0.5 rounded-b-lg">
                              <div className="text-center">
                                <span
                                  className={`block leading-none ${
                                    pokemon.name_ja.length <= 3
                                      ? "text-[10px] max-[500px]:text-[8px]"
                                      : pokemon.name_ja.length <= 5
                                        ? "text-[9px] max-[500px]:text-[7px]"
                                        : pokemon.name_ja.length <= 7
                                          ? "text-[8px] max-[500px]:text-[6px]"
                                          : "text-[7px] max-[500px]:text-[5px]"
                                  }`}
                                >
                                  {pokemon.name_ja}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <span className="text-xs leading-tight text-center px-1">
                              {pokemon.name_ja}
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* フッター */}
        <div className="flex justify-end p-6 max-[500px]:px-[5px] max-[500px]:py-2 border-t bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 max-[500px]:px-2 max-[500px]:py-1 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors max-[500px]:text-sm"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
};

export default PokemonPickerPopup;
