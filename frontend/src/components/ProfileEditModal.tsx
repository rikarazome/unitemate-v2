import React, { useState, useEffect, useCallback } from "react";
import { useUpdateProfile, type UserInfo } from "../hooks/useUnitemateApi";
import { useProfileStore } from "../hooks/useProfileStore";
import { useAuth0 } from "@auth0/auth0-react";
import { useDummyAuth } from "../hooks/useDummyAuth";
import { getPokemonById } from "../data/pokemon";
import RoleSelector from "./RoleSelector";
import FavPokemonButton from "./FavPokemonButton";
import PokemonPoolModal from "./PokemonPoolModal";
import BadgeSelectButton from "./BadgeSelectButton";
import ProfileBadgeSelectionModal from "./ProfileBadgeSelectionModal";
import NamePlate from "./NamePlate";
import type { UpdateProfileRequest } from "../types/common";
import { LFG_ROLES } from "../types/lfg";
import type { LfgRole, RolePokemonSlots, PokemonSlot } from "../types/lfg";

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserInfo | null;
  onSuccess: () => void;
}

const ProfileEditModal: React.FC<ProfileEditModalProps> = ({
  isOpen,
  onClose,
  user,
  onSuccess,
}) => {
  const { user: auth0User } = useAuth0();
  const dummyAuth = useDummyAuth();
  const { updateProfile, loading: updateLoading } = useUpdateProfile();
  const { updateStaticData, updateEquippedBadges } = useProfileStore();

  const [formData, setFormData] = useState<UpdateProfileRequest>({
    trainer_name: user?.trainer_name || "",
    twitter_id: user?.twitter_id || "",
    preferred_roles: user?.preferred_roles || [],
    favorite_pokemon: user?.favorite_pokemon || [],
    current_badge: user?.current_badge || "",
    current_badge_2: user?.current_badge_2 || "",
    bio: user?.bio || "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // LFG用の状態管理
  const [selectedRoles, setSelectedRoles] = useState<LfgRole[]>([]);
  const [pokemonSlots, setPokemonSlots] = useState<RolePokemonSlots>({
    [LFG_ROLES.TOP_LANE]: [],
    [LFG_ROLES.SUPPORT]: [],
    [LFG_ROLES.MIDDLE]: [],
    [LFG_ROLES.BOTTOM_LANE]: [],
    [LFG_ROLES.TANK]: [],
  });
  const [isPokemonModalOpen, setIsPokemonModalOpen] = useState(false);

  // 勲章選択モーダルの状態
  const [isBadge1ModalOpen, setIsBadge1ModalOpen] = useState(false);
  const [isBadge2ModalOpen, setIsBadge2ModalOpen] = useState(false);


  // ユーザー情報からポケモンスロットを復元する関数
  const restorePokemonSlotsFromUser = (
    userInfo: UserInfo,
  ): { roles: LfgRole[]; slots: RolePokemonSlots } => {
    const roles = (userInfo.preferred_roles || []) as LfgRole[];
    const favoritePokemons = userInfo.favorite_pokemon || [];

    // 初期化
    const slots: RolePokemonSlots = {
      [LFG_ROLES.TOP_LANE]: [],
      [LFG_ROLES.SUPPORT]: [],
      [LFG_ROLES.MIDDLE]: [],
      [LFG_ROLES.BOTTOM_LANE]: [],
      [LFG_ROLES.TANK]: [],
    };

    // favorite_pokemonからポケモンオブジェクトを復元
    const pokemons: PokemonSlot[] = favoritePokemons
      .map((pokemonId) => {
        const formattedPokemon = getPokemonById(pokemonId);
        if (!formattedPokemon) return undefined;

        // FormattedPokemonをPokemon（PokemonSlot）型に変換
        return {
          id: formattedPokemon.pokemon_id,
          name: formattedPokemon.name_ja,
          type: formattedPokemon.type,
          iconUrl: formattedPokemon.icon_url,
        };
      })
      .filter((pokemon): pokemon is PokemonSlot => pokemon !== undefined);

    // ロールごとにポケモンを配置
    // 選択されたロールが複数ある場合は、ポケモンを順番に配置
    if (roles.length > 0 && pokemons.length > 0) {
      const pokemonsPerRole = Math.ceil(pokemons.length / roles.length);

      roles.forEach((role, roleIndex) => {
        const startIndex = roleIndex * pokemonsPerRole;
        const endIndex = Math.min(
          startIndex + pokemonsPerRole,
          pokemons.length,
        );
        slots[role] = pokemons.slice(startIndex, endIndex);
      });
    }

    return { roles, slots };
  };

  useEffect(() => {
    if (isOpen && user) {
      setFormData({
        trainer_name: user.trainer_name || "",
        twitter_id: user.twitter_id || "",
        preferred_roles: user.preferred_roles || [],
        favorite_pokemon: user.favorite_pokemon || [],
        current_badge: user.current_badge || "",
        current_badge_2: user.current_badge_2 || "",
        bio: user.bio || "",
      });

      // ユーザー情報から選択状態を復元
      const { roles, slots } = restorePokemonSlotsFromUser(user);
      setSelectedRoles(roles);
      setPokemonSlots(slots);

      setErrors({});
    }
  }, [isOpen, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // バリデーション
    const newErrors: Record<string, string> = {};
    if (!formData.trainer_name?.trim()) {
      newErrors.trainer_name = "トレーナー名は必須です";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      console.log(
        "ProfileEditModal - Updating profile with formData:",
        formData,
      );
      console.log("ProfileEditModal - Selected roles:", selectedRoles);
      console.log("ProfileEditModal - Pokemon slots:", pokemonSlots);

      // 楽観的更新: サーバーリクエスト前にUIを即座に更新
      updateStaticData({
        trainer_name: formData.trainer_name,
        twitter_id: formData.twitter_id || null,
        preferred_roles: formData.preferred_roles,
        favorite_pokemon: formData.favorite_pokemon,
        bio: formData.bio || null,
      });

      // 装備勲章も更新
      updateEquippedBadges(formData.current_badge, formData.current_badge_2);

      console.log("ProfileEditModal - Applied optimistic update");

      // サーバーに実際の更新リクエストを送信
      await updateProfile(formData);
      console.log("ProfileEditModal - Server update successful");

      onSuccess();
      onClose();
    } catch (error) {
      console.error("ProfileEditModal - Profile update failed:", error);

      // TODO: 楽観的更新の巻き戻し処理を追加
      // 現在は単純にページリフレッシュでサーバー状態を復元
      alert("プロフィールの更新に失敗しました。ページを再読み込みしてください。");
    }
  };

  // LFG状態からformDataへの変換処理
  const updateFormDataFromLfgState = useCallback(() => {
    // 選択されたロールをpreferred_rolesに変換
    setFormData((prev) => ({
      ...prev,
      preferred_roles: selectedRoles,
      // ポケモンスロットから全ポケモンIDを取得してfavorite_pokemonに設定
      favorite_pokemon: selectedRoles
        .flatMap((role) =>
          (pokemonSlots[role] || []).map((pokemon) => pokemon.id),
        )
        .slice(0, 3), // 最大3体まで
    }));
  }, [selectedRoles, pokemonSlots]);

  // LFG状態が変更されたらformDataも更新（初期復元時は除く）
  useEffect(() => {
    // モーダルが開いている時のみ更新
    if (isOpen) {
      updateFormDataFromLfgState();
    }
  }, [selectedRoles, pokemonSlots, isOpen, updateFormDataFromLfgState]);

  if (!isOpen) return null;

  // ユーザーデータが存在しない場合の表示
  if (!user) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">
                プロフィール編集
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">
                ユーザー情報が見つかりません。
              </p>
              <p className="text-sm text-gray-400 mb-6">
                新しいユーザーとして登録するか、再度ログインをお試しください。
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors mr-3"
              >
                ページを再読み込み
              </button>
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 max-[500px]:p-0">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto max-[500px]:rounded-none max-[500px]:max-h-full max-[500px]:h-full">
        <div className="p-6 max-[500px]:px-4 max-[500px]:py-3">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl max-[500px]:text-lg font-bold text-gray-800">
              プロフィール編集
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl max-[500px]:text-xl"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* トレーナー名 */}
            <div>
              <label className="block text-sm max-[500px]:text-xs font-medium text-gray-700 mb-2">
                トレーナー名 *
              </label>
              <input
                type="text"
                value={formData.trainer_name || ""}
                onChange={(e) =>
                  setFormData({ ...formData, trainer_name: e.target.value })
                }
                className={`w-full px-3 py-2 max-[500px]:px-2 max-[500px]:py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 max-[500px]:text-sm ${
                  errors.trainer_name ? "border-red-500" : "border-gray-300"
                }`}
                placeholder="トレーナー名を入力してください"
              />
              {errors.trainer_name && (
                <p className="text-red-500 text-sm max-[500px]:text-xs mt-1">
                  {errors.trainer_name}
                </p>
              )}
            </div>

            {/* Twitter ID */}
            <div>
              <label className="block text-sm max-[500px]:text-xs font-medium text-gray-700 mb-2">
                Twitter ID
              </label>
              <div className="flex items-center">
                <span className="text-gray-500 mr-2">@</span>
                <input
                  type="text"
                  value={formData.twitter_id || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      twitter_id: e.target.value.trim(),
                    })
                  }
                  className="flex-1 px-3 py-2 max-[500px]:px-2 max-[500px]:py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 max-[500px]:text-sm"
                  placeholder="twitter_username"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                ※ Twitter
                IDの公開に関する外部トラブルについては一切の責任を負いかねますのでご了承ください。
              </p>
            </div>

            {/* 希望ロール */}
            <RoleSelector
              selectedRoles={selectedRoles}
              onRoleChange={setSelectedRoles}
              className="mb-6"
            />

            {/* 得意ポケモン */}
            <FavPokemonButton
              selectedRoles={selectedRoles}
              pokemonSlots={pokemonSlots}
              onOpenModal={() => setIsPokemonModalOpen(true)}
              onUpdatePokemonSlots={setPokemonSlots}
              className="mb-6"
            />

            {/* 勲章設定 */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                勲章設定
              </h3>

              {/* ネームプレートプレビュー */}
              <div className="flex justify-center mb-4">
                <NamePlate
                  trainerName={
                    user?.trainer_name ||
                    dummyAuth.user?.trainer_name ||
                    "トレーナー名未設定"
                  }
                  discordUsername={
                    dummyAuth.user?.discord_username || auth0User?.nickname
                  }
                  twitterId={user?.twitter_id || undefined}
                  rate={user?.rate || dummyAuth.user?.rate || 1500}
                  maxRate={user?.max_rate || 1500}
                  avatarUrl={auth0User?.picture}
                  primaryBadgeId={formData.current_badge}
                  secondaryBadgeId={formData.current_badge_2}
                  className="mb-2"
                />
              </div>

              {/* ボタンを左右に配置 */}
              <div className="grid grid-cols-2 gap-4">
                {/* 1つ目の勲章（左） */}
                <div className="space-y-2">
                  <label className="block text-xs text-gray-600">
                    1つ目の勲章
                  </label>
                  <div
                    onClick={() => setIsBadge1ModalOpen(true)}
                    className="cursor-pointer"
                  >
                    <BadgeSelectButton
                      value={formData.current_badge}
                      onChange={(value) =>
                        setFormData({ ...formData, current_badge: value })
                      }
                      excludeBadgeId={formData.current_badge_2 || undefined}
                      ownedBadgeIds={user?.owned_badges || []}
                      placeholder="勲章を選択"
                    />
                  </div>
                </div>

                {/* 2つ目の勲章（右） */}
                <div className="space-y-2">
                  <label className="block text-xs text-gray-600">
                    2つ目の勲章
                  </label>
                  <div
                    onClick={() => setIsBadge2ModalOpen(true)}
                    className="cursor-pointer"
                  >
                    <BadgeSelectButton
                      value={formData.current_badge_2}
                      onChange={(value) =>
                        setFormData({ ...formData, current_badge_2: value })
                      }
                      excludeBadgeId={formData.current_badge || undefined}
                      ownedBadgeIds={user?.owned_badges || []}
                      placeholder="勲章を選択"
                    />
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-3 text-center">
                ※画像付き勲章の場合は背景画像が優先されます
              </p>
            </div>

            {/* 一言 */}
            <div>
              <label className="block text-sm max-[500px]:text-xs font-medium text-gray-700 mb-2">
                一言
              </label>
              <textarea
                value={formData.bio || ""}
                onChange={(e) =>
                  setFormData({ ...formData, bio: e.target.value })
                }
                className="w-full px-3 py-2 max-[500px]:px-2 max-[500px]:py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 max-[500px]:text-sm"
                rows={3}
                maxLength={200}
                placeholder="自己紹介や意気込みなど..."
              />
              <p className="text-xs max-[500px]:text-[10px] text-gray-500 mt-1">
                {(formData.bio || "").length}/200
              </p>
            </div>

            {/* ボタン */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 max-[500px]:px-3 max-[500px]:py-1.5 max-[500px]:text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={updateLoading}
                className="px-4 py-2 max-[500px]:px-3 max-[500px]:py-1.5 max-[500px]:text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {updateLoading ? "保存中..." : "保存"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ポケモンプールモーダル */}
      <PokemonPoolModal
        isOpen={isPokemonModalOpen}
        onClose={() => setIsPokemonModalOpen(false)}
        selectedRoles={selectedRoles}
        pokemonSlots={pokemonSlots}
        onUpdatePokemonSlots={setPokemonSlots}
      />

        {/* 1つ目の勲章選択モーダル */}
        <ProfileBadgeSelectionModal
          isOpen={isBadge1ModalOpen}
          onClose={() => setIsBadge1ModalOpen(false)}
          currentBadgeId={formData.current_badge}
          excludeBadgeId={formData.current_badge_2 || undefined}
          ownedBadgeIds={user?.owned_badges || []}
          onSelect={(badgeId) => {
            setFormData({ ...formData, current_badge: badgeId });
            setIsBadge1ModalOpen(false);
          }}
          title="1つ目の勲章を選択"
        />

        {/* 2つ目の勲章選択モーダル */}
        <ProfileBadgeSelectionModal
          isOpen={isBadge2ModalOpen}
          onClose={() => setIsBadge2ModalOpen(false)}
          currentBadgeId={formData.current_badge_2}
          excludeBadgeId={formData.current_badge || undefined}
          ownedBadgeIds={user?.owned_badges || []}
          onSelect={(badgeId) => {
            setFormData({ ...formData, current_badge_2: badgeId });
            setIsBadge2ModalOpen(false);
          }}
          title="2つ目の勲章を選択"
        />

    </div>
  );
};

export default ProfileEditModal;
