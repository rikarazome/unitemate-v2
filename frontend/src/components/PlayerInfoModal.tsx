import React from "react";
import NamePlate from "./NamePlate";
import type { MatchPlayer } from "./MatchScreen";
import type { LfgRole, PokemonSlot, RolePokemonSlots } from "../types/lfg";
import { getPokemonById } from "../data/pokemon";
import { LFG_ROLES, LFG_ROLE_LABELS } from "../types/lfg";

interface PlayerInfoModalProps {
  player: MatchPlayer;
  isOpen: boolean;
  onClose: () => void;
}

const PlayerInfoModal: React.FC<PlayerInfoModalProps> = ({
  player,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  // プレイヤーの実際のデータを使用
  const bio = player.bio || "";
  const playerRoles = (player.preferred_roles || []) as LfgRole[];
  const playerPokemon = player.favorite_pokemon || [];

  // 現在の試合での割り当てロール
  const currentMatchRole = player.role;

  // プレイヤーのポケモンスロットを復元
  const restorePokemonSlots = (): RolePokemonSlots => {
    const slots: RolePokemonSlots = {
      [LFG_ROLES.TOP_LANE]: [],
      [LFG_ROLES.SUPPORT]: [],
      [LFG_ROLES.MIDDLE]: [],
      [LFG_ROLES.BOTTOM_LANE]: [],
      [LFG_ROLES.TANK]: [],
    };

    // プレイヤーのポケモンデータを各レーンに配置
    if (playerPokemon.length > 0) {
      playerPokemon.forEach((pokemonId, index) => {
        const formattedPokemon = getPokemonById(pokemonId);
        if (formattedPokemon) {
          const pokemonSlot: PokemonSlot = {
            id: formattedPokemon.pokemon_id,
            name: formattedPokemon.name_ja,
            type: formattedPokemon.type,
            iconUrl: formattedPokemon.icon_url,
          };

          // 選択されたロールがある場合はそのロールに配置、なければ順番に配置
          if (playerRoles.length > 0) {
            const roleIndex = index % playerRoles.length;
            const role = playerRoles[roleIndex];
            if (slots[role] && slots[role].length < 4) {
              slots[role].push(pokemonSlot);
            }
          } else {
            // ロールが選択されていない場合は全ロールに順番に配置
            const roles = Object.keys(slots) as LfgRole[];
            const roleIndex = index % roles.length;
            const role = roles[roleIndex];
            if (slots[role].length < 4) {
              slots[role].push(pokemonSlot);
            }
          }
        }
      });
    }

    return slots;
  };

  const pokemonSlots = restorePokemonSlots();
  const selectedRoles = playerRoles.length > 0 ? playerRoles : [];

  // 現在の試合ロールを表示用にLfgRole形式に変換
  const getCurrentMatchRoleAsLfg = (): LfgRole | null => {
    if (!currentMatchRole) return null;

    const roleMapping: { [key: string]: LfgRole } = {
      TOP: LFG_ROLES.TOP_LANE,
      MID: LFG_ROLES.MIDDLE,
      BOTTOM: LFG_ROLES.BOTTOM_LANE,
      SUPPORT: LFG_ROLES.SUPPORT,
      TANK: LFG_ROLES.TANK,
    };

    return roleMapping[currentMatchRole.toUpperCase()] || null;
  };

  const currentMatchLfgRole = getCurrentMatchRoleAsLfg();
  const displayRoles = currentMatchLfgRole ? [currentMatchLfgRole] : [];

  // ロール別の色定義（新しいカラースキーム）
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

  // ロール別のアイコン取得
  const getRoleIcon = (role: LfgRole) => {
    const icons = {
      [LFG_ROLES.TOP_LANE]: "/role_icons/role_top.png",
      [LFG_ROLES.SUPPORT]: "/role_icons/role_support.png",
      [LFG_ROLES.MIDDLE]: "/role_icons/role_mid.png",
      [LFG_ROLES.BOTTOM_LANE]: "/role_icons/role_bottom.png",
      [LFG_ROLES.TANK]: "/role_icons/role_tank.png",
    };
    return icons[role];
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">
            プレイヤー情報
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            ×
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-4 space-y-4">
          {/* ネームプレート */}
          <div className="flex justify-center">
            <NamePlate
              trainerName={player.trainer_name}
              discordUsername={player.discord_username}
              twitterId={player.twitter_id}
              rate={player.rate}
              maxRate={player.max_rate}
              avatarUrl={player.discord_avatar_url}
              primaryBadgeId={player.current_badge}
              secondaryBadgeId={player.current_badge_2}
              width={280}
            />
          </div>

          {/* 選択レーン */}
          <div className="bg-gray-50 rounded-lg p-3">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              選択レーン
            </h3>
            <div className="flex flex-wrap gap-2">
              {displayRoles.length > 0 ? (
                displayRoles.map((role) => (
                  <span
                    key={role}
                    className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 ${getRoleColor(role)}`}
                  >
                    <img
                      src={getRoleIcon(role)}
                      alt={LFG_ROLE_LABELS[role]}
                      className="w-3 h-3"
                    />
                    {LFG_ROLE_LABELS[role]}
                  </span>
                ))
              ) : (
                <span className="text-sm text-gray-500">
                  ロールが設定されていません
                </span>
              )}
            </div>
          </div>

          {/* キャラプール */}
          <div className="bg-gray-50 rounded-lg p-3">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              キャラプール
            </h3>

            {/* 5×5グリッド（選択したレーンの行のみ表示） */}
            <div className="space-y-2 max-[500px]:space-y-1">
              {selectedRoles.map((role) => {
                const roleSlots = pokemonSlots[role] || [];
                return (
                  <div
                    key={role}
                    className="grid grid-cols-5 gap-2 max-[500px]:gap-0"
                  >
                    {/* ロールラベル（1列目） */}
                    <div
                      className={`${getRoleColor(role)} flex flex-col items-center justify-center rounded text-center text-xs max-[500px]:text-[10px] font-medium aspect-square`}
                    >
                      <img
                        src={getRoleIcon(role)}
                        alt={LFG_ROLE_LABELS[role]}
                        className="w-4 h-4 max-[500px]:w-3 max-[500px]:h-3 mb-0.5"
                      />
                      <span className="text-[10px] max-[500px]:text-[8px] leading-none">
                        {LFG_ROLE_LABELS[role]}
                      </span>
                    </div>

                    {/* ポケモンスロット（2-5列目） */}
                    {Array.from({ length: 4 }, (_, slotIndex) => {
                      const pokemon = roleSlots[slotIndex];
                      return (
                        <div key={slotIndex} className="aspect-square">
                          {pokemon ? (
                            <div className="w-full h-full relative border-2 border-gray-400 rounded-lg bg-white overflow-hidden">
                              {/* ポケモンアイコン */}
                              {pokemon.iconUrl ? (
                                <img
                                  src={pokemon.iconUrl}
                                  alt={pokemon.name}
                                  className="absolute inset-0 w-full h-full object-contain"
                                />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-xs text-center px-1">
                                    {pokemon.name}
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
                                    {pokemon.name}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="w-full h-full border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 flex items-center justify-center">
                              <span className="text-gray-400 text-xs max-[500px]:text-[10px]">
                                未設定
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 一言 */}
          {bio && (
            <div className="bg-gray-50 rounded-lg p-3">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">一言</h3>
              <p className="text-sm text-gray-600">{bio}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayerInfoModal;
