import { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useApi } from "../hooks/useApi";
import { PreferredRole } from "../types/user";
import type {
  Auth0UserProfile,
  CreateUserFormData,
  CreateUserRequest,
  User,
  ValidationErrors,
} from "../types/user";
import {
  formatTwitterId,
  hasValidationErrors,
  validateFormData,
} from "../utils/validation";
import Layout from "./Layout";

interface UserCreationFormProps {
  auth0Profile: Auth0UserProfile;
}

const ROLE_LABELS: Record<PreferredRole, string> = {
  [PreferredRole.TOP_LANE]: "上レーン",
  [PreferredRole.SUPPORT]: "サポート",
  [PreferredRole.MIDDLE]: "中央",
  [PreferredRole.BOTTOM_LANE]: "下レーン",
  [PreferredRole.TANK]: "タンク",
};

export default function UserCreationForm({
  auth0Profile,
}: UserCreationFormProps) {
  const { logout } = useAuth0();
  const { callApi } = useApi();

  const [formData, setFormData] = useState<CreateUserFormData>({
    trainer_name: "",
    twitter_id: "",
    preferred_roles: [],
    bio: "",
  });

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleInputChange = (
    field: keyof CreateUserFormData,
    value: string,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear validation error for this field
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    setSubmitError(null);
  };

  const handleTwitterIdChange = (value: string) => {
    const formattedValue = formatTwitterId(value);
    handleInputChange("twitter_id", formattedValue);
  };

  const handleRoleChange = (role: PreferredRole, checked: boolean) => {
    setFormData((prev) => {
      const newRoles = checked
        ? [...prev.preferred_roles, role]
        : prev.preferred_roles.filter((r) => r !== role);
      return { ...prev, preferred_roles: newRoles };
    });
    // Clear role validation error
    if (errors.preferred_roles) {
      setErrors((prev) => ({ ...prev, preferred_roles: undefined }));
    }
    setSubmitError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form data
    const validationErrors = validateFormData(formData);
    if (hasValidationErrors(validationErrors)) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const createUserRequest: CreateUserRequest = {
        auth0_profile: auth0Profile,
        trainer_name: formData.trainer_name,
        twitter_id: formData.twitter_id || undefined,
        preferred_roles:
          formData.preferred_roles.length > 0
            ? formData.preferred_roles
            : undefined,
        bio: formData.bio || undefined,
      };

      const response = await callApi<User>("/api/users", {
        method: "POST",
        body: createUserRequest,
      });

      if (response.error) {
        setSubmitError(response.error);
        return;
      }

      // Success - reload to refresh user state
      window.location.href = "/";
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "ユーザー作成に失敗しました。",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const bioCharCount = formData.bio.length;

  // Auth0ユーザー情報をLayoutのUser形式に変換
  const layoutUser = {
    id: auth0Profile.sub,
    username: auth0Profile.nickname,
    avatar: auth0Profile.picture,
  };

  const handleLogout = () => {
    logout({ logoutParams: { returnTo: window.location.origin } });
  };

  return (
    <Layout>
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)] py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-8 md:p-12 space-y-8 transform transition-all duration-500 hover:scale-105">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900">
              ユーザー情報の設定
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              アプリケーションで使用するユーザー情報を設定してください。
            </p>
          </div>

          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700 text-sm">{submitError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Discord情報
              </h3>
              <div>
                <label
                  className="block text-sm font-medium text-gray-700"
                  htmlFor="discord-user"
                >
                  Discordユーザー名
                </label>
                <div className="mt-1 flex items-center bg-gray-200 rounded-md p-2">
                  <img
                    alt="Discord user avatar"
                    className="w-10 h-10 rounded-full object-cover"
                    src={auth0Profile.picture}
                  />
                  <span className="ml-3 font-medium text-gray-800">
                    {auth0Profile.name}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-800 pt-4 border-t border-gray-200">
                アプリケーション設定
              </h3>

              <div>
                <label
                  className="block text-sm font-medium text-gray-700"
                  htmlFor="trainer-name"
                >
                  トレーナー名 <span className="text-red-500">*</span>
                </label>
                <input
                  className={`mt-1 block w-full px-4 py-3 bg-gray-50 border rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-300 ${
                    errors.trainer_name ? "border-red-300" : "border-gray-300"
                  }`}
                  id="trainer-name"
                  placeholder="アプリケーション内で表示される名前"
                  type="text"
                  value={formData.trainer_name}
                  onChange={(e) =>
                    handleInputChange("trainer_name", e.target.value)
                  }
                />
                {errors.trainer_name && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.trainer_name}
                  </p>
                )}
              </div>

              <div>
                <label
                  className="block text-sm font-medium text-gray-700"
                  htmlFor="twitter-id"
                >
                  Twitter(X) ID
                </label>
                <div className="relative mt-1">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-500">
                    @
                  </span>
                  <input
                    className={`pl-10 block w-full px-4 py-3 bg-gray-50 border rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-300 ${
                      errors.twitter_id ? "border-red-300" : "border-gray-300"
                    }`}
                    id="twitter-id"
                    placeholder="your_twitter_id"
                    type="text"
                    value={formData.twitter_id.replace(/^@/, "")}
                    onChange={(e) => handleTwitterIdChange(e.target.value)}
                  />
                </div>
                {errors.twitter_id && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.twitter_id}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  希望ロール
                </label>
                <div className="mt-2 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
                  {Object.entries(ROLE_LABELS).map(([role, label]) => (
                    <div key={role} className="flex items-center">
                      <input
                        className="h-5 w-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        id={`role-${role}`}
                        type="checkbox"
                        checked={formData.preferred_roles.includes(
                          role as PreferredRole,
                        )}
                        onChange={(e) =>
                          handleRoleChange(
                            role as PreferredRole,
                            e.target.checked,
                          )
                        }
                      />
                      <label
                        className="ml-3 block text-sm text-gray-900"
                        htmlFor={`role-${role}`}
                      >
                        {label}
                      </label>
                    </div>
                  ))}
                </div>
                {errors.preferred_roles && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.preferred_roles}
                  </p>
                )}
              </div>

              <div>
                <label
                  className="block text-sm font-medium text-gray-700"
                  htmlFor="bio"
                >
                  ひとこと
                </label>
                <textarea
                  className={`mt-1 block w-full px-4 py-3 bg-gray-50 border rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-300 ${
                    errors.bio ? "border-red-300" : "border-gray-300"
                  }`}
                  id="bio"
                  placeholder="得意ポケモンや意気込みなど、自己紹介文を入力してください"
                  rows={4}
                  value={formData.bio}
                  onChange={(e) => handleInputChange("bio", e.target.value)}
                />
                <div className="flex justify-between items-center mt-2">
                  {errors.bio && (
                    <p className="text-sm text-red-600">{errors.bio}</p>
                  )}
                  <p
                    className={`text-xs text-right ${bioCharCount > 500 ? "text-red-500" : "text-gray-500"}`}
                  >
                    {bioCharCount}/500文字
                  </p>
                </div>
              </div>
            </div>

            <div>
              <button
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "作成中..." : "ユーザーを作成"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
