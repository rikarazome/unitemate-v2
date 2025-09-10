import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import { getPokemonById } from "../data/pokemon";
import { getBadgeSync } from "../hooks/useBadges";
import { useAuth0 } from "@auth0/auth0-react";
import { useUser } from "../hooks/useUser";
import {
  useUserInfo,
  useQueueInfo,
  useMatchQueue,
  useMasterData,
  type UserInfo,
} from "../hooks/useUnitemateApi";
import ProfileEditModal from "./ProfileEditModal";
import SeasonDataModal from "./SeasonDataModal";
import NamePlate from "./NamePlate";
import MatchScreen from "./MatchScreen";
import { QueueStatus } from "./QueueStatus";
import RoleSelector from "./RoleSelector";
import DummyLogin from "./DummyLogin";
import RankingScreen from "./RankingScreen";
import { useUnitemateApi } from "../hooks/useUnitemateApi";
import { useDummyAuth } from "../hooks/useDummyAuth";
import { useWebSocket } from "../hooks/useWebSocket";
import { Header } from "./Header";
// import { useAdmin } from '../hooks/useAdmin'; // eslint-disable-line @typescript-eslint/no-unused-vars
import type { MatchData } from "./MatchScreen";
import type { LfgRole } from "../types/lfg";
import type { Setting } from "../types/common";

// タブの定義
type TabId = "rules" | "mypage" | "match" | "ranking";

interface Tab {
  id: TabId;
  label: string;
  icon?: string;
}

const tabs: Tab[] = [
  { id: "rules", label: "ルール", icon: "📋" },
  { id: "mypage", label: "マイページ", icon: "👤" },
  { id: "match", label: "マッチング", icon: "⚔️" },
  { id: "ranking", label: "ランキング", icon: "🏆" },
];

