/**
 * ポケモンプールモーダルコンポーネント
 * 画面上部にロールタブ（選択ロールのみアクティブ表示）
 * 各ロールごとにPokemonSlotRowを1行（4枠まで）
 */

import React, { useState } from "react";
import { LFG_ROLE_LABELS, LFG_ROLES } from "../types/lfg";
import type { PokemonPoolProps, LfgRole, PokemonSlot } from "../types/lfg";
import PokemonPickerPopup from "./PokemonPickerPopup";

const PokemonPoolModal: React.FC<PokemonPoolProps> = ({
  isOpen,
  onClose,
  selectedRoles,
  pokemonSlots,
  onUpdatePokemonSlots,
}) => {
  const [activeRole, setActiveRole] = useState<LfgRole | null>(
    selectedRoles.length > 0 ? selectedRoles[0] : null,
  );
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
  const getRoleColor = (role: LfgRole, isActive: boolean) => {
    const baseColors = {
      [LFG_ROLES.TOP_LANE]: isActive
        ? "bg-purple-400 text-white shadow-sm"
        : "text-purple-500 hover:text-purple-600",
      [LFG_ROLES.SUPPORT]: isActive
        ? "bg-yellow-400 text-white shadow-sm"
        : "text-yellow-500 hover:text-yellow-600",
      [LFG_ROLES.MIDDLE]: isActive
        ? "bg-cyan-400 text-white shadow-sm"
        : "text-cyan-500 hover:text-cyan-600",
      [LFG_ROLES.BOTTOM_LANE]: isActive
        ? "bg-red-400 text-white shadow-sm"
        : "text-red-500 hover:text-red-600",
      [LFG_ROLES.TANK]: isActive
        ? "bg-green-400 text-white shadow-sm"
        : "text-green-500 hover:text-green-600",
    };
    return baseColors[role];
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

  // ポケモンスロットの追加
  const handleAddPokemon = (role: LfgRole, slotIndex: number) => {
    setPickerState({
      isOpen: true,
      role,
      slotIndex,
    });
  };

  // ポケモンスロットからの削除
  const handleRemovePokemon = (role: LfgRole, slotIndex: number) => {
    const newSlots = { ...pokemonSlots };
    newSlots[role] = newSlots[role].filter((_, index) => index !== slotIndex);
    onUpdatePokemonSlots(newSlots);
  };

  // ポケモン選択完了
  const handleSelectPokemon = (
    role: LfgRole,
    slotIndex: number,
    pokemon: PokemonSlot,
  ) => {
    const newSlots = { ...pokemonSlots };
    const roleSlots = [...newSlots[role]];

    // スロットが既に埋まっている場合は置き換え、空いている場合は追加
    if (slotIndex < roleSlots.length) {
      roleSlots[slotIndex] = pokemon;
    } else {
      roleSlots.push(pokemon);
    }

    newSlots[role] = roleSlots;
    onUpdatePokemonSlots(newSlots);
  };

  // ピッカーを閉じる
  const handleClosePicker = () => {
    setPickerState({
      isOpen: false,
      role: null,
      slotIndex: 0,
    });
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          {/* ヘッダー */}
          <div className="flex justify-between items-center p-6 border-b">
            <h2 className="text-xl font-bold text-gray-800">
              得意ポケモン設定
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl p-1"
              aria-label="モーダルを閉じる"
            >
              ×
            </button>
          </div>

          <div className="p-6">
            {/* ロールタブ */}
            <div className="mb-6">
              <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
                {selectedRoles.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setActiveRole(role)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                      activeRole === role
                        ? getRoleColor(role, true)
                        : getRoleColor(role, false)
                    }`}
                  >
                    <img
                      src={getRoleIcon(role)}
                      alt={`${LFG_ROLE_LABELS[role]}アイコン`}
                      className="w-5 h-5 object-contain"
                    />
                    <span>{LFG_ROLE_LABELS[role]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* アクティブロールのポケモンスロット */}
            {activeRole && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <img
                      src={getRoleIcon(activeRole)}
                      alt={`${LFG_ROLE_LABELS[activeRole]}アイコン`}
                      className="w-6 h-6 object-contain"
                    />
                    <h3 className="text-lg font-semibold text-gray-800">
                      {LFG_ROLE_LABELS[activeRole]}のポケモン
                    </h3>
                  </div>
                  <span className="text-sm text-gray-500">
                    {pokemonSlots[activeRole].length}/4体設定済み
                  </span>
                </div>

                {/* ポケモンスロット行 */}
                <div className="grid grid-cols-4 gap-4">
                  {Array.from({ length: 4 }, (_, index) => {
                    const pokemon = pokemonSlots[activeRole][index];
                    const isEmpty = !pokemon;

                    return (
                      <div
                        key={index}
                        className="relative aspect-square border-2 border-dashed border-gray-300 rounded-lg"
                      >
                        {isEmpty ? (
                          // 空のスロット
                          <button
                            type="button"
                            onClick={() => handleAddPokemon(activeRole, index)}
                            className="
                              w-full h-full flex items-center justify-center
                              hover:bg-gray-50 hover:border-gray-400
                              transition-all duration-200 rounded-lg
                              group
                            "
                            aria-label={`${index + 1}番目のスロットにポケモンを追加`}
                          >
                            <svg
                              className="w-8 h-8 text-gray-400 group-hover:text-gray-600"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                              />
                            </svg>
                          </button>
                        ) : (
                          // ポケモンが設定されているスロット
                          <div className="relative w-full h-full bg-white border-2 border-gray-300 rounded-lg group">
                            <button
                              type="button"
                              onClick={() =>
                                handleAddPokemon(activeRole, index)
                              }
                              className="w-full h-full flex items-center justify-center hover:bg-gray-50 transition-colors rounded-lg"
                              title={`${pokemon.name}を変更`}
                              aria-label={`${pokemon.name}を変更`}
                            >
                              {pokemon.iconUrl ? (
                                <div className="relative w-full h-full">
                                  <img
                                    src={pokemon.iconUrl}
                                    alt={pokemon.name}
                                    className="absolute inset-0 w-full h-full object-contain p-2"
                                  />
                                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs px-1 py-0.5 rounded-b-lg">
                                    <span className="text-center truncate block leading-tight">
                                      {pokemon.name}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center h-full">
                                  <span className="text-sm text-center">
                                    {pokemon.name}
                                  </span>
                                </div>
                              )}
                            </button>

                            {/* 削除ボタン */}
                            <button
                              type="button"
                              onClick={() =>
                                handleRemovePokemon(activeRole, index)
                              }
                              className="
                                absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full
                                flex items-center justify-center hover:bg-red-600
                                transition-colors shadow-md opacity-0 group-hover:opacity-100
                              "
                              aria-label={`${pokemon.name}を削除`}
                            >
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 使用方法の説明 */}
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start">
                    <svg
                      className="w-5 h-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">使用方法:</p>
                      <ul className="space-y-1 text-blue-700">
                        <li>
                          • 空のスロット（＋マーク）をクリックしてポケモンを追加
                        </li>
                        <li>
                          • 設定済みのポケモンをクリックして別のポケモンに変更
                        </li>
                        <li>• 右上の×ボタンでポケモンを削除</li>
                        <li>• 各ロールで最大4体まで設定可能</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* フッター */}
          <div className="flex justify-end space-x-3 p-6 border-t bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              完了
            </button>
          </div>
        </div>
      </div>

      {/* ポケモンピッカーポップアップ */}
      {pickerState.isOpen && pickerState.role && (
        <PokemonPickerPopup
          isOpen={pickerState.isOpen}
          onClose={handleClosePicker}
          selectedRole={pickerState.role}
          slotIndex={pickerState.slotIndex}
          onSelectPokemon={handleSelectPokemon}
        />
      )}
    </>
  );
};

export default PokemonPoolModal;
