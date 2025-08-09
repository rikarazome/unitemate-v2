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
  [PreferredRole.TOP_STUDY]: "上学習",
  [PreferredRole.MIDDLE]: "中央",
  [PreferredRole.BOTTOM_LANE]: "下レーン",
  [PreferredRole.BOTTOM_STUDY]: "下学習",
};

export default function MyPage() {
  const { isAuthenticated, isLoading: authLoading, logout } = useAuth0();
  const { userData, loading, error, shouldShowUserCreation, refetch } = useUser();
  const { callApi } = useApi();

  const [formData, setFormData] = useState<UpdateUserFormData>({
    trainer_name: "",
    twitter_id: "",
    preferred_roles: [],
    bio: "",
  });
  const [isDirty, setIsDirty] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [validErrors, setValidErrors] = useState<{
    trainer_name?: string;
    twitter_id?: string;
    preferred_roles?: string;
    bio?: string;
  }>({});

  // Initialize form when userData loads
  useEffect(() => {
    if (userData) {
      setFormData({
        trainer_name: userData.trainer_name || "",
        twitter_id: userData.twitter_id || "",
        preferred_roles: userData.preferred_roles || [],
        bio: userData.bio || "",
      });
      setIsDirty(false);
      setSubmitError(null);
      setSubmitSuccess(null);
      setValidErrors({});
    }
  }, [userData]);

  // Redirects
  if (!isAuthenticated && !authLoading) return <Navigate to="/" replace />;
  if (shouldShowUserCreation) return <Navigate to="/create-user" replace />;

  const layoutUser = userData
    ? {
        id: userData.user_id,
        username: userData.discord_username,
        avatar: userData.discord_avatar_url,
      }
    : undefined;

  const handleLogout = () => {
    logout({ logoutParams: { returnTo: window.location.origin } });
  };

  const onChange = (field: keyof UpdateUserFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    if (validErrors[field]) {
      setValidErrors((e) => ({ ...e, [field]: undefined }));
    }
  };

  const onTwitterChange = (value: string) => onChange("twitter_id", formatTwitterId(value));

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
    if (validErrors.preferred_roles) setValidErrors((e) => ({ ...e, preferred_roles: undefined }));
  };

  const computedWinRate = useMemo(() => {
    if (!userData || userData.match_count === 0) return 0;
    return Math.round((userData.win_count / userData.match_count) * 1000) / 10; // 0.1%単位
  }, [userData]);

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
        rolesA.length === rolesB.length && rolesA.every((r) => rolesB.includes(r));
      if (!equalRoles) payload.preferred_roles = rolesA;

      if ((formData.bio || null) !== (userData.bio || null))
        payload.bio = formData.bio ? formData.bio : null;
    }
    return payload;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll()) return;
    const payload = buildPayload();
    if (Object.keys(payload).length === 0) {
      setSubmitSuccess("変更はありません。");
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
      setIsDirty(false);
      await refetch();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "更新に失敗しました。");
    }
  };

  return (
    <Layout user={layoutUser} onLogout={handleLogout}>
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
                        validErrors.trainer_name ? "border-red-300" : "border-gray-300"
                      }`}
                      value={formData.trainer_name}
                      onChange={(e) => onChange("trainer_name", e.target.value)}
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
                        validErrors.twitter_id ? "border-red-300" : "border-gray-300"
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
                        <label key={role} className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData.preferred_roles.includes(role)}
                            onChange={(e) => onRoleToggle(role, e.target.checked)}
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
                      <span className={formData.bio.length > 500 ? "text-red-500" : "text-gray-500"}>
                        {formData.bio.length}/500文字
                      </span>
                      {validErrors.bio && (
                        <span className="text-red-600">{validErrors.bio}</span>
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
                      <span className="text-green-700 text-sm">{submitSuccess}</span>
                    )}
                    {submitError && (
                      <span className="text-red-600 text-sm">{submitError}</span>
                    )}
                  </div>
                </div>
              </form>
            </div>

            {/* 右カラム: 成績表示 */}
            <div className="md:col-span-1">
              <div className="bg-white shadow rounded-xl p-6 space-y-3">
                <h2 className="text-lg font-semibold">成績情報</h2>
                <div className="flex justify-between"><span className="text-gray-600">レート</span><span className="font-medium">{userData.rate}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">最高レート</span><span className="font-medium">{userData.max_rate}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">試合数</span><span className="font-medium">{userData.match_count}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">勝利数</span><span className="font-medium">{userData.win_count}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">勝率</span><span className="font-medium">{computedWinRate}%</span></div>
              </div>

              <div className="bg-white shadow rounded-xl p-6 mt-6">
                <h2 className="text-lg font-semibold mb-2">バトル記録</h2>
                <p className="text-sm text-gray-600">直近の試合成績は今後実装予定です。</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
