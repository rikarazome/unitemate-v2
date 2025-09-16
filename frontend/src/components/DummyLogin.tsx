import React, { useState, useEffect } from "react";

interface DummyUser {
  user_id: string;
  trainer_name: string;
  discord_username: string;
  rate: number;
  preferred_role: string;
}

interface DummyLoginProps {
  onLogin: (accessToken: string, userInfo: DummyUser) => void;
}

const DummyLogin: React.FC<DummyLoginProps> = ({ onLogin }) => {
  const [dummyUsers, setDummyUsers] = useState<DummyUser[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // ダミーユーザー一覧を取得
  useEffect(() => {
    const fetchDummyUsers = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/auth/dummy/users`,
        );
        if (response.ok) {
          const data = await response.json();
          setDummyUsers(data.dummy_users || []);
        }
      } catch (error) {
        console.error("Failed to fetch dummy users:", error);
      }
    };

    fetchDummyUsers();
  }, []);

  // ダミーユーザーでログイン
  const handleDummyLogin = async (userId: string) => {
    setLoading(true);
    try {
      // ダミーパスワードを生成（user_idから推測可能）
      const userIndex = userId.replace("dummy_user_", "");
      const password = `test_password_${userIndex}`;

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/auth/dummy/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: userId,
            password: password,
          }),
        },
      );

      if (response.ok) {
        const data = await response.json();

        // アクセストークンとユーザー情報を返す
        onLogin(data.access_token, data.user);
        setIsOpen(false);
      } else {
        const error = await response.json();
        alert(`ログインに失敗しました: ${error.error}`);
      }
    } catch (error) {
      console.error("Dummy login failed:", error);
      alert("ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = (role: string) => {
    const roleIcons: Record<string, string> = {
      TOP_LANE: "⚔️",
      MIDDLE: "🔮",
      BOTTOM_LANE: "🏹",
      SUPPORT: "🛡️",
      TANK: "🛡️",
    };
    return roleIcons[role] || "❓";
  };

  return (
    <div className="relative">
      {/* ドロップダウントリガーボタン */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-2 rounded-lg font-medium hover:from-orange-600 hover:to-red-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center gap-2"
        disabled={loading}
      >
        🧪 テスト用ログイン
        <span
          className={`transform transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          ▼
        </span>
      </button>

      {/* ドロップダウンメニュー */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 max-h-96 overflow-y-auto">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800 text-sm">
              テスト用ダミーアカウント
            </h3>
            <p className="text-gray-600 text-xs mt-1">
              実運用テスト用のアカウントです
            </p>
          </div>

          <div className="p-2">
            {dummyUsers.length === 0 ? (
              <div className="text-center p-4 text-gray-500">
                ダミーユーザーが見つかりません
              </div>
            ) : (
              dummyUsers.map((user) => (
                <button
                  key={user.user_id}
                  onClick={() => handleDummyLogin(user.user_id)}
                  disabled={loading}
                  className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors duration-150 border border-transparent hover:border-gray-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-800 text-sm">
                        {user.trainer_name}
                      </div>
                      <div className="text-gray-500 text-xs">
                        @{user.discord_username}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                          Rate: {user.rate}
                        </span>
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded flex items-center gap-1">
                          {getRoleIcon(user.preferred_role)}{" "}
                          {user.preferred_role}
                        </span>
                      </div>
                    </div>
                    <div className="text-gray-400 text-lg">→</div>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="p-4 border-t border-gray-100 bg-gray-50 text-center">
            <p className="text-xs text-gray-500">
              ⚠️ これらはテスト用アカウントです
            </p>
          </div>
        </div>
      )}

      {/* オーバーレイ（ドロップダウンを閉じるため） */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
};

export default DummyLogin;
