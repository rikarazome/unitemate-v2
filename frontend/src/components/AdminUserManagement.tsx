import React, { useState } from "react";
import { useApi } from "../hooks/useApi";
import { getBadgeSync } from "../hooks/useBadges";
import BadgeSelectionModal from "./BadgeSelectionModal";

interface User {
  user_id: string;
  auth0_sub: string;
  discord_username?: string;
  trainer_name?: string;
  rate: number;
  max_rate: number;
  match_count: number;
  win_count: number;
  win_rate: number;
  penalty_count: number;
  penalty_correction: number;
  effective_penalty: number;
  last_penalty_time?: number;
  penalty_timeout_until?: number;
  is_admin: boolean;
  is_banned: boolean;
  owned_badges: string[];
  current_badge?: string;
  current_badge_2?: string;
  created_at: number;
  updated_at: number;
  penalty_status?: {
    processed: boolean;
    penalty_players: string[];
    processing_time?: number;
  };
}

interface SearchFormData {
  query: string;
  search_type: "all" | "discord_name" | "trainer_name";
}

interface UpdateFormData {
  rate?: number;
  penalty_count?: number;
  penalty_correction?: number;
  is_banned?: boolean;
  owned_badges?: string[];
}

const AdminUserManagement: React.FC = () => {
  const { callApi } = useApi();

  // 検索関連の状態
  const [searchForm, setSearchForm] = useState<SearchFormData>({
    query: "",
    search_type: "all",
  });
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // 選択されたユーザーと編集関連の状態
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [updateForm, setUpdateForm] = useState<UpdateFormData>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // バッジ選択モーダルの状態
  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState(false);

  // ユーザー検索実行
  const handleSearch = async () => {
    if (!searchForm.query.trim()) {
      setSearchError("検索クエリを入力してください");
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const response = await callApi<{ users: User[] }>(
        "/api/admin/users/search",
        {
          method: "POST",
          body: {
            query: searchForm.query.trim(),
            search_type: searchForm.search_type,
            limit: 20,
          },
        },
      );

      if (response.data) {
        setSearchResults(response.data.users || []);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error("User search error:", error);
      setSearchError("ユーザー検索に失敗しました");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // ユーザー詳細取得
  const handleSelectUser = async (user: User) => {
    try {
      const response = await callApi<User>(`/api/admin/users/${user.user_id}`, {
        method: "GET",
      });

      if (response.data) {
        setSelectedUser(response.data);
        setUpdateForm({
          rate: response.data.rate,
          penalty_count: response.data.penalty_count,
          penalty_correction: response.data.penalty_correction,
          is_banned: response.data.is_banned,
          owned_badges: [...(response.data.owned_badges || [])],
        });
      }
    } catch (error) {
      console.error("Get user details error:", error);
      alert("ユーザー詳細の取得に失敗しました");
    }
  };

  // バッジ選択モーダルから保存
  const handleBadgeSave = (selectedBadges: string[]) => {
    setUpdateForm({ ...updateForm, owned_badges: selectedBadges });
  };

  // ユーザー情報更新
  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    setIsUpdating(true);
    setUpdateError(null);

    try {
      // 変更があったフィールドのみを送信
      const updateData: Partial<UpdateFormData> = {};

      if (updateForm.rate !== selectedUser.rate) {
        updateData.rate = updateForm.rate;
      }
      if (updateForm.penalty_count !== selectedUser.penalty_count) {
        updateData.penalty_count = updateForm.penalty_count;
      }
      if (updateForm.penalty_correction !== selectedUser.penalty_correction) {
        updateData.penalty_correction = updateForm.penalty_correction;
      }
      if (updateForm.is_banned !== selectedUser.is_banned) {
        updateData.is_banned = updateForm.is_banned;
      }
      if (
        JSON.stringify(updateForm.owned_badges) !==
        JSON.stringify(selectedUser.owned_badges)
      ) {
        updateData.owned_badges = updateForm.owned_badges;
      }

      if (Object.keys(updateData).length === 0) {
        alert("変更がありません");
        return;
      }

      const response = await callApi(
        `/api/admin/users/${selectedUser.user_id}`,
        {
          method: "PUT",
          body: updateData,
        },
      );

      if (response.status === 200) {
        alert("ユーザー情報を更新しました");
        setIsEditing(false);
        // 最新情報を再取得
        await handleSelectUser(selectedUser);
      }
    } catch (error) {
      console.error("Update user error:", error);
      setUpdateError("ユーザー情報の更新に失敗しました");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold mb-6">👥 ユーザー管理</h3>

      {/* 検索フォーム */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h4 className="font-medium mb-3">ユーザー検索</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <input
              type="text"
              placeholder="Discord名 または トレーナー名"
              value={searchForm.query}
              onChange={(e) =>
                setSearchForm({ ...searchForm, query: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <div className="flex gap-2">
            <select
              value={searchForm.search_type}
              onChange={(e) =>
                setSearchForm({
                  ...searchForm,
                  search_type: e.target.value as
                    | "all"
                    | "discord_name"
                    | "trainer_name",
                })
              }
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">全体検索</option>
              <option value="discord_name">Discord名</option>
              <option value="trainer_name">トレーナー名</option>
            </select>
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSearching ? "検索中..." : "検索"}
            </button>
          </div>
        </div>
        {searchError && (
          <p className="text-red-600 text-sm mt-2">{searchError}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 検索結果 */}
        <div>
          <h4 className="font-medium mb-3">
            検索結果 ({searchResults.length}件)
          </h4>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {searchResults.map((user) => (
              <div
                key={user.user_id}
                onClick={() => handleSelectUser(user)}
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedUser?.user_id === user.user_id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">
                      {user.trainer_name || "未設定"}
                    </p>
                    <p className="text-sm text-gray-600">
                      {user.discord_username}
                    </p>
                    <p className="text-sm text-gray-500">ID: {user.user_id}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p>レート: {user.rate}</p>
                    <p
                      className={
                        user.effective_penalty > 0
                          ? "text-red-600"
                          : "text-green-600"
                      }
                    >
                      ペナルティ: {user.effective_penalty}
                    </p>
                    {user.is_banned && (
                      <span className="text-red-600 font-bold">凍結</span>
                    )}
                    {user.is_admin && (
                      <span className="text-blue-600 font-bold">管理者</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ユーザー詳細・編集 */}
        <div>
          {selectedUser ? (
            <div>
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-medium">ユーザー詳細</h4>
                <div className="flex gap-2">
                  {!isEditing ? (
                    <>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 transition-colors"
                      >
                        編集
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleUpdateUser}
                        disabled={isUpdating}
                        className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        {isUpdating ? "更新中..." : "保存"}
                      </button>
                      <button
                        onClick={() => {
                          setIsEditing(false);
                          setUpdateError(null);
                        }}
                        className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 transition-colors"
                      >
                        キャンセル
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                {updateError && (
                  <div className="bg-red-50 border border-red-200 rounded p-2 mb-4">
                    <p className="text-red-600 text-sm">{updateError}</p>
                  </div>
                )}

                <div className="space-y-4">
                  {/* 基本情報 */}
                  <div>
                    <h5 className="font-medium text-sm mb-2">基本情報</h5>
                    <div className="space-y-2 text-sm">
                      <p>
                        <span className="font-medium">ユーザーID:</span>{" "}
                        {selectedUser.user_id}
                      </p>
                      <p>
                        <span className="font-medium">Discord名:</span>{" "}
                        {selectedUser.discord_username || "未設定"}
                      </p>
                      <p>
                        <span className="font-medium">トレーナー名:</span>{" "}
                        {selectedUser.trainer_name || "未設定"}
                      </p>
                      <p>
                        <span className="font-medium">登録日:</span>{" "}
                        {new Date(
                          selectedUser.created_at * 1000,
                        ).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* レート情報 */}
                  <div>
                    <h5 className="font-medium text-sm mb-2">レート情報</h5>
                    {isEditing ? (
                      <div className="space-y-2">
                        <label className="block">
                          <span className="text-sm">現在レート:</span>
                          <input
                            type="number"
                            value={updateForm.rate || 0}
                            onChange={(e) =>
                              setUpdateForm({
                                ...updateForm,
                                rate: parseInt(e.target.value),
                              })
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="space-y-1 text-sm">
                        <p>
                          <span className="font-medium">現在レート:</span>{" "}
                          {selectedUser.rate}
                        </p>
                        <p>
                          <span className="font-medium">最高レート:</span>{" "}
                          {selectedUser.max_rate}
                        </p>
                        <p>
                          <span className="font-medium">試合数:</span>{" "}
                          {selectedUser.match_count}
                        </p>
                        <p>
                          <span className="font-medium">勝利数:</span>{" "}
                          {selectedUser.win_count}
                        </p>
                        <p>
                          <span className="font-medium">勝率:</span>{" "}
                          {selectedUser.win_rate}%
                        </p>
                      </div>
                    )}
                  </div>

                  {/* ペナルティ情報 */}
                  <div>
                    <h5 className="font-medium text-sm mb-2">ペナルティ情報</h5>
                    {isEditing ? (
                      <div className="space-y-2">
                        <label className="block">
                          <span className="text-sm">累積ペナルティ:</span>
                          <input
                            type="number"
                            value={updateForm.penalty_count || 0}
                            onChange={(e) =>
                              setUpdateForm({
                                ...updateForm,
                                penalty_count: parseInt(e.target.value),
                              })
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-sm">軽減数:</span>
                          <input
                            type="number"
                            value={updateForm.penalty_correction || 0}
                            onChange={(e) =>
                              setUpdateForm({
                                ...updateForm,
                                penalty_correction: parseInt(e.target.value),
                              })
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="space-y-1 text-sm">
                        <p>
                          <span className="font-medium">累積ペナルティ:</span>{" "}
                          {selectedUser.penalty_count}
                        </p>
                        <p>
                          <span className="font-medium">軽減数:</span>{" "}
                          {selectedUser.penalty_correction}
                        </p>
                        <p>
                          <span className="font-medium">実効ペナルティ:</span>
                          <span
                            className={
                              selectedUser.effective_penalty > 0
                                ? "text-red-600"
                                : "text-green-600"
                            }
                          >
                            {selectedUser.effective_penalty}
                          </span>
                        </p>
                        {selectedUser.last_penalty_time && (
                          <p>
                            <span className="font-medium">最終ペナルティ:</span>{" "}
                            {new Date(
                              selectedUser.last_penalty_time * 1000,
                            ).toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 勲章情報 */}
                  <div>
                    <h5 className="font-medium text-sm mb-2">勲章情報</h5>
                    <div className="space-y-2">
                      {/* 装着中の勲章（表示のみ） */}
                      <div className="bg-blue-50 border border-blue-200 rounded p-2">
                        <p className="text-xs font-medium text-blue-800 mb-1">
                          現在装着中
                        </p>
                        <div className="space-y-1 text-sm">
                          {selectedUser.current_badge ? (
                            <p>
                              <span className="font-medium">勲章1:</span>{" "}
                              {getBadgeSync(selectedUser.current_badge)?.display ||
                                selectedUser.current_badge}
                            </p>
                          ) : (
                            <p className="text-gray-500">勲章1: 未装着</p>
                          )}
                          {selectedUser.current_badge_2 ? (
                            <p>
                              <span className="font-medium">勲章2:</span>{" "}
                              {getBadgeSync(selectedUser.current_badge_2)
                                ?.display || selectedUser.current_badge_2}
                            </p>
                          ) : (
                            <p className="text-gray-500">勲章2: 未装着</p>
                          )}
                        </div>
                      </div>

                      {/* 所持勲章（編集可能） */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-sm font-medium">
                            所持勲章リスト {isEditing && "(編集可能)"}
                          </p>
                          {isEditing && (
                            <button
                              onClick={() => setIsBadgeModalOpen(true)}
                              className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                            >
                              勲章を選択
                            </button>
                          )}
                        </div>
                        {isEditing ? (
                          <div>
                            <div className="bg-gray-50 border border-gray-200 rounded p-2 min-h-16">
                              {updateForm.owned_badges &&
                              updateForm.owned_badges.length > 0 ? (
                                <div>
                                  <p className="text-sm font-medium mb-2">
                                    選択中の勲章 (
                                    {updateForm.owned_badges.length}個):
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {updateForm.owned_badges.map((badgeId) => {
                                      const badge = getBadgeSync(badgeId);
                                      return (
                                        <span
                                          key={badgeId}
                                          className="inline-flex items-center px-2 py-1 rounded text-xs"
                                          style={{
                                            background:
                                              badge?.start_color &&
                                              badge?.end_color
                                                ? `linear-gradient(135deg, ${badge.start_color}, ${badge.end_color})`
                                                : "#6b7280",
                                            color:
                                              badge?.char_color || "#ffffff",
                                          }}
                                        >
                                          {badge?.display || badgeId}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500">
                                  「勲章を選択」ボタンをクリックして勲章を選択してください
                                </p>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              <p>※ 装着する勲章はユーザーが選択します</p>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm">
                            {selectedUser.owned_badges &&
                            selectedUser.owned_badges.length > 0 ? (
                              <div className="bg-gray-50 border border-gray-200 rounded p-2 max-h-20 overflow-y-auto">
                                <p className="font-medium mb-1">
                                  計 {selectedUser.owned_badges.length}個:
                                </p>
                                <p className="text-xs">
                                  {selectedUser.owned_badges.join(", ")}
                                </p>
                              </div>
                            ) : (
                              <p className="text-gray-500">所持勲章なし</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* アカウント状態 */}
                  <div>
                    <h5 className="font-medium text-sm mb-2">アカウント状態</h5>
                    {isEditing ? (
                      <div className="space-y-2">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={updateForm.is_banned || false}
                            onChange={(e) =>
                              setUpdateForm({
                                ...updateForm,
                                is_banned: e.target.checked,
                              })
                            }
                            className="mr-2"
                          />
                          <span className="text-sm">アカウント凍結</span>
                        </label>
                      </div>
                    ) : (
                      <div className="space-y-1 text-sm">
                        <p>
                          <span className="font-medium">状態:</span>
                          <span
                            className={
                              selectedUser.is_banned
                                ? "text-red-600"
                                : "text-green-600"
                            }
                          >
                            {selectedUser.is_banned ? "凍結" : "正常"}
                          </span>
                        </p>
                        <p>
                          <span className="font-medium">権限:</span>
                          <span
                            className={
                              selectedUser.is_admin ? "text-blue-600" : ""
                            }
                          >
                            {selectedUser.is_admin ? "管理者" : "一般ユーザー"}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-12">
              ユーザーを選択してください
            </div>
          )}
        </div>
      </div>

      {/* バッジ選択モーダル */}
      <BadgeSelectionModal
        isOpen={isBadgeModalOpen}
        onClose={() => setIsBadgeModalOpen(false)}
        selectedBadges={updateForm.owned_badges || []}
        onSave={handleBadgeSave}
      />
    </div>
  );
};

export default AdminUserManagement;