// 各タブコンポーネント
const RulesTab: React.FC = () => {
  const { masterData, loading: masterDataLoading } = useMasterData();

  // マスターデータから設定値を取得
  const getRulesContent = () => {
    if (!masterData?.settings) return "";
    const rulesContentSetting = masterData.settings.find(
      (s: Setting) => s.id === "rules_content",
    );
    return rulesContentSetting?.value ? String(rulesContentSetting.value) : "";
  };

  const getAnnouncementContent = () => {
    if (!masterData?.settings) return "";
    const announcementSetting = masterData.settings.find(
      (s: Setting) => s.id === "announcement_content",
    );
    return announcementSetting?.value ? String(announcementSetting.value) : "";
  };

  if (masterDataLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl lg:text-2xl font-bold text-gray-800 mb-4 lg:mb-6">
          ルール・お知らせ
        </h2>
        <div className="text-center py-8">
          <div className="text-2xl mb-2">⏳</div>
          <p className="text-gray-600">ルール・お知らせを読み込み中...</p>
        </div>
      </div>
    );
  }

  const rulesContent = getRulesContent();
  const announcementContent = getAnnouncementContent();

  return (
    <div className="space-y-6">
      <h2 className="text-xl lg:text-2xl font-bold text-gray-800 mb-4 lg:mb-6">
        ルール・お知らせ
      </h2>

      {/* お知らせ */}
      {announcementContent && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center text-yellow-800">
            <span className="text-xl mr-2">📢</span>
            お知らせ
          </h3>
          <div className="text-yellow-700 prose prose-sm max-w-none">
            <ReactMarkdown>{announcementContent}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* ルール */}
      {rulesContent ? (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <span className="text-xl mr-2">📋</span>
            ルール
          </h3>
          <div className="text-gray-700 prose prose-sm max-w-none">
            <ReactMarkdown>{rulesContent}</ReactMarkdown>
          </div>
        </div>
      ) : (
        // フォールバック用のデフォルトルール
        <>
          {/* 基本ルール */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <span className="text-xl mr-2">📋</span>
              基本ルール
            </h3>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start">
                <span className="text-green-500 mr-2 mt-1">✓</span>
                <span>1試合は最大10分間です</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2 mt-1">✓</span>
                <span>チームは5vs5で構成されます</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2 mt-1">✓</span>
                <span>同じポケモンの重複選択はできません</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2 mt-1">✓</span>
                <span>試合開始後の途中離脱はペナルティが科されます</span>
              </li>
            </ul>
          </div>

          {/* マッチングルール */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <span className="text-xl mr-2">⚔️</span>
              マッチングルール
            </h3>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start">
                <span className="text-blue-500 mr-2 mt-1">•</span>
                <span>レート差±200以内でマッチングを行います</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-500 mr-2 mt-1">•</span>
                <span>待機時間が長い場合、レート差は徐々に拡大されます</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-500 mr-2 mt-1">•</span>
                <span>
                  希望ロールを設定することで、バランスの取れたチーム編成を目指します
                </span>
              </li>
            </ul>
          </div>

          {/* レーティングシステム */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <span className="text-xl mr-2">📊</span>
              レーティングシステム
            </h3>
            <div className="space-y-3 text-gray-700">
              <p>
                <strong>初期レート:</strong> 1500
              </p>
              <p>
                <strong>レート変動:</strong> 試合結果により±10〜50ポイント変動
              </p>
              <p>
                <strong>ランキング:</strong>{" "}
                最高レートを基準に順位が決定されます
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const MyPageTab: React.FC = () => {
  const { isAuthenticated, user, loginWithRedirect, logout } = useAuth0();
  const dummyAuth = useDummyAuth();
  const {
    userInfo,
    loading: userInfoLoading,
    refetch: refetchUserInfo,
  } = useUserInfo();

  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [isSeasonDataOpen, setIsSeasonDataOpen] = useState(false);

  const handleLogin = () => {
    loginWithRedirect({
      authorizationParams: {
        connection: "discord",
      },
    });
  };

  const handleLogout = () => {
    logout({ logoutParams: { returnTo: window.location.origin } });
  };

  const handleDummyLogin = (accessToken: string, userInfo: UserInfo) => {
    // UserInfoをDummyUserに変換
    const dummyUser = {
      user_id: userInfo.user_id,
      discord_username: userInfo.discord_username || "",
      trainer_name: userInfo.trainer_name,
      rate: userInfo.rate || 1500,
      preferred_role: userInfo.preferred_roles?.[0] || "ALL",
      is_dummy: true,
    };
    dummyAuth.login(accessToken, dummyUser);
  };

  const handleDummyLogout = () => {
    dummyAuth.logout();
  };

  // URL パラメータからダミーログイン情報を処理
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isDummyLogin = urlParams.get("dummy_login");
    const token = urlParams.get("token");
    const userJson = urlParams.get("user");

    if (isDummyLogin === "true" && token && userJson) {
      try {
        const userInfo = JSON.parse(decodeURIComponent(userJson));
        dummyAuth.login(decodeURIComponent(token), userInfo);
        alert(`${userInfo.trainer_name} としてログインしました`);

        // URL パラメータをクリア
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      } catch (error) {
        console.error("Failed to process dummy login:", error);
      }
    }
  }, [dummyAuth]);

  // ダミー認証とAuth0認証の統合判定
  const isUserAuthenticated = isAuthenticated || dummyAuth.isAuthenticated;

  if (!isUserAuthenticated) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl lg:text-2xl font-bold text-gray-800 mb-4 lg:mb-6">
          マイページ
        </h2>

        <div className="text-center">
          <div className="bg-gradient-to-br from-purple-100 to-orange-100 rounded-xl p-8 border border-purple-200/50 shadow-lg">
            <div className="mb-6">
              <span className="text-6xl">🎮</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              ログインしてマイページを表示
            </h3>
            <p className="text-gray-600 mb-6">
              Discordアカウントでログインして、プロフィールや試合履歴を確認しましょう
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={handleLogin}
                className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-8 py-3 rounded-lg font-medium hover:from-purple-600 hover:to-purple-700 transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:scale-105"
              >
                🎮 Discordでログイン
              </button>

              {/* テスト用ログイン（環境変数で制御） */}
              {console.log('VITE_ENABLE_DUMMY_LOGIN:', import.meta.env.VITE_ENABLE_DUMMY_LOGIN)}
              {import.meta.env.VITE_ENABLE_DUMMY_LOGIN === 'true' && (
                <>
                  <div className="text-gray-400">または</div>

                  <DummyLogin
                    onLogin={(token, dummyUser) =>
                      handleDummyLogin(token, {
                    user_id: dummyUser.user_id,
                    auth0_sub: "",
                    discord_username: dummyUser.discord_username,
                    discord_avatar_url: "",
                    trainer_name: dummyUser.trainer_name,
                    rate: dummyUser.rate,
                    max_rate: dummyUser.rate,
                    preferred_roles: [dummyUser.preferred_role],
                    favorite_pokemon: [],
                    current_badge: undefined,
                    current_badge_2: undefined,
                    bio: "",
                    match_count: 0,
                    win_count: 0,
                    win_rate: 0,
                    penalty_count: 0,
                    penalty_correction: 0,
                    created_at: Date.now(),
                    updated_at: Date.now(),
                  })
                }
              />
                </>
              )}
            </div>

            {/* プライバシーポリシーリンク */}
            <div className="mt-6 text-center">
              <Link
                to="/privacy"
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors underline"
              >
                プライバシーポリシー
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 勲章IDを直接使用（NamePlateコンポーネントが内部でBadgeデータを取得）
  const currentBadgeId = userInfo?.current_badge;
  const currentBadgeId2 = userInfo?.current_badge_2;

  return (
    <div className="space-y-6">
      <h2 className="text-xl lg:text-2xl font-bold text-gray-800 mb-4 lg:mb-6">
        マイページ
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        {/* プロフィール情報 */}
        <div className="bg-gradient-to-br from-purple-50 to-orange-50 rounded-xl shadow-lg p-6 border border-purple-200/50">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">プロフィール</h3>
          </div>

          {!userInfo?.trainer_name && (
            <div className="mb-4 p-3 bg-orange-100 border border-orange-300 rounded-lg">
              <p className="text-sm text-orange-800">
                <span className="font-semibold">👋 ようこそ！</span>
                編集ボタンからトレーナー名を設定してください。
              </p>
            </div>
          )}
          <div className="space-y-3">
            {/* ネームプレート */}
            <div className="flex justify-center">
              <NamePlate
                trainerName={
                  userInfo?.trainer_name ||
                  dummyAuth.user?.trainer_name ||
                  "トレーナー名未設定"
                }
                discordUsername={
                  dummyAuth.user?.discord_username || user?.nickname
                }
                twitterId={userInfo?.twitter_id || undefined}
                rate={userInfo?.rate || dummyAuth.user?.rate || 1500}
                maxRate={userInfo?.max_rate || 1500}
                avatarUrl={user?.picture}
                primaryBadgeId={currentBadgeId}
                secondaryBadgeId={currentBadgeId2}
                className="mb-2"
              />
            </div>

            {/* ダミーユーザー表示 */}
            {dummyAuth.isAuthenticated && (
              <div className="mb-4 p-2 bg-orange-100 border border-orange-300 rounded-lg text-center">
                <p className="text-xs text-orange-800">
                  🧪 <strong>テスト用アカウント</strong>
                </p>
              </div>
            )}

            {/* 編集・ログアウトボタン */}
            <div className="grid grid-cols-2 gap-0 mt-4">
              <div className="flex justify-center">
                <button
                  onClick={async () => {
                    console.log("Edit button clicked", { userInfo });
                    try {
                      // プロフィール編集を開く前に、ユーザーが存在しない場合は再取得を試行
                      if (!userInfo) {
                        console.log("No user info, refetching...");
                        await refetchUserInfo();
                        // 再取得後も少し待つ
                        await new Promise((resolve) =>
                          setTimeout(resolve, 500),
                        );
                      }
                      console.log("Opening profile edit modal");
                      setIsProfileEditOpen(true);
                    } catch (error) {
                      console.error("Error in edit button click:", error);
                      // エラーが発生してもモーダルは開く（ユーザーが手動で作成できるように）
                      setIsProfileEditOpen(true);
                    }
                  }}
                  className="bg-gradient-to-r from-orange-400 to-orange-500 text-white px-3 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-medium hover:from-orange-500 hover:to-orange-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 w-20 sm:w-24 whitespace-nowrap"
                >
                  編集
                </button>
              </div>
              <div className="flex justify-center">
                <button
                  onClick={
                    dummyAuth.isAuthenticated ? handleDummyLogout : handleLogout
                  }
                  className="bg-gradient-to-r from-gray-400 to-gray-500 text-white px-3 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-medium hover:from-gray-500 hover:to-gray-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 w-20 sm:w-24 whitespace-nowrap flex items-center justify-center"
                >
                  ログアウト
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ステータス情報 */}
        <div className="bg-gradient-to-br from-orange-50 to-purple-50 rounded-xl shadow-lg p-6 border border-orange-200/50">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">ステータス</h3>
            <button
              onClick={() => setIsSeasonDataOpen(true)}
              className="text-purple-600 hover:text-purple-800 text-sm font-medium"
            >
              過去データ
            </button>
          </div>
          {userInfoLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500 mx-auto"></div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">現在のレート:</span>
                <span className="font-semibold">{userInfo?.rate || 1500}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">最高レート:</span>
                <span className="font-semibold">
                  {userInfo?.max_rate || 1500}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">総試合数:</span>
                <span className="font-semibold">
                  {userInfo?.match_count || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">勝利数:</span>
                <span className="font-semibold">
                  {userInfo?.win_count || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">勝率:</span>
                <span className="font-semibold">
                  {userInfo?.win_rate || 0}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">ペナルティ:</span>
                <span
                  className={`font-semibold ${
                    (userInfo?.penalty_count || 0) > 0
                      ? "text-red-600"
                      : "text-green-600"
                  }`}
                >
                  {userInfo?.penalty_count || 0}
                </span>
              </div>
              {(currentBadgeId || currentBadgeId2) && (
                <div className="flex justify-between">
                  <span className="text-gray-600">現在の勲章:</span>
                  <span className="font-semibold">
                    {[
                      currentBadgeId ? getBadgeSync(currentBadgeId)?.display : null,
                      currentBadgeId2
                        ? getBadgeSync(currentBadgeId2)?.display
                        : null,
                    ]
                      .filter(Boolean)
                      .join("、")}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 最近の試合履歴 */}
      <div className="bg-gradient-to-br from-white to-purple-50/30 rounded-xl shadow-lg p-6 border border-purple-100">
        <h3 className="text-lg font-semibold mb-4">最近の試合履歴</h3>
        {userInfoLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : !userInfo?.latest_matches ||
          userInfo.latest_matches.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            試合履歴がありません
          </div>
        ) : (
          <div className="space-y-2">
            {userInfo.latest_matches.slice(0, 10).map((record) => {
              // winlose: 0=lose, 1=win, 2=invalid
              const isWin = record.winlose === 1;
              const isInvalid = record.winlose === 2;

              console.log("Pokemon ID from record:", record.pokemon);
              const pokemonData = record.pokemon
                ? getPokemonById(record.pokemon)
                : null;
              console.log("Pokemon data:", pokemonData);

              // 日時を M/D HH:MM 形式でフォーマット
              const date = new Date(record.started_date * 1000);
              const formattedDate = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;

              return (
                <div
                  key={record.match_id}
                  className="grid grid-cols-4 items-center gap-2 sm:gap-4 lg:gap-6 py-2 sm:py-3 lg:py-3 px-2 sm:px-4 lg:px-6"
                >
                  {/* 日時 */}
                  <div className="text-center min-w-0">
                    <span className="text-xs sm:text-sm lg:text-base text-gray-700 font-semibold whitespace-nowrap">
                      {formattedDate}
                    </span>
                  </div>

                  {/* ポケモンアイコン */}
                  <div className="flex justify-center">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12">
                      {pokemonData?.icon_url ? (
                        <img
                          src={pokemonData.icon_url}
                          alt={pokemonData.name_ja}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            console.log(
                              "Failed to load image:",
                              pokemonData.icon_url,
                            );
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-xs sm:text-sm lg:text-base text-gray-400">
                            ?
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 勝敗 */}
                  <div className="text-center">
                    <span
                      className={`text-sm sm:text-base lg:text-lg font-bold ${
                        isInvalid
                          ? "text-gray-500"
                          : isWin
                            ? "text-orange-500"
                            : "text-cyan-500"
                      }`}
                    >
                      {isInvalid ? "INVALID" : isWin ? "WIN" : "LOSE"}
                    </span>
                  </div>

                  {/* レート増減 */}
                  <div className="text-center">
                    <span
                      className={`text-sm sm:text-base lg:text-lg font-bold ${
                        record.rate_delta >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {record.rate_delta >= 0 ? "+" : ""}
                      {record.rate_delta}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* モーダル */}
      <ProfileEditModal
        isOpen={isProfileEditOpen}
        onClose={() => setIsProfileEditOpen(false)}
        user={userInfo}
        onSuccess={async () => {
          setIsProfileEditOpen(false);
          await refetchUserInfo(); // ユーザー情報を再取得
        }}
      />

      <SeasonDataModal
        isOpen={isSeasonDataOpen}
        onClose={() => setIsSeasonDataOpen(false)}
        user={userInfo}
      />
    </div>
  );
};

interface MatchTabProps {
  selectedRoles: LfgRole[];
  setSelectedRoles: (roles: LfgRole[]) => void;
}

const MatchTab: React.FC<MatchTabProps> = ({
  selectedRoles,
  setSelectedRoles,
}) => {
  const { isAuthenticated, user } = useAuth0();
  const dummyAuth = useDummyAuth();
  const { userInfo, refetch: _refetchUserInfo } = useUserInfo();
  const { queueInfo, error: queueError, refetch: refetchQueueInfo } = useQueueInfo();
  const { unitemateApi } = useUnitemateApi();

  // WebSocket接続とリアルタイム更新
  const { 
    isConnected: _wsConnected, 
    subscribeMatch,
    unsubscribeMatch,
    matchDynamicData: _matchDynamicData
  } = useWebSocket({
    onQueueUpdate: () => {
      console.log("[WebSocket] Queue update received, refetching queue info...");
      refetchQueueInfo?.();
    },
    onMatchUpdate: (dynamicData) => {
      console.log("[WebSocket] Match dynamic update received:", dynamicData);
      console.log("[WebSocket] Current match exists:", !!currentMatch);
      // WebSocketから受信した動的データでcurrentMatchを部分更新
      // currentMatchがnullでも、setCurrentMatchで最新の状態を取得して更新
      if (dynamicData) {
        console.log("[WebSocket] Updating match state with lobby_id:", dynamicData.lobby_id);
        setCurrentMatch(prev => {
          console.log("[WebSocket] Previous state:", prev);
          // prevがnullの場合は更新をスキップ、存在する場合のみ更新
          if (!prev) {
            console.log("[WebSocket] Previous state is null, skipping update");
            return prev;
          }
          const newState = {
            ...prev,
            lobby_id: dynamicData.lobby_id,
            host_user_id: dynamicData.host_user_id,
            status: dynamicData.status || prev.status,
            report_count: dynamicData.report_count
          };
          console.log("[WebSocket] New state:", newState);
          return newState;
        });
      } else {
        console.log("[WebSocket] No dynamicData received");
      }
    },
    onMatchSubscribed: (dynamicData) => {
      console.log("[WebSocket] Match subscription confirmed:", dynamicData);
      // 購読時も動的データのみで部分更新
      if (currentMatch && dynamicData) {
        setCurrentMatch(prev => prev ? {
          ...prev,
          lobby_id: dynamicData.lobby_id,
          host_user_id: dynamicData.host_user_id,
          status: dynamicData.status || prev.status,
          report_count: dynamicData.report_count
        } : prev);
      }
    },
    onMatchFound: async (matchData: any) => {
      console.log("[WebSocket] Match found, loading full match data via HTTP...", matchData);
      if (matchData && matchData.match_id && matchData.match_id !== "0") {
        // match_foundの場合は、HTTPで完全な試合データを取得
        await refreshMatchData();
      }
    },
  });

  // ディスコードサーバー参加確認関数
  // Discord確認結果の状態管理
  const [discordMembershipCache, setDiscordMembershipCache] = React.useState<{
    result: boolean;
    timestamp: number;
  } | null>(null);
  
  // Discord membership確認済みかどうか
  const [isDiscordMember, setIsDiscordMember] = React.useState<boolean | null>(null);
  const [checkingDiscord, setCheckingDiscord] = React.useState(false);

  const checkDiscordServerMembership =
    React.useCallback(async (forceCheck = false): Promise<boolean> => {
      try {
        // Auth0のDiscord接続確認
        if (!user || !user.sub?.startsWith("oauth2|discord|")) {
          console.log("Discord connection not found");
          return false;
        }

        // キャッシュがあり、1時間以内で、強制チェックでない場合はキャッシュを返す
        if (!forceCheck && discordMembershipCache) {
          const oneHour = 60 * 60 * 1000; // 1時間（ミリ秒）
          const isValid = Date.now() - discordMembershipCache.timestamp < oneHour;
          if (isValid) {
            console.log("Using cached Discord membership result:", discordMembershipCache.result);
            return discordMembershipCache.result;
          }
        }

        console.log("Checking Discord server membership...");
        const response = await unitemateApi.checkDiscordServerMembership();
        console.log("Discord membership API response:", response);
        const isMember = response?.is_member === true;
        console.log("Discord membership result:", isMember);
        
        // 結果をキャッシュ
        setDiscordMembershipCache({
          result: isMember,
          timestamp: Date.now()
        });
        
        return isMember;
      } catch (error) {
        console.error("Discord server membership check failed:", error);
        console.error("Error details:", JSON.stringify(error, null, 2));
        // エラーの場合は確認不可として扱う（false）
        return false;
      }
    }, [user, unitemateApi, discordMembershipCache]);
  const {
    isInQueue,
    loading: matchLoading,
    error: matchError,
    joinQueue,
    leaveQueue,
    queueEntry,
  } = useMatchQueue();

  // 実効ペナルティを計算
  const effectivePenalty = React.useMemo(() => {
    if (!userInfo) return 0;
    return Math.max(
      0,
      (userInfo.penalty_count || 0) - (userInfo.penalty_correction || 0),
    );
  }, [userInfo]);

  // ペナルティ6以上でマッチング禁止
  const isPenaltyBanned = React.useMemo(() => {
    return effectivePenalty >= 6;
  }, [effectivePenalty]);

  // ペナルティタイムアウト状況をチェック
  const isPenaltyTimeout = React.useMemo(() => {
    if (!userInfo?.penalty_timeout_until) return false;
    return Date.now() / 1000 < userInfo.penalty_timeout_until;
  }, [userInfo?.penalty_timeout_until]);

  const penaltyTimeoutRemaining = React.useMemo(() => {
    if (!userInfo?.penalty_timeout_until || !isPenaltyTimeout) return 0;
    return Math.max(0, userInfo.penalty_timeout_until - Date.now() / 1000);
  }, [userInfo?.penalty_timeout_until, isPenaltyTimeout]);

  // 現在の試合データ
  const [currentMatch, setCurrentMatch] = React.useState<MatchData | null>(
    null,
  );
  const [showTestMatch, setShowTestMatch] = React.useState(false);
  const [loadingCurrentMatch, setLoadingCurrentMatch] = React.useState(true); // 初期値をtrueに変更

  // インキュー中の選択ロールを反映
  React.useEffect(() => {
    console.log(
      "queueEntry full details:",
      JSON.stringify(queueEntry, null, 2),
    );
    if (queueEntry?.selected_roles && queueEntry.selected_roles.length > 0) {
      console.log(
        "Setting selected roles from queueEntry:",
        queueEntry.selected_roles,
      );
      setSelectedRoles(queueEntry.selected_roles as LfgRole[]);
    } else if (queueEntry) {
      console.log("queueEntry exists but selected_roles is missing or empty");
    }
  }, [queueEntry, setSelectedRoles]);

  // ページロード時に現在の試合状態をチェック
  React.useEffect(() => {
    if (!(isAuthenticated || dummyAuth.isAuthenticated) || !userInfo) return;

    const checkCurrentMatch = async () => {
      console.log("checkCurrentMatch: Starting, setting loading to true");
      setLoadingCurrentMatch(true);
      try {
        console.log("checkCurrentMatch: Calling getCurrentMatch API");
        const response = await unitemateApi.getCurrentMatch();
        console.log("checkCurrentMatch: API response:", response);

        // 新しいAPIは{match: {...}}形式を返す
        const responseData = response as { match: MatchData };
        const matchInfo = responseData.match;

        if (matchInfo && matchInfo.match_id && matchInfo.match_id !== "0") {
          console.log("checkCurrentMatch: Match found, using response data");
          // 新しいAPIは既にフロントエンド形式なのでそのまま使用
          const matchData: MatchData = matchInfo;

          console.log(
            "checkCurrentMatch: Setting currentMatch state",
            matchData,
          );
          setCurrentMatch(matchData);
        } else {
          console.log("checkCurrentMatch: No active match found");
        }
      } catch (error) {
        console.error("checkCurrentMatch: Error occurred:", error);
        // エラーの場合は試合なしとして扱う
      } finally {
        console.log("checkCurrentMatch: Setting loading to false");
        setLoadingCurrentMatch(false);
      }
    };

    checkCurrentMatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, userInfo?.user_id, unitemateApi]);

  // Discord参加確認（タブ表示時）
  React.useEffect(() => {
    const checkDiscord = async () => {
      // Auth0認証がある場合のみチェック
      if (!user || !user.sub?.startsWith("oauth2|discord|")) {
        setIsDiscordMember(false);
        return;
      }
      
      setCheckingDiscord(true);
      try {
        const isMember = await checkDiscordServerMembership();
        setIsDiscordMember(isMember);
        console.log("Discord membership status on tab load:", isMember);
      } catch (error) {
        console.error("Failed to check Discord membership:", error);
        setIsDiscordMember(false);
      } finally {
        setCheckingDiscord(false);
      }
    };
    
    checkDiscord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // 自動試合画面切り替え機能: キューデータから試合開始を検知
  React.useEffect(() => {
    // 条件チェック: ログイン済み、ユーザー情報あり、試合中でない、キューデータあり
    if (!userInfo || currentMatch || !queueInfo?.ongoing_match_players) {
      return;
    }

    // ongoing_match_playersに自分のIDが含まれているかチェック
    if (queueInfo.ongoing_match_players.includes(userInfo.user_id)) {
      console.log(
        "Auto-match detection: Found user in ongoing_match_players, fetching match info...",
      );

      // 試合情報を取得して画面を切り替え
      const fetchMatchInfo = async () => {
        try {
          const response = await unitemateApi.getCurrentMatch();
          console.log("Auto-match detection: Retrieved match info:", response);
          const responseData = response as { match: MatchData };

          // 新しいAPIは{match: {...}}形式を返す
          const matchInfo = responseData.match;

          if (matchInfo && matchInfo.match_id && matchInfo.match_id !== "0") {
            // 新しいAPIは既にフロントエンド形式なのでそのまま使用
            const matchData: MatchData = matchInfo;

            console.log(
              "Auto-match detection: Setting current match and switching to match screen",
            );
            setCurrentMatch(matchData);
          }
        } catch (error) {
          console.error(
            "Auto-match detection: Failed to fetch match info:",
            error,
          );
        }
      };

      fetchMatchInfo();
    }
  }, [queueInfo, userInfo, currentMatch, unitemateApi]);

  // ランダムで自分をチームに追加する関数（現在未使用）
  /*
  const createTestMatchWithCurrentUser = (): MatchData => {
    if (!userInfo) return testMatchData;

    const currentUserPlayer: MatchPlayer = {
      user_id: userInfo.user_id,
      trainer_name: userInfo.trainer_name,
      discord_username: user?.nickname,
      discord_avatar_url: user?.picture,
      twitter_id: userInfo.twitter_id || undefined,
      rate: userInfo.rate || 1500,
      max_rate: userInfo.max_rate || 1500,
      current_badge: userInfo.current_badge,
      current_badge_2: userInfo.current_badge_2
    };

    // ランダムでチームA (0) またはチームB (1) を選択
    const randomTeam = Math.random() < 0.5 ? 'A' : 'B';
    
    const modifiedTestData = { ...testMatchData };
    
    if (randomTeam === 'A') {
      // チームAの最後のプレイヤーを自分に置き換え
      modifiedTestData.team_a = {
        ...modifiedTestData.team_a,
        players: [...modifiedTestData.team_a.players.slice(0, 4), currentUserPlayer]
      };
    } else {
      // チームBの最後のプレイヤーを自分に置き換え
      modifiedTestData.team_b = {
        ...modifiedTestData.team_b,
        players: [...modifiedTestData.team_b.players.slice(0, 4), currentUserPlayer]
      };
    }

    return modifiedTestData;
  };
  */

  // テスト用マッチデータ
  const testMatchData: MatchData = {
    match_id: "test-match-123",
    team_a: {
      team_id: "A",
      team_name: "チームA",
      is_first_attack: true,
      voice_channel: "11",
      players: [
        {
          user_id: "1",
          trainer_name: "プレイヤー1",
          discord_username: "Player1#1234",
          discord_avatar_url: "https://cdn.discordapp.com/embed/avatars/0.png",
          twitter_id: "player1",
          rate: 1824,
          max_rate: 1850,
          current_badge: "badge1",
          current_badge_2: "badge2",
        },
        {
          user_id: "2",
          trainer_name: "プレイヤー2",
          discord_username: "Player2#5678",
          discord_avatar_url: "https://cdn.discordapp.com/embed/avatars/1.png",
          rate: 1756,
          max_rate: 1780,
        },
        {
          user_id: "3",
          trainer_name: "プレイヤー3",
          discord_username: "Player3#9012",
          discord_avatar_url: "https://cdn.discordapp.com/embed/avatars/2.png",
          rate: 1650,
          max_rate: 1700,
        },
        {
          user_id: "4",
          trainer_name: "プレイヤー4",
          discord_username: "Player4#3456",
          discord_avatar_url: "https://cdn.discordapp.com/embed/avatars/3.png",
          rate: 1580,
          max_rate: 1620,
        },
        {
          user_id: "5",
          trainer_name: "プレイヤー5",
          discord_username: "Player5#7890",
          discord_avatar_url: "https://cdn.discordapp.com/embed/avatars/4.png",
          rate: 1520,
          max_rate: 1550,
        },
      ],
    },
    team_b: {
      team_id: "B",
      team_name: "チームB",
      is_first_attack: false,
      voice_channel: "12",
      players: [
        {
          user_id: "6",
          trainer_name: "プレイヤー6",
          discord_username: "Player6#1111",
          discord_avatar_url: "https://cdn.discordapp.com/embed/avatars/5.png",
          twitter_id: "player6",
          rate: 1780,
          max_rate: 1820,
        },
        {
          user_id: "7",
          trainer_name: "プレイヤー7",
          discord_username: "Player7#2222",
          discord_avatar_url: "https://cdn.discordapp.com/embed/avatars/0.png",
          rate: 1720,
          max_rate: 1750,
        },
        {
          user_id: "8",
          trainer_name: "プレイヤー8",
          discord_username: "Player8#3333",
          discord_avatar_url: "https://cdn.discordapp.com/embed/avatars/1.png",
          rate: 1680,
          max_rate: 1710,
        },
        {
          user_id: "9",
          trainer_name: "プレイヤー9",
          discord_username: "Player9#4444",
          discord_avatar_url: "https://cdn.discordapp.com/embed/avatars/2.png",
          rate: 1600,
          max_rate: 1640,
        },
        {
          user_id: "10",
          trainer_name: "プレイヤー10",
          discord_username: "Player10#5555",
          discord_avatar_url: "https://cdn.discordapp.com/embed/avatars/3.png",
          rate: 1540,
          max_rate: 1580,
        },
      ],
    },
    status: "matched",
    started_at: new Date().toISOString(),
  };

  // 試合情報を更新する関数（ハイブリッド方式：HTTP初期読み込み + WebSocket更新）
  const refreshMatchData = React.useCallback(async () => {
    console.log("refreshMatchData: Loading full match data via HTTP");

    try {
      const response = await unitemateApi.getCurrentMatch();

      // assigned_match_idが0（試合なし）の場合は試合から抜ける
      const responseData = response as { match: MatchData };
      if (!responseData?.match || responseData.match.match_id === "0") {
        console.log(
          "User has left the match (assigned_match_id = 0 or no_match status)",
        );
        setCurrentMatch(null);
        return;
      }

      // 新しい試合データで更新（完全な基本データ）
      console.log("refreshMatchData: Setting full match data from HTTP", responseData.match);
      setCurrentMatch(responseData.match);
    } catch (error) {
      console.error("試合情報の更新に失敗:", error);
      // APIエラーの場合でも、WebSocketで試合が進行中の場合は状態を保持
      // 404エラーなど本当に試合が存在しない場合のみnullにする
      if (error instanceof TypeError && error.message.includes('404')) {
        console.log("Match not found (404). Leaving current match.");
        setCurrentMatch(null);
      } else {
        console.log("API error occurred but maintaining current match state for WebSocket updates.");
        // 一時的なAPI障害の場合は現在の状態を保持
      }
    }
  }, [unitemateApi]);


  // MatchTabがマウントされた時にHTTPで初期試合データを取得
  React.useEffect(() => {
    console.log("[Match] MatchTab mounted, loading initial match data via HTTP");
    refreshMatchData();
  }, []); // 空の依存配列でマウント時のみ実行

  // 試合開始時にWebSocket購読を開始、終了時に解除
  React.useEffect(() => {
    if (!currentMatch || showTestMatch) {
      // 試合がない場合は購読解除
      unsubscribeMatch();
      return;
    }

    // 試合がある場合はWebSocket購読を開始
    const matchId = currentMatch.match_id;
    if (matchId && matchId !== "0") {
      console.log("[Match] Starting WebSocket subscription for match:", matchId);
      subscribeMatch(String(matchId));

      // コンポーネントがアンマウントされる際の購読解除
      return () => {
        console.log("[Match] Cleaning up WebSocket subscription for match:", matchId);
        unsubscribeMatch();
      };
    }
  }, [currentMatch, showTestMatch, subscribeMatch, unsubscribeMatch]);

  if (!(isAuthenticated || dummyAuth.isAuthenticated)) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">ログインが必要です</p>
      </div>
    );
  }

  // 認証エラーチェック
  if (queueError && queueError.includes("認証の有効期限が切れました")) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
          <p className="text-red-700 font-semibold mb-2">認証エラー</p>
          <p className="text-red-600 mb-4">{queueError}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded transition-colors"
          >
            ページを再読み込み
          </button>
        </div>
      </div>
    );
  }

  // ユーザー名が設定されているかチェック
  const hasUsername = userInfo?.trainer_name;

  // const waitingPlayers = queueInfo?.rate_list?.length || 0;
  // const ongoingMatches = queueInfo?.ongoing_matches || 0;

  // ローディング中の表示
  if (loadingCurrentMatch) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl lg:text-2xl font-bold text-gray-800 mb-4 lg:mb-6">
          マッチング
        </h2>
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  // 対戦画面が必要な場合（現在の試合がある、またはテスト表示）
  if (showTestMatch || currentMatch) {
    const matchData = currentMatch || testMatchData;
    return (
      <MatchScreen
        matchData={matchData}
        currentUser={userInfo || undefined}
        masterData={undefined}
        isTestMode={showTestMatch} // テストモードフラグを渡す
        onLeaveMatch={() => {
          setShowTestMatch(false);
          setCurrentMatch(null);
          unsubscribeMatch(); // WebSocket購読も解除
        }}
        onRefreshMatch={refreshMatchData}
      />
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl lg:text-2xl font-bold text-gray-800 mb-4 lg:mb-6">
        マッチング
      </h2>

      {/* ユーザーのネームプレート */}
      {hasUsername && (
        <div className="flex justify-center mb-6">
          <NamePlate
            trainerName={userInfo?.trainer_name || ""}
            discordUsername={user?.nickname}
            twitterId={userInfo?.twitter_id || undefined}
            rate={userInfo?.rate || 1500}
            maxRate={userInfo?.max_rate || 1500}
            avatarUrl={user?.picture}
            primaryBadgeId={userInfo?.current_badge}
            secondaryBadgeId={userInfo?.current_badge_2}
          />
        </div>
      )}

      {/* Discordサーバー参加ボタン（未参加の場合のみ表示） */}
      {isDiscordMember === false && (
        <div className="max-w-2xl mx-auto mb-6">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg p-4 text-white text-center">
            <a
              href="https://discord.com/invite/WqQ4eStgZA"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center bg-white text-indigo-600 font-semibold px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 shadow-lg text-sm mb-2"
            >
              <span className="mr-2">🎮</span>
              Discordサーバーに参加
              <span className="ml-2">🡕</span>
            </a>
            <p className="text-xs opacity-75" style={{ fontSize: '10px' }}>
              ※マッチング参加にはDiscordサーバー参加が必要です
            </p>
          </div>
        </div>
      )}
      
      {/* Discord確認中の表示 */}
      {checkingDiscord && (
        <div className="max-w-2xl mx-auto mb-6">
          <div className="bg-gray-100 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              <span className="text-sm text-gray-600">Discordサーバー参加状況を確認中...</span>
            </div>
          </div>
        </div>
      )}

      {matchError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">エラー: {matchError}</p>
        </div>
      )}

      {/* ロール選択とマッチングボタン */}
      <div className="bg-white rounded-lg shadow p-6">
        <RoleSelector
          selectedRoles={selectedRoles}
          onRoleChange={(roles) => {
            // インキュー中はロール変更を無効化
            if (!isInQueue) {
              setSelectedRoles(roles);
            }
          }}
          className="mb-6"
        />

        {/* マッチングボタン */}
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-center">
            <button
              onClick={async () => {
                if (isInQueue) {
                  await leaveQueue();
                } else {
                  if (selectedRoles.length < 2) {
                    alert(
                      `ロールを2つ以上選択してください（現在: ${selectedRoles.length}個）`,
                    );
                    return;
                  }

                  await joinQueue({ selected_roles: selectedRoles });
                }
              }}
              disabled={
                matchLoading ||
                !hasUsername ||
                isPenaltyTimeout ||
                isPenaltyBanned ||
                isDiscordMember === false ||
                checkingDiscord
              }
              className={`px-8 py-3 rounded-lg font-medium text-lg transition-all duration-200 disabled:opacity-50 shadow-lg transform hover:scale-105 ${
                isInQueue
                  ? "bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700"
                  : !hasUsername
                    ? "bg-gray-400 text-gray-100 cursor-not-allowed"
                    : isPenaltyBanned
                      ? "bg-gray-400 text-gray-100 cursor-not-allowed"
                      : isPenaltyTimeout
                        ? "bg-gray-400 text-gray-100 cursor-not-allowed"
                        : "bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700"
              }`}
              title={
                !hasUsername
                  ? "プロフィール設定が必要です"
                  : isPenaltyBanned
                    ? `ペナルティが${effectivePenalty}のため、マッチングに参加できません`
                    : isPenaltyTimeout
                      ? `ペナルティタイムアウト中（残り${Math.ceil(penaltyTimeoutRemaining / 60)}分）`
                      : ""
              }
            >
              {matchLoading
                ? "処理中..."
                : isInQueue
                  ? "マッチング停止"
                  : isDiscordMember === false
                    ? "Discord参加が必要"
                    : checkingDiscord
                      ? "確認中..."
                      : "マッチング開始"}
            </button>
          </div>

          {!hasUsername && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
              <p className="text-yellow-800 font-medium text-sm">
                <span className="text-lg mr-2">⚠️</span>
                マイページでトレーナー名を設定してください
              </p>
            </div>
          )}

          {isPenaltyBanned && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-center">
              <p className="text-red-800 font-medium text-sm">
                <span className="text-lg mr-2">🚫</span>
                ペナルティが{effectivePenalty}のため、マッチングに参加できません
              </p>
            </div>
          )}


          {!isPenaltyBanned && isPenaltyTimeout && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-center">
              <p className="text-red-800 font-medium text-sm">
                <span className="text-lg mr-2">🚫</span>
                ペナルティタイムアウト中です（残り
                {Math.ceil(penaltyTimeoutRemaining / 60)}分）
              </p>
            </div>
          )}

          {isInQueue && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
              <p className="text-blue-800 font-medium">マッチング中...</p>
              <p className="text-sm text-blue-600 mt-1">
                対戦相手を探しています。しばらくお待ちください。
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Queue Status Component */}
      <QueueStatus
        selectedRoles={selectedRoles}
        onRoleChange={setSelectedRoles}
      />

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-4 lg:gap-6"></div>

      {/* レート分布は新設計では不要のため削除 */}
    </div>
  );
};

// ランキングタブコンポーネント
const RankingTab: React.FC = () => {
  return (
    <div className="space-y-6">
      <RankingScreen />
    </div>
  );
};

const UnitemateApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>("rules");

  // ロール選択の状態
  const [selectedRoles, setSelectedRoles] = useState<LfgRole[]>([]);

  const { isAuthenticated, user, loginWithRedirect, logout, isLoading } =
    useAuth0();
  const { loading: isUserLoading } = useUser();
  const { userInfo } = useUserInfo();
  const dummyAuth = useDummyAuth();

  const handleLogin = () => {
    loginWithRedirect({
      authorizationParams: {
        connection: "discord",
      },
    });
  };

  const handleLogout = () => {
    logout({ logoutParams: { returnTo: window.location.origin } });
  };


  const renderTabContent = () => {
    switch (activeTab) {
      case "rules":
        return <RulesTab />;
      case "mypage":
        return <MyPageTab />;
      case "match":
        return (
          <MatchTab
            selectedRoles={selectedRoles}
            setSelectedRoles={setSelectedRoles}
          />
        );
      case "ranking":
        return <RankingTab />;
      default:
        return <RulesTab />;
    }
  };

  if (isLoading || isUserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  // ユーザー情報の統合
  const currentUser =
    (isAuthenticated || dummyAuth.isAuthenticated) && userInfo
      ? {
          id: userInfo.user_id,
          username: userInfo.trainer_name || user?.nickname || "ユーザー",
          avatar: userInfo.discord_avatar_url || user?.picture,
        }
      : undefined;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-200 via-purple-100 to-orange-200">
      {/* 統一されたヘッダー */}
      <Header
        user={currentUser}
        onLogin={handleLogin}
        onLogout={
          dummyAuth.isAuthenticated ? () => dummyAuth.logout() : handleLogout
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 lg:py-8 max-[500px]:px-0 max-[500px]:py-2">
        {/* スマホ用タブ（横並び） */}
        <div className="lg:hidden mb-4 max-[500px]:mb-2">
          <nav className="flex justify-center space-x-1 max-[500px]:space-x-0 bg-white/80 backdrop-blur-md rounded-xl max-[500px]:rounded-none p-1.5 max-[500px]:p-1 shadow-xl">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center px-3 py-4 max-[500px]:px-1 max-[500px]:py-2 rounded-lg max-[500px]:rounded-none transition-all duration-200 min-h-[64px] max-[500px]:min-h-[48px] ${
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-orange-400 to-orange-500 text-white shadow-lg transform scale-105"
                    : "text-purple-700 hover:text-purple-900 hover:bg-purple-100"
                }`}
              >
                <span className="text-xl max-[500px]:text-lg mb-1 max-[500px]:mb-0.5">
                  {tab.icon}
                </span>
                <span className="text-xs max-[500px]:text-[10px] font-medium leading-tight">
                  {tab.label}
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 max-[500px]:gap-0">
          {/* PC用サイドバー（タブ） */}
          <div className="hidden lg:block lg:col-span-1">
            <nav className="space-y-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-all duration-200 ${
                    activeTab === tab.id
                      ? "bg-gradient-to-r from-orange-400 to-orange-500 text-white shadow-xl border-l-4 border-orange-300"
                      : "text-purple-700 hover:bg-white/30 hover:text-purple-900"
                  }`}
                >
                  <span className="mr-3 text-lg">{tab.icon}</span>
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* メインコンテンツ */}
          <div className="lg:col-span-3 max-[500px]:mx-0">
            <div className="bg-white/95 backdrop-blur-md rounded-xl max-[500px]:rounded-none shadow-2xl min-h-[600px] p-2 lg:p-4 max-[500px]:px-1 max-[500px]:py-2 border border-white/30 max-[500px]:border-0">
              {renderTabContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnitemateApp;
