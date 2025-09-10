import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { useAdmin } from "../hooks/useAdmin";
import { useDummyAuth } from "../hooks/useDummyAuth";
import { useApi } from "../hooks/useApi";
import { useQueueInfo } from "../hooks/useUnitemateApi";
import DummyLogin from "./DummyLogin";
import AdminUserManagement from "./AdminUserManagement";
import AdminContentManager from "./AdminContentManager";
import AdminMatchManagement from "./AdminMatchManagement";
import AdminSeasonManagement from "./AdminSeasonManagement";

/**
 * 管理者専用コントロールページ
 * rikarazomeのみアクセス可能
 */
const AdminControl: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuth0();
  const { isAdmin, isLoggedIn, currentUserId, isLoading } = useAdmin();
  const dummyAuth = useDummyAuth();
  const { callApi } = useApi();
  const { queueInfo } = useQueueInfo();

  // デバッグ用マッチメイキングトリガー状態
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugMessage, setDebugMessage] = useState<string | null>(null);

  // タブ管理
  const [activeTab, setActiveTab] = useState<
    "overview" | "users" | "matches" | "content" | "seasons"
  >("overview");

  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  // アクセス制御
  useEffect(() => {
    // ローディング中はリダイレクトしない
    if (!isLoading && (!isLoggedIn || !isAdmin)) {
      // 未認証または管理者でない場合はトップページにリダイレクト
      navigate("/", { replace: true });
    }
  }, [isLoggedIn, isAdmin, navigate, isLoading]);

  /**
   * 認証付きfetchヘルパー関数
   */
  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    let token: string;

    if (dummyAuth.isAuthenticated && dummyAuth.accessToken) {
      token = dummyAuth.accessToken;
    } else if (isAuthenticated) {
      token = await getAccessTokenSilently();
    } else {
      throw new Error("Not authenticated");
    }

    return fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
  };

  /**
   * デバッグ用: 試合結果集計 → マッチメイキングを実行
   */
  const handleDebugTriggerMatchmaking = async () => {
    setDebugLoading(true);
    setDebugMessage(null);

    try {
      // 1. まず試合結果集計を実行
      setDebugMessage("試合結果を集計中...");
      const gatherResponse = await fetchWithAuth("/api/debug/gather-match", {
        method: "POST",
      });

      if (!gatherResponse.ok) {
        const errorText = await gatherResponse.text();
        setDebugMessage(
          `結果集計エラー (${gatherResponse.status}): ${errorText}`,
        );
        return;
      }

      const gatherData = await gatherResponse.json();
      setDebugMessage(
        `結果集計完了 (${gatherData.processed_matches || 0}件処理) → マッチメイキング実行中...`,
      );

      // 2. 次にマッチメイキングを実行
      const response = await fetchWithAuth("/api/debug/matchmaking/trigger", {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        setDebugMessage(
          `処理完了: 結果集計 → マッチメイキング実行 (${data.message || "完了"})`,
        );
      } else {
        const errorText = await response.text();
        setDebugMessage(
          `マッチメイキングエラー (${response.status}): ${errorText || "マッチメイキングの実行に失敗しました"})`,
        );
      }
    } catch (error) {
      setDebugMessage(
        `例外エラー: ${error instanceof Error ? error.message : "エラーが発生しました"}`,
      );
    } finally {
      setDebugLoading(false);
    }
  };

  // 手動マッチメイキング実行（マッチ集計→マッチメイキングの完全版）
  const handleManualMatchmaking = async () => {
    setDebugLoading(true);
    setDebugMessage(null);

    try {
      // Step 1: マッチ集計を実行
      console.log("Step 1: Executing match gathering...");
      setDebugMessage("Step 1: マッチ集計を実行中...");

      const gatherResponse = await callApi("/api/debug/gather-match", {
        method: "POST",
      });
      console.log("Gather match response:", gatherResponse);

      if (gatherResponse.status !== 200) {
        throw new Error(
          `マッチ集計に失敗しました (status: ${gatherResponse.status})`,
        );
      }

      // Step 2: マッチメイキングを実行
      console.log("Step 2: Executing matchmaking...");
      setDebugMessage("Step 2: マッチメイキングを実行中...");

      const matchmakingResponse = await callApi(
        "/api/debug/matchmaking/trigger",
        { method: "POST" },
      );
      console.log("Matchmaking response:", matchmakingResponse);

      if (matchmakingResponse.status !== 200) {
        throw new Error(
          `マッチメイキングに失敗しました (status: ${matchmakingResponse.status})`,
        );
      }

      setDebugMessage("✅ マッチ集計→マッチメイキングが完了しました");
      alert("マッチ集計→マッチメイキングを実行しました");
    } catch (error) {
      console.error("Manual matchmaking error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "エラーが発生しました";
      setDebugMessage(`❌ ${errorMessage}`);
      alert(errorMessage);
    } finally {
      setDebugLoading(false);
    }
  };

  // ダミーユーザーリストの取得と表示
  const handleShowDummyUsers = async () => {
    try {
      const response = await callApi<{
        users: Array<{ user_id: string; trainer_name: string; rate?: number }>;
      }>("/api/auth/dummy/users");
      if (response.data) {
        console.log("Dummy users:", response.data);
        alert(
          `ダミーユーザー数: ${response.data.users?.length || 0}人\n詳細はコンソールを確認してください`,
        );
      }
    } catch (error) {
      console.error("Get dummy users error:", error);
      alert("ダミーユーザーの取得に失敗しました");
    }
  };

  // キューの状態確認
  const handleCheckQueueStatus = async () => {
    try {
      const response = await callApi<{ queue_count: number }>(
        "/api/debug/queue",
      );
      if (response.data) {
        console.log("Queue status:", response.data);
        alert(
          `キューの状態:\nユーザー数: ${response.data.queue_count || 0}人\n詳細はコンソールを確認してください`,
        );
      }
    } catch (error) {
      console.error("Get queue status error:", error);
      alert("キューの状態取得に失敗しました");
    }
  };

  // ランキングの手動計算
  const handleCalculateRanking = async () => {
    try {
      const response = await callApi<{ rankings_count: number }>(
        "/api/debug/ranking/calculate",
        { method: "POST" },
      );
      if (response.status === 200 && response.data) {
        alert(
          `ランキング計算完了\n処理件数: ${response.data.rankings_count || 0}件`,
        );
      } else {
        alert("ランキング計算に失敗しました");
      }
    } catch (error) {
      console.error("Calculate ranking error:", error);
      alert("エラーが発生しました");
    }
  };

  // テスト用: 全員インキュー
  const handleMassEnqueue = async () => {
    setDebugLoading(true);
    setDebugMessage(null);

    try {
      setDebugMessage("ダミーユーザーを取得中...");

      // ダミーユーザー一覧を取得
      const usersResponse = await callApi<{
        users: Array<{ user_id: string; trainer_name: string; rate?: number }>;
      }>("/api/auth/dummy/users");
      if (!usersResponse.data?.users) {
        throw new Error("ダミーユーザーが見つかりません");
      }

      const users = usersResponse.data.users.slice(0, 10); // 最大10人
      setDebugMessage(`${users.length}人のユーザーをインキュー中...`);

      const allRoles = ["TOP_LANE", "MIDDLE", "BOTTOM_LANE", "SUPPORT", "TANK"];
      let enqueuedCount = 0;

      // 各ユーザーを順番にインキュー
      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        try {
          // ダミーログインしてからインキュー（認証なしのAPIなのでfetchを直接使用）
          const loginResponse = await fetch(
            `${API_BASE_URL}/api/auth/dummy/login`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                user_id: user.user_id,
                trainer_name: user.trainer_name,
                rate: user.rate || 1500,
              }),
            },
          );

          if (loginResponse.ok) {
            const loginData = await loginResponse.json();
            if (loginData && loginData.access_token) {
              // そのユーザーのトークンを使ってインキュー
              const token = loginData.access_token;
              console.log(`Logged in as ${user.trainer_name}, token prefix: ${token.substring(0, 20)}...`);
              
              // デバッグ: トークンのペイロードを確認
              try {
                const parts = token.split('.');
                if (parts.length === 3) {
                  const payload = JSON.parse(atob(parts[1]));
                  console.log('Token payload:', payload);
                }
              } catch (e) {
                console.error('Failed to decode token:', e);
              }
              
              const enqueueResponse = await fetch(
                `${API_BASE_URL}/api/queue/join`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    selected_roles: allRoles,
                    blocking: [],
                  }),
                },
              );

              if (enqueueResponse.ok) {
                enqueuedCount++;
                console.log(`Enqueued user: ${user.trainer_name}`);
                setDebugMessage(
                  `インキュー中... ${i + 1}/${users.length} (${user.trainer_name})`,
                );

                // 少し待機してから次のユーザー
                await new Promise((resolve) => setTimeout(resolve, 200));
              } else {
                // エラーレスポンスの詳細を取得
                const errorText = await enqueueResponse.text();
                console.error(`Failed to enqueue user ${user.trainer_name}: ${enqueueResponse.status} - ${errorText}`);
                setDebugMessage(
                  `エラー: ${user.trainer_name} のインキューに失敗 (${enqueueResponse.status})`,
                );
              }
            } else {
              console.error(`Failed to get access token for ${user.trainer_name}`);
            }
          } else {
            const errorText = await loginResponse.text();
            console.error(`Failed to login dummy user ${user.trainer_name}: ${loginResponse.status} - ${errorText}`);
          }
        } catch (error) {
          console.error(`Failed to enqueue user ${user.trainer_name}:`, error);
        }
      }

      setDebugMessage(`✅ インキュー完了: ${enqueuedCount}/${users.length}人`);
      alert(`${enqueuedCount}人をインキューしました`);
    } catch (error) {
      console.error("Mass enqueue error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "エラーが発生しました";
      setDebugMessage(`❌ ${errorMessage}`);
      alert(errorMessage);
    } finally {
      setDebugLoading(false);
    }
  };

  // テスト用: 全員結果報告
  const handleMassReport = async () => {
    setDebugLoading(true);
    setDebugMessage(null);

    try {
      setDebugMessage("ダミーユーザーを取得中...");

      // ダミーユーザー一覧を取得
      const usersResponse = await callApi<{
        users: Array<{ user_id: string; trainer_name: string; rate?: number }>;
      }>("/api/auth/dummy/users");
      if (!usersResponse.data?.users) {
        throw new Error("ダミーユーザーが見つかりません");
      }

      const users = usersResponse.data.users;
      setDebugMessage("進行中の試合を確認中...");

      // 各ユーザーで現在の試合をチェック（最初のユーザーで確認）
      let matchId = null;
      let match = null;

      for (const user of users) {
        try {
          const loginResponse = await callApi("/api/auth/dummy/login", {
            method: "POST",
            body: {
              user_id: user.user_id,
              trainer_name: user.trainer_name,
              rate: user.rate || 1500,
            },
          });

          if (
            loginResponse.status === 200 &&
            loginResponse.data &&
            typeof loginResponse.data === "object" &&
            "access_token" in loginResponse.data
          ) {
            const token = (loginResponse.data as { access_token: string })
              .access_token;
            const matchResponse = await fetch(
              `${API_BASE_URL}/api/matches/current`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              },
            );

            if (matchResponse.ok) {
              const matchData = await matchResponse.json();
              console.log("Match response data:", matchData);
              console.log("Match data status:", matchData?.match?.status);
              console.log("Match team_a:", matchData?.match?.team_a);
              if (
                matchData &&
                matchData.match &&
                matchData.match.status === "matched"
              ) {
                matchId = parseInt(matchData.match.match_id);
                match = matchData.match;
                setDebugMessage(`試合ID ${matchId} の結果を報告中...`);
                break;
              }
            }
          }
        } catch (error) {
          console.error(
            `Failed to check match for user ${user.trainer_name}:`,
            error,
          );
        }
      }

      if (!matchId || !match) {
        throw new Error("進行中の試合が見つかりません");
      }

      // 試合に参加しているプレイヤーを特定
      const teamAPlayers = match.team_a?.players || [];
      const teamBPlayers = match.team_b?.players || [];
      console.log("Team A players:", teamAPlayers);
      console.log("Team B players:", teamBPlayers);
      console.log(
        "Available users:",
        users.map((u) => u.user_id),
      );
      let reportCount = 0;

      // チームAのプレイヤー（勝利報告）
      for (let i = 0; i < teamAPlayers.length; i++) {
        const player = teamAPlayers[i];
        const userId = player.user_id;
        const user = users.find((u) => u.user_id === userId);

        if (user) {
          try {
            const loginResponse = await callApi("/api/auth/dummy/login", {
              method: "POST",
              body: {
                user_id: user.user_id,
                trainer_name: user.trainer_name,
                rate: user.rate || 1500,
              },
            });

            if (
              loginResponse.status === 200 &&
              loginResponse.data &&
              typeof loginResponse.data === "object" &&
              "access_token" in loginResponse.data
            ) {
              const token = (loginResponse.data as { access_token: string })
                .access_token;
              const reportResponse = await fetch(
                `${API_BASE_URL}/api/matches/${matchId}/report`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    result: "A-win",
                    banned_pokemon: "",
                    picked_pokemon: "pikachu",
                    pokemon_move1: "",
                    pokemon_move2: "",
                    violation_report: "",
                  }),
                },
              );

              if (reportResponse.ok) {
                reportCount++;
                setDebugMessage(
                  `報告中... ${reportCount} (${user.trainer_name} - 勝利)`,
                );
                await new Promise((resolve) => setTimeout(resolve, 200));
              }
            }
          } catch (error) {
            console.error(
              `Failed to report for team A player ${user.trainer_name}:`,
              error,
            );
          }
        }
      }

      // チームBのプレイヤー（敗北報告）
      for (let i = 0; i < teamBPlayers.length; i++) {
        const player = teamBPlayers[i];
        const userId = player.user_id;
        const user = users.find((u) => u.user_id === userId);

        if (user) {
          try {
            const loginResponse = await callApi("/api/auth/dummy/login", {
              method: "POST",
              body: {
                user_id: user.user_id,
                trainer_name: user.trainer_name,
                rate: user.rate || 1500,
              },
            });

            if (
              loginResponse.status === 200 &&
              loginResponse.data &&
              typeof loginResponse.data === "object" &&
              "access_token" in loginResponse.data
            ) {
              const token = (loginResponse.data as { access_token: string })
                .access_token;
              const reportResponse = await fetch(
                `${API_BASE_URL}/api/matches/${matchId}/report`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    result: "A-win",
                    banned_pokemon: "",
                    picked_pokemon: "absol",
                    pokemon_move1: "",
                    pokemon_move2: "",
                    violation_report: "",
                  }),
                },
              );

              if (reportResponse.ok) {
                reportCount++;
                setDebugMessage(
                  `報告中... ${reportCount} (${user.trainer_name} - 敗北)`,
                );
                await new Promise((resolve) => setTimeout(resolve, 200));
              }
            }
          } catch (error) {
            console.error(
              `Failed to report for team B player ${user.trainer_name}:`,
              error,
            );
          }
        }
      }

      setDebugMessage(
        `✅ 結果報告完了: ${reportCount}人が報告済み（チームA勝利）`,
      );
      alert(`${reportCount}人の結果報告を完了しました（チームA勝利）`);
    } catch (error) {
      console.error("Mass report error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "エラーが発生しました";
      setDebugMessage(`❌ ${errorMessage}`);
      alert(errorMessage);
    } finally {
      setDebugLoading(false);
    }
  };

  // テスト用: キュー全削除
  const handleClearQueue = async () => {
    setDebugLoading(true);
    setDebugMessage(null);

    try {
      if (!confirm("キューを全て削除しますか？この操作は取り消せません。")) {
        return;
      }

      setDebugMessage("ダミーユーザーを取得中...");

      // ダミーユーザー一覧を取得
      const usersResponse = await callApi<{
        users: Array<{ user_id: string; trainer_name: string; rate?: number }>;
      }>("/api/auth/dummy/users");
      if (!usersResponse.data?.users) {
        throw new Error("ダミーユーザーが見つかりません");
      }

      const users = usersResponse.data.users;
      setDebugMessage(`${users.length}人のユーザーをキューから削除中...`);

      let removedCount = 0;

      // 各ユーザーをキューから削除
      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        try {
          const loginResponse = await callApi("/api/auth/dummy/login", {
            method: "POST",
            body: {
              user_id: user.user_id,
              trainer_name: user.trainer_name,
              rate: user.rate || 1500,
            },
          });

          if (
            loginResponse.status === 200 &&
            loginResponse.data &&
            typeof loginResponse.data === "object" &&
            "access_token" in loginResponse.data
          ) {
            const token = (loginResponse.data as { access_token: string })
              .access_token;
            const leaveResponse = await fetch(
              `${API_BASE_URL}/api/queue/leave`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
              },
            );

            if (leaveResponse.ok) {
              removedCount++;
              setDebugMessage(
                `削除中... ${i + 1}/${users.length} (${user.trainer_name})`,
              );
            }
          }
        } catch (error) {
          // キューにいない場合もあるのでエラーは無視
          console.log(`User ${user.trainer_name} was not in queue`, error);
        }
      }

      setDebugMessage(`✅ キュー削除完了: ${removedCount}人を削除`);
      alert(`${removedCount}人をキューから削除しました`);
    } catch (error) {
      console.error("Clear queue error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "エラーが発生しました";
      setDebugMessage(`❌ ${errorMessage}`);
      alert(errorMessage);
    } finally {
      setDebugLoading(false);
    }
  };

  // ダミーログイン処理
  const handleDummyLogin = async (
    accessToken: string,
    userInfo: {
      user_id: string;
      trainer_name: string;
      discord_username: string;
      rate?: number;
      preferred_role: string;
    },
  ) => {
    try {
      // まず Auth0 セッションからログアウト
      await logout({
        logoutParams: {
          returnTo: `${window.location.origin}?dummy_login=true&token=${encodeURIComponent(accessToken)}&user=${encodeURIComponent(JSON.stringify(userInfo))}`,
        },
      });
    } catch (error) {
      console.error("Auth0 logout failed:", error);
      alert("ログアウトに失敗しました。ダミーログインを中止します。");
      // ログアウトが失敗した場合はダミーログインを実行しない
    }
  };

  // ローディング中の表示
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-2xl mb-2">⏳</div>
            <p className="text-gray-600">認証情報を確認中...</p>
          </div>
        </div>
      </div>
    );
  }

  // 管理者でない場合は何も表示しない
  if (!isLoggedIn || !isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <h1 className="text-2xl font-bold text-red-800 mb-2">
            🔧 管理者コントロールパネル
          </h1>
          <p className="text-red-600 text-sm">
            このページは管理者専用です。すべての操作はログに記録されます。
          </p>
        </div>

        {/* ユーザー情報 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">👤 現在のユーザー情報</h2>
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-medium">ユーザーID:</span>{" "}
              {currentUserId || "N/A"}
            </p>
            <p>
              <span className="font-medium">トレーナー名:</span>{" "}
              {dummyAuth.user?.trainer_name || "N/A"}
            </p>
            <p>
              <span className="font-medium">レート:</span>{" "}
              {dummyAuth.user?.rate || "N/A"}
            </p>
          </div>
        </div>

        {/* タブナビゲーション */}
        <div className="mb-6">
          <nav className="flex space-x-8 border-b border-gray-200">
            <button
              onClick={() => setActiveTab("overview")}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "overview"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              概要・デバッグ
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "users"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              ユーザー管理
            </button>
            <button
              onClick={() => setActiveTab("matches")}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "matches"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              試合管理
            </button>
            <button
              onClick={() => setActiveTab("content")}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "content"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              コンテンツ管理
            </button>
            <button
              onClick={() => setActiveTab("seasons")}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "seasons"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              シーズン管理
            </button>
          </nav>
        </div>

        {/* タブコンテンツ */}
        {activeTab === "users" && <AdminUserManagement />}
        {activeTab === "matches" && <AdminMatchManagement />}
        {activeTab === "content" && <AdminContentManager />}
        {activeTab === "seasons" && <AdminSeasonManagement />}

        {activeTab === "overview" && (
          <div>
            {/* 概要・デバッグコンテンツ */}

            {/* キューの現在状況 */}
            {queueInfo && (
              <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">
                  📊 キューの現在状況
                </h2>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {queueInfo.total_waiting}
                    </div>
                    <div className="text-sm text-blue-700">
                      待機中のプレイヤー
                    </div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {queueInfo.ongoing_matches}
                    </div>
                    <div className="text-sm text-green-700">進行中の試合</div>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {queueInfo.average_wait_time
                        ? Math.round(queueInfo.average_wait_time / 60)
                        : 10}
                    </div>
                    <div className="text-sm text-yellow-700">
                      予想待機時間（分）
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* デバッグモード */}
            <div className="bg-yellow-50 border-2 border-dashed border-yellow-400 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-bold text-yellow-800 mb-2">
                🐛 デバッグモード
              </h2>
              <p className="text-sm text-yellow-700 mb-4">
                管理者専用: 試合結果集計 → マッチメイキングの順で実行します。
                <br />
                管理者以外には表示されません。
              </p>
              <div className="space-y-3">
                <button
                  onClick={handleDebugTriggerMatchmaking}
                  disabled={debugLoading}
                  className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                >
                  {debugLoading ? "実行中..." : "マッチメイキングを手動実行"}
                </button>
                {debugMessage && (
                  <div className="mt-3 p-3 bg-yellow-100 border border-yellow-300 rounded text-sm text-yellow-800">
                    {debugMessage}
                  </div>
                )}
              </div>
            </div>

            {/* デバッグ機能 */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* マッチメイキング制御 */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold mb-4">
                  🎮 マッチメイキング制御
                </h3>
                <div className="space-y-3">
                  <button
                    onClick={handleManualMatchmaking}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    disabled={debugLoading}
                  >
                    {debugLoading
                      ? "実行中..."
                      : "マッチ集計→マッチメイキング実行"}
                  </button>
                  <button
                    onClick={handleCheckQueueStatus}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    キューの状態確認
                  </button>
                </div>

                {/* デバッグメッセージ */}
                {debugMessage && (
                  <div
                    className={`mt-4 p-3 rounded-lg text-sm ${
                      debugMessage.includes("❌")
                        ? "bg-red-50 border border-red-200 text-red-700"
                        : debugMessage.includes("✅")
                          ? "bg-green-50 border border-green-200 text-green-700"
                          : "bg-blue-50 border border-blue-200 text-blue-700"
                    }`}
                  >
                    {debugMessage}
                  </div>
                )}
              </div>

              {/* ユーザー管理 */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold mb-4">👥 ユーザー管理</h3>
                <div className="space-y-3">
                  <button
                    onClick={handleShowDummyUsers}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    ダミーユーザー一覧表示
                  </button>
                  <button
                    onClick={() => navigate("/match_test")}
                    className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    対戦画面をテスト表示
                  </button>
                </div>
              </div>

              {/* システム管理 */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold mb-4">⚙️ システム管理</h3>
                <div className="space-y-3">
                  <button
                    onClick={handleCalculateRanking}
                    className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    ランキング手動計算
                  </button>
                </div>
              </div>

              {/* テスト管理 */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold mb-4">🧪 テスト管理</h3>
                <div className="space-y-3">
                  <button
                    onClick={handleMassEnqueue}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    disabled={debugLoading}
                  >
                    {debugLoading ? "実行中..." : "全員インキュー（10人）"}
                  </button>
                  <button
                    onClick={handleMassReport}
                    className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                    disabled={debugLoading}
                  >
                    {debugLoading ? "実行中..." : "全員結果報告（A勝利）"}
                  </button>
                  <button
                    onClick={handleClearQueue}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    disabled={debugLoading}
                  >
                    {debugLoading ? "実行中..." : "キュー全削除"}
                  </button>
                </div>
              </div>

              {/* ダミーログイン機能 */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold mb-4">🔑 認証制御</h3>
                <div className="space-y-3">
                  <DummyLogin onLogin={handleDummyLogin} />
                  <button
                    onClick={() => {
                      dummyAuth.logout();
                      alert("ログアウトしました");
                      navigate("/");
                    }}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    ログアウト
                  </button>
                </div>
              </div>
            </div>

            {/* 注意事項 */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
              <h3 className="text-yellow-800 font-medium mb-2">⚠️ 注意事項</h3>
              <ul className="text-yellow-700 text-sm space-y-1 list-disc list-inside">
                <li>すべての管理操作はログに記録されます</li>
                <li>手動マッチメイキングは本番環境で実行しないでください</li>
                <li>
                  ダミーユーザーログインは開発・テスト目的でのみ使用してください
                </li>
                <li>このページのURLは他の人に共有しないでください</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminControl;
