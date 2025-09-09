/**
 * 得意ポケモン設定コンポーネント
 * 選択したロールとポケモンスロットを直接表示
 */

import React, { useState } from "react";
import { LFG_ROLE_LABELS, LFG_ROLES } from "../types/lfg";
import type { FavPokemonButtonProps, LfgRole, PokemonSlot } from "../types/lfg";
import PokemonPickerPopup from "./PokemonPickerPopup";

const FavPokemonButton: React.FC<FavPokemonButtonProps> = ({
  selectedRoles,
  pokemonSlots,
  onOpenModal: _onOpenModal, // eslint-disable-line @typescript-eslint/no-unused-vars
  onUpdatePokemonSlots,
  className = "",
}) => {
  const [pickerState, setPickerState] = useState<{
    isOpen: boolean;
    role: LfgRole | null;
    slotIndex: number;
  }>({
    isOpen: false,
    role: null,
    slotIndex: 0,
  });
  // ロール別の色定義
  const getRoleColor = (role: LfgRole) => {
    const colors = {
      [LFG_ROLES.TOP_LANE]: "bg-purple-400 text-white",
      [LFG_ROLES.SUPPORT]: "bg-yellow-400 text-white",
      [LFG_ROLES.MIDDLE]: "bg-cyan-400 text-white",
      [LFG_ROLES.BOTTOM_LANE]: "bg-red-400 text-white",
      [LFG_ROLES.TANK]: "bg-green-400 text-white",
    };
    return colors[role];
  };

  // ロール別のアイコンパス定義
  const getRoleIcon = (role: LfgRole) => {
    const roleIcons = {
      [LFG_ROLES.TOP_LANE]: "/role_icons/role_top.png",
      [LFG_ROLES.SUPPORT]: "/role_icons/role_support.png",
      [LFG_ROLES.MIDDLE]: "/role_icons/role_mid.png",
      [LFG_ROLES.BOTTOM_LANE]: "/role_icons/role_bottom.png",
      [LFG_ROLES.TANK]: "/role_icons/role_tank.png",
    };
    return roleIcons[role];
  };

  // ポケモン選択処理
  const handleSelectPokemon = (
    role: LfgRole,
    slotIndex: number,
    pokemon: PokemonSlot,
  ) => {
    const newSlots = { ...pokemonSlots };
    const roleSlots = [...newSlots[role]];

    if (slotIndex < roleSlots.length) {
      roleSlots[slotIndex] = pokemon;
    } else {
      roleSlots.push(pokemon);
    }

    newSlots[role] = roleSlots;
    onUpdatePokemonSlots(newSlots);
  };

  // ポケモン削除処理
  const handleRemovePokemon = (role: LfgRole, slotIndex: number) => {
    const newSlots = { ...pokemonSlots };
    newSlots[role] = newSlots[role].filter((_, index) => index !== slotIndex);
    onUpdatePokemonSlots(newSlots);
  };

  // スロットクリック処理
  const handleSlotClick = (role: LfgRole, slotIndex: number) => {
    setPickerState({
      isOpen: true,
      role,
      slotIndex,
    });
  };

  // ピッカーを閉じる
  const handleClosePicker = () => {
    setPickerState({
      isOpen: false,
      role: null,
      slotIndex: 0,
    });
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">得意ポケモン</h3>
      </div>

      {/* 選択されたロールがない場合の案内 */}
      {selectedRoles.length === 0 && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center">
            <svg
              className="w-5 h-5 text-yellow-500 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <span className="text-sm text-yellow-800">
              まず希望ロールを選択してください
            </span>
          </div>
        </div>
      )}

      {/* 5×5グリッド表示（各行：ラベル + 4つのポケモンスロット） */}
      {selectedRoles.length > 0 && (
        <div className="space-y-2 max-[500px]:space-y-1">
          {[
            LFG_ROLES.TOP_LANE,
            LFG_ROLES.SUPPORT,
            LFG_ROLES.MIDDLE,
            LFG_ROLES.BOTTOM_LANE,
            LFG_ROLES.TANK,
          ]
            .filter((role) => selectedRoles.includes(role))
            .map((role) => {
              const label = LFG_ROLE_LABELS[role];
              const roleSlots = pokemonSlots[role];

              return (
                <div
                  key={role}
                  className="grid grid-cols-5 gap-2 max-[500px]:gap-0"
                >
                  {/* ロールラベル（1列目） */}
                  <div
                    className={`
                    ${getRoleColor(role)} 
                    flex flex-col items-center justify-center rounded text-center text-xs max-[500px]:text-[10px] font-medium
                    aspect-square
                  `}
                  >
                    <img
                      src={getRoleIcon(role)}
                      alt={`${label}アイコン`}
                      className="w-6 h-6 max-[500px]:w-4 max-[500px]:h-4 object-contain mb-1"
                    />
                    <span className="leading-tight">{label}</span>
                  </div>

                  {/* ポケモンスロット（2-5列目） */}
                  {Array.from({ length: 4 }, (_, slotIndex) => {
                    const pokemon = roleSlots[slotIndex];

                    return (
                      <div
                        key={`${role}-${slotIndex}`}
                        onClick={() => handleSlotClick(role, slotIndex)}
                        className="
                        w-full aspect-square border-2 border-dashed border-gray-300 
                        rounded-lg hover:border-gray-400 transition-colors
                        bg-gray-50 hover:bg-gray-100 relative group cursor-pointer
                      "
                        title={
                          pokemon
                            ? `${pokemon.name || "Unknown"}を変更`
                            : "ポケモンを追加"
                        }
                      >
                        {pokemon ? (
                          // ポケモンが設定されている場合
                          <div className="w-full h-full relative border-2 border-gray-400 rounded-lg bg-white overflow-hidden">
                            {/* ×ボタン */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemovePokemon(role, slotIndex);
                              }}
                              className="absolute top-1 right-1 w-5 h-5 max-[500px]:w-4 max-[500px]:h-4 max-[500px]:top-0.5 max-[500px]:right-0.5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-md z-10"
                              title={`${pokemon.name || "Unknown"}を削除`}
                            >
                              <svg
                                className="w-3 h-3 max-[500px]:w-2 max-[500px]:h-2"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>

                            {/* ポケモンアイコン */}
                            {pokemon.iconUrl ? (
                              <img
                                src={pokemon.iconUrl}
                                alt={pokemon.name || "Unknown"}
                                className="absolute inset-0 w-full h-full object-contain"
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xs text-center px-1">
                                  {pokemon.name || "Unknown"}
                                </span>
                              </div>
                            )}

                            {/* 名前ラベル */}
                            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-80 text-white px-1 py-1 max-[500px]:px-0.5 max-[500px]:py-0.5">
                              <div className="text-center">
                                <span
                                  className={`block leading-none ${
                                    (pokemon.name?.length || 0) <= 4
                                      ? "text-[10px] max-[500px]:text-[8px]"
                                      : (pokemon.name?.length || 0) <= 6
                                        ? "text-[9px] max-[500px]:text-[7px]"
                                        : (pokemon.name?.length || 0) <= 8
                                          ? "text-[8px] max-[500px]:text-[6px]"
                                          : "text-[7px] max-[500px]:text-[5px]"
                                  }`}
                                >
                                  {pokemon.name || "Unknown"}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          // 空のスロット
                          <div className="w-full h-full flex items-center justify-center">
                            <svg
                              className="w-4 h-4 text-gray-400 group-hover:text-gray-600"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
        </div>
      )}

      {/* ポケモンピッカーポップアップ */}
      {pickerState.isOpen && pickerState.role && (
        <PokemonPickerPopup
          isOpen={pickerState.isOpen}
          onClose={handleClosePicker}
          selectedRole={pickerState.role}
          slotIndex={pickerState.slotIndex}
          onSelectPokemon={handleSelectPokemon}
          currentRoleSlots={pokemonSlots[pickerState.role]}
        />
      )}
    </div>
  );
};

export default FavPokemonButton;
