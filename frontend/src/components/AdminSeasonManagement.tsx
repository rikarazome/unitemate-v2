import React, { useState, useEffect } from "react";
import { useApi } from "../hooks/useApi";

interface Season {
  id: string;
  name: string;
  description?: string;
  start_date: number;
  end_date: number;
  image_url?: string;
  theme_color?: string;
  is_active: boolean;
  created_at: number;
  updated_at: number;
}

interface SeasonCreateRequest {
  id: string;
  name: string;
  description?: string;
  start_date: number;
  end_date: number;
  image_url?: string;
  theme_color?: string;
}

const AdminSeasonManagement: React.FC = () => {
  const { callApi } = useApi();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);

  // フォーム状態
  const [formData, setFormData] = useState<SeasonCreateRequest>({
    id: "",
    name: "",
    description: "",
    start_date: 0,
    end_date: 0,
    image_url: "",
    theme_color: "#ff6b35",
  });

  // シーズン一覧取得
  const fetchSeasons = async () => {
    setLoading(true);
    try {
      const response = await callApi("/api/admin/seasons", {
        method: "GET",
      });

      if (response.status === 200 && response.data) {
        setSeasons(Array.isArray(response.data) ? response.data as Season[] : []);
      } else {
        setMessage(`シーズン取得エラー: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      setMessage(`シーズン取得エラー: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // 初期読み込み
  useEffect(() => {
    fetchSeasons();
  }, []);

  // フォームリセット
  const resetForm = () => {
    setFormData({
      id: "",
      name: "",
      description: "",
      start_date: 0,
      end_date: 0,
      image_url: "",
      theme_color: "#ff6b35",
    });
    setEditingSeason(null);
    setShowCreateForm(false);
  };

  // シーズン作成
  const handleCreateSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await callApi("/api/admin/seasons", {
        method: "POST",
        body: JSON.stringify(formData),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.status === 200) {
        setMessage("シーズンが作成されました");
        resetForm();
        await fetchSeasons();
      } else {
        setMessage(`作成エラー: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      setMessage(`作成エラー: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // シーズン更新
  const handleUpdateSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSeason) return;

    setLoading(true);
    try {
      const response = await callApi(`/api/admin/seasons/${editingSeason.id}`, {
        method: "PUT",
        body: JSON.stringify(formData),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.status === 200) {
        setMessage("シーズンが更新されました");
        resetForm();
        await fetchSeasons();
      } else {
        setMessage(`更新エラー: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      setMessage(`更新エラー: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // シーズン削除
  const handleDeleteSeason = async (seasonId: string) => {
    if (!confirm(`シーズン「${seasonId}」を削除しますか？`)) return;

    setLoading(true);
    try {
      const response = await callApi(`/api/admin/seasons/${seasonId}`, {
        method: "DELETE",
      });

      if (response.status === 200) {
        setMessage("シーズンが削除されました");
        await fetchSeasons();
      } else {
        setMessage(`削除エラー: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      setMessage(`削除エラー: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // シーズンアクティベート
  const handleActivateSeason = async (seasonId: string) => {
    if (!confirm(`シーズン「${seasonId}」をアクティブにしますか？`)) return;

    setLoading(true);
    try {
      const response = await callApi(`/api/admin/seasons/${seasonId}/activate`, {
        method: "POST",
      });

      if (response.status === 200) {
        setMessage("シーズンがアクティブになりました");
        await fetchSeasons();
      } else {
        setMessage(`アクティベートエラー: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      setMessage(`アクティベートエラー: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // 編集モード開始
  const startEdit = (season: Season) => {
    setEditingSeason(season);
    setFormData({
      id: season.id,
      name: season.name,
      description: season.description || "",
      start_date: season.start_date,
      end_date: season.end_date,
      image_url: season.image_url || "",
      theme_color: season.theme_color || "#ff6b35",
    });
    setShowCreateForm(true);
  };

  // 日時フォーマット
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString("ja-JP");
  };

  // 日時入力用のフォーマット（YYYY-MM-DDTHH:mm）
  const timestampToInputFormat = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toISOString().slice(0, 16);
  };

  // 入力フォーマットからタイムスタンプへ
  const inputFormatToTimestamp = (dateString: string) => {
    return Math.floor(new Date(dateString).getTime() / 1000);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">シーズン管理</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          {showCreateForm ? "キャンセル" : "新規作成"}
        </button>
      </div>

      {message && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800">
          {message}
        </div>
      )}

      {/* 作成・編集フォーム */}
      {showCreateForm && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">
            {editingSeason ? "シーズン編集" : "新規シーズン作成"}
          </h3>
          <form onSubmit={editingSeason ? handleUpdateSeason : handleCreateSeason}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  シーズンID *
                </label>
                <input
                  type="text"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  disabled={editingSeason !== null}
                  placeholder="season_2024_winter"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  シーズン名 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="2024年冬シーズン"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  説明
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="シーズンの説明..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  開始日時 *
                </label>
                <input
                  type="datetime-local"
                  value={
                    formData.start_date
                      ? timestampToInputFormat(formData.start_date)
                      : ""
                  }
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      start_date: inputFormatToTimestamp(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  終了日時 *
                </label>
                <input
                  type="datetime-local"
                  value={
                    formData.end_date ? timestampToInputFormat(formData.end_date) : ""
                  }
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      end_date: inputFormatToTimestamp(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  イメージURL
                </label>
                <input
                  type="url"
                  value={formData.image_url}
                  onChange={(e) =>
                    setFormData({ ...formData, image_url: e.target.value })
                  }
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  テーマカラー
                </label>
                <input
                  type="color"
                  value={formData.theme_color}
                  onChange={(e) =>
                    setFormData({ ...formData, theme_color: e.target.value })
                  }
                  className="w-full h-10 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {loading ? "処理中..." : editingSeason ? "更新" : "作成"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </form>
        </div>
      )}

      {/* シーズン一覧 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">シーズン一覧</h3>
        </div>

        {loading && (
          <div className="p-6 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            <p className="mt-2 text-gray-600">読み込み中...</p>
          </div>
        )}

        {!loading && seasons.length === 0 && (
          <div className="p-6 text-center text-gray-500">
            シーズンがありません
          </div>
        )}

        {!loading && seasons.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    シーズン
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    期間
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状態
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {seasons.map((season) => (
                  <tr key={season.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div
                          className="w-4 h-4 rounded-full mr-3"
                          style={{ backgroundColor: season.theme_color }}
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {season.name}
                          </div>
                          <div className="text-sm text-gray-500">{season.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>{formatDate(season.start_date)}</div>
                      <div>〜 {formatDate(season.end_date)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          season.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {season.is_active ? "アクティブ" : "非アクティブ"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      <button
                        onClick={() => startEdit(season)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        編集
                      </button>
                      {!season.is_active && (
                        <button
                          onClick={() => handleActivateSeason(season.id)}
                          className="text-green-600 hover:text-green-900"
                        >
                          アクティブ化
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteSeason(season.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSeasonManagement;