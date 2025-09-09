import React, { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useDummyAuth } from "../hooks/useDummyAuth";
import { useMasterData } from "../hooks/useUnitemateApi";
import type { Setting } from "../types/common";

const AdminContentManager: React.FC = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const dummyAuth = useDummyAuth();
  const { masterData, loading: masterLoading } = useMasterData();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [rulesContent, setRulesContent] = useState("");
  const [announcementContent, setAnnouncementContent] = useState("");
  const [lobbyCreateTimeout, setLobbyCreateTimeout] = useState(150);
  const [lobbyJoinTimeout, setLobbyJoinTimeout] = useState(250);

  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

  // マスターデータから現在の設定値を読み込み
  useEffect(() => {
    if (masterData?.settings) {
      const settings = masterData.settings;

      const rulesContentSetting = settings.find(
        (s: Setting) => s.id === "rules_content",
      );
      if (rulesContentSetting) {
        setRulesContent(String(rulesContentSetting.value));
      }

      const announcementSetting = settings.find(
        (s: Setting) => s.id === "announcement_content",
      );
      if (announcementSetting) {
        setAnnouncementContent(String(announcementSetting.value));
      }

      const lobbyCreateSetting = settings.find(
        (s: Setting) => s.id === "lobby_create_timeout",
      );
      if (lobbyCreateSetting) {
        setLobbyCreateTimeout(Number(lobbyCreateSetting.value));
      }

      const lobbyJoinSetting = settings.find(
        (s: Setting) => s.id === "lobby_join_timeout",
      );
      if (lobbyJoinSetting) {
        setLobbyJoinTimeout(Number(lobbyJoinSetting.value));
      }
    }
  }, [masterData]);

  const updateSetting = async (id: string, value: string | number) => {
    setLoading(true);
    setMessage(null);

    try {
      let token: string;
      if (dummyAuth.isAuthenticated && dummyAuth.accessToken) {
        token = dummyAuth.accessToken;
      } else if (isAuthenticated) {
        token = await getAccessTokenSilently();
      } else {
        throw new Error("Not authenticated");
      }

      const response = await fetch(`${API_BASE_URL}/api/master/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id, value }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "更新に失敗しました");
      }

      setMessage({ type: "success", text: `${id} を更新しました` });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "更新に失敗しました",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRules = () => {
    updateSetting("rules_content", rulesContent);
  };

  const handleSaveAnnouncement = () => {
    updateSetting("announcement_content", announcementContent);
  };

  const handleSaveLobbyTimeouts = () => {
    Promise.all([
      updateSetting("lobby_create_timeout", lobbyCreateTimeout),
      updateSetting("lobby_join_timeout", lobbyJoinTimeout),
    ])
      .then(() => {
        setMessage({ type: "success", text: "タイムアウト設定を更新しました" });
      })
      .catch((error) => {
        setMessage({
          type: "error",
          text:
            error instanceof Error
              ? error.message
              : "タイムアウト設定の更新に失敗しました",
        });
      });
  };

  if (masterLoading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          <div className="text-2xl mb-2">⏳</div>
          <p className="text-gray-600">設定を読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold mb-4">📝 コンテンツ管理</h3>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg ${
            message.type === "success"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        {/* ルールコンテンツ */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ルールコンテンツ（Markdown形式）
          </label>
          <textarea
            value={rulesContent}
            onChange={(e) => setRulesContent(e.target.value)}
            placeholder="ルールの内容をMarkdown形式で入力してください..."
            className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-vertical focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleSaveRules}
            disabled={loading}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? "保存中..." : "ルールを保存"}
          </button>
        </div>

        {/* お知らせコンテンツ */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            お知らせコンテンツ（Markdown形式）
          </label>
          <textarea
            value={announcementContent}
            onChange={(e) => setAnnouncementContent(e.target.value)}
            placeholder="お知らせの内容をMarkdown形式で入力してください..."
            className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-vertical focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleSaveAnnouncement}
            disabled={loading}
            className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? "保存中..." : "お知らせを保存"}
          </button>
        </div>

        {/* タイムアウト設定 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            マッチングタイムアウト設定
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                ロビー作成タイムアウト（秒）
              </label>
              <input
                type="number"
                value={lobbyCreateTimeout}
                onChange={(e) => setLobbyCreateTimeout(Number(e.target.value))}
                min="60"
                max="300"
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                ロビー参加タイムアウト（秒）
              </label>
              <input
                type="number"
                value={lobbyJoinTimeout}
                onChange={(e) => setLobbyJoinTimeout(Number(e.target.value))}
                min="60"
                max="600"
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <button
            onClick={handleSaveLobbyTimeouts}
            disabled={loading}
            className="mt-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? "保存中..." : "タイムアウト設定を保存"}
          </button>
        </div>
      </div>

      <div className="mt-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800">
          💡 <strong>ヒント:</strong> Markdownでは # でヘッダー、-
          でリスト、**太字**、*斜体* などが使用できます。
        </p>
      </div>
    </div>
  );
};

export default AdminContentManager;
