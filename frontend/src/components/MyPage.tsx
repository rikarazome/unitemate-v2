import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import Layout from "./Layout";
import { useUser } from "../hooks/useUser";
import { useApi } from "../hooks/useApi";
import {
  PreferredRole,
  type PreferredRole as PreferredRoleType,
  type UpdateUserFormData,
  type UpdateUserRequest,
  type User,
} from "../types/user";
import pokemons from "../data/pokemons.json";
import PokemonSelector from "./PokemonSelector";
import {
  formatTwitterId,
  hasValidationErrors,
  validateBio,
  validatePreferredRoles,
  validateTrainerName,
  validateTwitterId,
} from "../utils/validation";

const ROLE_LABELS: Record<PreferredRoleType, string> = {
  [PreferredRole.TOP_LANE]: "上レーン",
  [PreferredRole.SUPPORT]: "サポート",
  [PreferredRole.MIDDLE]: "中央",
  [PreferredRole.BOTTOM_LANE]: "下レーン",
  [PreferredRole.TANK]: "タンク",
};

export default function MyPage() {
  const { isAuthenticated, isLoading: authLoading, logout } = useAuth0();
  const { userData, loading, error, shouldShowUserCreation, refetch } =
    useUser();
  const { callApi } = useApi();

  const [formData, setFormData] = useState<UpdateUserFormData>({
    trainer_name: "",
    twitter_id: "",
    preferred_roles: [],
    bio: "",
    favorite_pokemon: [],
  });
  const [isDirty, setIsDirty] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [validErrors, setValidErrors] = useState<{
    trainer_name?: string;
    twitter_id?: string;
    preferred_roles?: string;
    bio?: string;
    favorite_pokemon?: string;
  }>({});
  const [showPokemonSelector, setShowPokemonSelector] = useState(false);

  // Initialize form when userData loads
  useEffect(() => {
    if (userData) {
      setFormData({
        trainer_name: userData.trainer_name || "",
        twitter_id: userData.twitter_id || "",
        preferred_roles: (userData.preferred_roles || []) as PreferredRoleType[],
        bio: userData.bio || "",
        favorite_pokemon: userData.favorite_pokemon || [],
      });
      setIsDirty(false);
      setSubmitError(null);
      setSubmitSuccess(null);
      setValidErrors({});
    }
  }, [userData]);

  const computedWinRate = useMemo(() => {
    if (!userData || userData.match_count === 0) return 0;
    return Math.round((userData.win_count / userData.match_count) * 1000) / 10; // 0.1%単位
  }, [userData]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Redirects
  if (!isAuthenticated && !authLoading) return <Navigate to="/" replace />;
  if (shouldShowUserCreation) return <Navigate to="/create-user" replace />;

  const onChange = (field: keyof UpdateUserFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    if (validErrors[field]) {
      setValidErrors((e) => ({ ...e, [field]: undefined }));
    }
  };

  const onTwitterChange = (value: string) =>
    onChange("twitter_id", formatTwitterId(value));

  const onRoleToggle = (role: PreferredRoleType, checked: boolean) => {
    setFormData((prev) => {
      const next = checked
        ? [...prev.preferred_roles, role]
        : prev.preferred_roles.filter((r) => r !== role);
      return { ...prev, preferred_roles: next };
    });
    setIsDirty(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    if (validErrors.preferred_roles)
      setValidErrors((e) => ({ ...e, preferred_roles: undefined }));
  };

  const onFavPokemonSave = (ids: string[]) => {
    setFormData((prev) => ({ ...prev, favorite_pokemon: ids }));
    setIsDirty(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    if (validErrors.favorite_pokemon)
      setValidErrors((e) => ({ ...e, favorite_pokemon: undefined }));
    setShowPokemonSelector(false);
  };

  const validateAll = (): boolean => {
    const errs: typeof validErrors = {};
    const tn = validateTrainerName(formData.trainer_name);
    if (tn) errs.trainer_name = tn;
    const tw = validateTwitterId(formData.twitter_id);
    if (tw) errs.twitter_id = tw;
    const pr = validatePreferredRoles(formData.preferred_roles);
    if (pr) errs.preferred_roles = pr;
    const bio = validateBio(formData.bio);
    if (bio) errs.bio = bio;
    // Favorite pokemon: optional; enforce up to 5 unique
    if (formData.favorite_pokemon && formData.favorite_pokemon.length > 5) {
      errs.favorite_pokemon = "得意なポケモンは最大5つまで選択できます。";
    } else if (
      formData.favorite_pokemon &&
      new Set(formData.favorite_pokemon).size !==
        formData.favorite_pokemon.length
    ) {
      errs.favorite_pokemon = "得意なポケモンに重複があります。";
    }
    setValidErrors(errs);
    return !hasValidationErrors(errs);
  };

  const buildPayload = (): UpdateUserRequest => {
    // Send only changed fields; also map empty strings to null for nullable fields
    const payload: UpdateUserRequest = {};
    if (userData) {
      if (formData.trainer_name !== userData.trainer_name)
        payload.trainer_name = formData.trainer_name;

      if ((formData.twitter_id || null) !== (userData.twitter_id || null))
        payload.twitter_id = formData.twitter_id ? formData.twitter_id : null;

      const rolesA = formData.preferred_roles || [];
      const rolesB = userData.preferred_roles || [];
      const equalRoles =
        rolesA.length === rolesB.length &&
        rolesA.every((r) => rolesB.includes(r));
      if (!equalRoles) payload.preferred_roles = rolesA;

      if ((formData.bio || null) !== (userData.bio || null))
        payload.bio = formData.bio ? formData.bio : null;

      const favA = formData.favorite_pokemon || [];
      const favB = userData.favorite_pokemon || [];
      const equalFav =
        favA.length === favB.length && favA.every((id) => favB.includes(id));
      if (!equalFav) payload.favorite_pokemon = favA.length > 0 ? favA : [];
    }
    return payload;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll()) return;
    const payload = buildPayload();
    if (Object.keys(payload).length === 0) {
      setSubmitSuccess("変更はありません。");
      setToast("変更はありません。");
      return;
    }
    try {
      setSubmitError(null);
      const res = await callApi<User>("/api/users/me", {
        method: "PATCH",
        body: payload,
      });
      if (res.error) {
        setSubmitError(res.error);
        return;
      }
      setSubmitSuccess("保存しました。");
      setToast("保存しました。");
      setIsDirty(false);
      await refetch();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "更新に失敗しました。",
      );
    }
  };

  return (
    <>
      <Layout>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">マイページ</h1>

          {loading && <div className="py-8">読み込み中...</div>}
          {error && <div className="py-4 text-red-600">{error}</div>}

          {userData && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 左カラム: プロフィール編集（Discord情報もここに統合） */}
              <div className="md:col-span-2">
                <form onSubmit={onSubmit} className="space-y-6">
                  {/* 編集可能フィールド */}
                  <div className="bg-white shadow rounded-xl p-6 space-y-5">
                    <h2 className="text-lg font-semibold">プロフィール</h2>

                    {/* Discord 情報（表示のみ）：プロフィール内に統合 */}
                    <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                      <img
                        src={userData.discord_avatar_url}
                        alt={userData.discord_username}
                        className="w-14 h-14 rounded-full object-cover"
                      />
                      <div>
                        <div className="font-medium">
                          {userData.discord_username}
                          {userData.discord_discriminator
                            ? `#${userData.discord_discriminator}`
                            : ""}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        トレーナー名 <span className="text-red-500">*</span>
                      </label>
                      <input
                        className={`mt-1 block w-full px-4 py-3 bg-gray-50 border rounded-lg ${
                          validErrors.trainer_name
                            ? "border-red-300"
                            : "border-gray-300"
                        }`}
                        value={formData.trainer_name}
                        onChange={(e) =>
                          onChange("trainer_name", e.target.value)
                        }
                        placeholder="アプリケーション内で表示される名前"
                      />
                      {validErrors.trainer_name && (
                        <p className="mt-1 text-sm text-red-600">
                          {validErrors.trainer_name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Twitter(X) ID
                      </label>
                      <input
                        className={`mt-1 block w-full px-4 py-3 bg-gray-50 border rounded-lg ${
                          validErrors.twitter_id
                            ? "border-red-300"
                            : "border-gray-300"
                        }`}
                        value={formData.twitter_id}
                        onChange={(e) => onTwitterChange(e.target.value)}
                        placeholder="@example"
                      />
                      {validErrors.twitter_id && (
                        <p className="mt-1 text-sm text-red-600">
                          {validErrors.twitter_id}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        希望ロール
                      </label>
                      <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                        {Object.values(PreferredRole).map((role) => (
                          <label
                            key={role}
                            className="inline-flex items-center gap-2"
                          >
                            <input
                              type="checkbox"
                              checked={formData.preferred_roles.includes(role)}
                              onChange={(e) =>
                                onRoleToggle(role, e.target.checked)
                              }
                            />
                            <span>{ROLE_LABELS[role]}</span>
                          </label>
                        ))}
                      </div>
                      {validErrors.preferred_roles && (
                        <p className="mt-1 text-sm text-red-600">
                          {validErrors.preferred_roles}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        得意なポケモン
                      </label>
                      <div className="mt-2">
                        <div className="flex flex-wrap gap-2 mb-2">
                          {(formData.favorite_pokemon || []).map((id) => {
                            const p = (
                              pokemons as {
                                id: string;
                                name: string;
                                imageUrl: string;
                              }[]
                            ).find((x) => x.id === id);
                            return (
                              <span
                                key={id}
                                className="inline-flex items-center gap-2 px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200 text-sm"
                              >
                                {p && (
                                  <img
                                    src={p.imageUrl}
                                    alt={p.name}
                                    className="w-5 h-5 rounded object-cover"
                                  />
                                )}
                                <span>{p ? p.name : id}</span>
                                <button
                                  type="button"
                                  className="ml-1 text-indigo-500 hover:text-indigo-700"
                                  onClick={() =>
                                    onFavPokemonSave(
                                      (formData.favorite_pokemon || []).filter(
                                        (x) => x !== id,
                                      ),
                                    )
                                  }
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })}
                        </div>
                        <button
                          type="button"
                          className="px-3 py-2 rounded border border-gray-300 hover:bg-gray-50"
                          onClick={() => setShowPokemonSelector(true)}
                        >
                          選択する
                        </button>
                        {validErrors.favorite_pokemon && (
                          <p className="mt-1 text-sm text-red-600">
                            {validErrors.favorite_pokemon}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        ひとこと
                      </label>
                      <textarea
                        className={`mt-1 block w-full px-4 py-3 bg-gray-50 border rounded-lg min-h-[120px] ${
                          validErrors.bio ? "border-red-300" : "border-gray-300"
                        }`}
                        value={formData.bio}
                        onChange={(e) => onChange("bio", e.target.value)}
                        placeholder="得意ポケモンや意気込みなど"
                      />
                      <div className="flex justify-between text-xs mt-1">
                        <span
                          className={
                            formData.bio.length > 500
                              ? "text-red-500"
                              : "text-gray-500"
                          }
                        >
                          {formData.bio.length}/500文字
                        </span>
                        {validErrors.bio && (
                          <span className="text-red-600">
                            {validErrors.bio}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                        disabled={!isDirty}
                      >
                        保存する
                      </button>
                      {submitSuccess && (
                        <span className="text-green-700 text-sm">
                          {submitSuccess}
                        </span>
                      )}
                      {submitError && (
                        <span className="text-red-600 text-sm">
                          {submitError}
                        </span>
                      )}
                    </div>
                  </div>
                </form>
              </div>

              {/* 右カラム: 成績表示 */}
              <div className="md:col-span-1">
                <div className="bg-white shadow rounded-xl p-6 space-y-3">
                  <h2 className="text-lg font-semibold">成績情報</h2>
                  <div className="flex justify-between">
                    <span className="text-gray-600">レート</span>
                    <span className="font-medium">{userData.rate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">最高レート</span>
                    <span className="font-medium">{userData.max_rate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">試合数</span>
                    <span className="font-medium">{userData.match_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">勝利数</span>
                    <span className="font-medium">{userData.win_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">勝率</span>
                    <span className="font-medium">{computedWinRate}%</span>
                  </div>
                </div>

                <div className="bg-white shadow rounded-xl p-6 mt-6">
                  <h2 className="text-lg font-semibold mb-2">バトル記録</h2>
                  <p className="text-sm text-gray-600">
                    直近の試合成績は今後実装予定です。
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        {showPokemonSelector && (
          <PokemonSelector
            selectedPokemon={formData.favorite_pokemon || []}
            maxSelections={5}
            onPokemonToggle={(pokemonId) => {
              const current = formData.favorite_pokemon || [];
              const updated = current.includes(pokemonId)
                ? current.filter(p => p !== pokemonId)
                : [...current, pokemonId];
              onFavPokemonSave(updated);
            }}
          />
        )}
      </Layout>
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg"
          role="status"
          aria-live="polite"
        >
          {toast}
        </div>
      )}
    </>
  );
}
