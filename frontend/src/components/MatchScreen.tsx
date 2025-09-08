import React, { useState } from "react";
import NamePlate from "./NamePlate";
import PlayerInfoModal from "./PlayerInfoModal";
import { MatchReportModal } from "./MatchReportModal";
import MatchCountdownTimer from "./MatchCountdownTimer";
import type { UserInfo } from "../hooks/useUnitemateApi";
import { useUnitemateApi } from "../hooks/useUnitemateApi";

// 対戦情報の型定義
export interface MatchPlayer {
  user_id: string;
  trainer_name: string;
  discord_username?: string;
  discord_avatar_url?: string;
  twitter_id?: string;
  rate: number;
  max_rate: number;
  current_badge?: string;
  current_badge_2?: string;
  role?: string; // プレイヤーに割り当てられたロール
  preferred_roles?: string[]; // 得意ロール情報
  favorite_pokemon?: string[]; // お気に入りポケモン
  bio?: string; // 一言コメント
}

export interface MatchTeam {
  team_id: "A" | "B";
  team_name: string;
  is_first_attack: boolean; // 先攻かどうか
  voice_channel?: string; // VCチャンネル番号
  players: MatchPlayer[];
}

export interface MatchData {
  match_id: string;
  team_a: MatchTeam;
  team_b: MatchTeam;
  status: "matched" | "done";
  started_at?: string;
  matched_unixtime?: number; // マッチ成立時刻（unixtime）
  lobby_id?: string;
  host_user_id?: string;
  report_count?: number; // 結果報告済み数
}

interface MatchScreenProps {
  matchData: MatchData;
  currentUser?: UserInfo;
  masterData?: { badges?: Array<{ id: string; display: string }> }; // マスターデータ（勲章情報など）
  onLeaveMatch?: () => void; // マッチから退出時のコールバック
  isTestMode?: boolean; // テストモードかどうか
  onRefreshMatch?: () => Promise<void>; // マッチ情報更新のコールバック
}

const MatchScreen: React.FC<MatchScreenProps> = ({
  matchData,
  currentUser,
  // masterData, // 現在未使用
  onLeaveMatch,
  isTestMode = false,
  onRefreshMatch,
}) => {
  const { unitemateApi } = useUnitemateApi();

  // デバッグ用ログ
  console.log("MatchScreen: matchData:", matchData);
  console.log("MatchScreen: currentUser:", currentUser);
  console.log("MatchScreen: team_a players:", matchData.team_a?.players);
  console.log("MatchScreen: team_b players:", matchData.team_b?.players);

  // チームをレート順にソート
  const sortPlayersByRate = (players: MatchPlayer[]) => {
    // playersが配列でない場合は空配列を返す
    if (!Array.isArray(players)) {
      console.warn("sortPlayersByRate: players is not an array:", players);
      return [];
    }
    return [...players].sort((a, b) => b.rate - a.rate);
  };

  const [selectedPlayer, setSelectedPlayer] = useState<MatchPlayer | null>(
    null,
  );
  const [isPlayerInfoOpen, setIsPlayerInfoOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // ロビーID関連の状態
  const [lobbyId, setLobbyId] = useState("");
  // チームAの最高レートプレイヤーをホストに設定
  const sortedTeamA = sortPlayersByRate(matchData.team_a?.players || []);
  const currentHostUserId =
    matchData.host_user_id ||
    (sortedTeamA.length > 0 ? sortedTeamA[0].user_id : "");

  // matchDataから共有されたロビーIDを使用
  const sharedLobbyId = matchData.lobby_id || "";

  // 定期的な試合情報更新は親コンポーネント（UnitemateApp）で実装済み

  // プレイヤー情報を表示
  const handlePlayerInfoClick = (player: MatchPlayer) => {
    setSelectedPlayer(player);
    setIsPlayerInfoOpen(true);
  };

  // 自分がどのチームに所属しているかを判定
  const getCurrentUserTeam = (): "A" | "B" | null => {
    if (!currentUser) return null;

    if (
      (matchData.team_a?.players || []).some((p) => p.user_id === currentUser.user_id)
    ) {
      return "A";
    }
    if (
      (matchData.team_b?.players || []).some((p) => p.user_id === currentUser.user_id)
    ) {
      return "B";
    }
    return null;
  };

  const currentUserTeam = getCurrentUserTeam();

  // 現在のユーザーのロールを取得
  const getCurrentUserRole = (): string | null => {
    if (!currentUser) return null;

    // チームAから検索
    const playerInTeamA = (matchData.team_a?.players || []).find(
      (p) => p.user_id === currentUser.user_id,
    );
    if (playerInTeamA && playerInTeamA.role) {
      return playerInTeamA.role;
    }

    // チームBから検索
    const playerInTeamB = (matchData.team_b?.players || []).find(
      (p) => p.user_id === currentUser.user_id,
    );
    if (playerInTeamB && playerInTeamB.role) {
      return playerInTeamB.role;
    }

    return null;
  };

  const currentUserRole = getCurrentUserRole();

  // ホスト関連のロジック
  const isEveryoneCanSend = matchData.host_user_id === "#EVERYONE#";
  const isHost =
    currentUser &&
    (currentHostUserId === currentUser.user_id || isEveryoneCanSend);
  const currentHostPlayer = [
    ...(matchData.team_a?.players || []),
    ...(matchData.team_b?.players || []),
  ].find((p) => p.user_id === currentHostUserId);
  const currentHostName = isEveryoneCanSend
    ? "全員"
    : currentHostPlayer?.trainer_name || "Unknown";

  // ロビーID送信処理
  const handleSendLobbyId = async () => {
    if (!lobbyId.trim()) return;
    try {
      console.log("ロビーID送信:", lobbyId);

      // バックエンドAPIに送信
      await unitemateApi.updateLobbyId(lobbyId);

      // 送信後、親コンポーネントでマッチ情報を更新
      if (onRefreshMatch) {
        await onRefreshMatch();
      }
    } catch (error) {
      console.error("ロビーID送信エラー:", error);
    }
  };

  // ホスト変更処理
  const handleTransferHost = async () => {
    if (!currentUser) return;
    try {
      console.log("ホスト権限を移譲:", currentUser.trainer_name);

      // バックエンドAPIでホスト権限を移譲（全員が送信可能モードに）
      await unitemateApi.transferHost();

      // 送信後、親コンポーネントでマッチ情報を更新
      if (onRefreshMatch) {
        await onRefreshMatch();
      }
    } catch (error) {
      console.error("ホスト変更エラー:", error);
    }
  };

  // ロール名の日本語変換
  const getRoleDisplayName = (role?: string) => {
    const roleNames: { [key: string]: string } = {
      TOP: "上レーン",
      MID: "中央",
      BOTTOM: "下レーン",
      SUPPORT: "サポート",
      TANK: "タンク",
    };
    return role ? roleNames[role.toUpperCase()] || role : "";
  };

  const TeamDisplay: React.FC<{
    team: MatchTeam;
    color: "purple" | "orange";
  }> = ({ team, color }) => {
    const sortedPlayers = sortPlayersByRate(team.players);

    const teamColorClasses = {
      purple: {
        border: "border-purple-500",
        bg: "bg-purple-200", // 薄い紫背景
        header: "bg-purple-500 text-white",
        accent: "text-purple-600",
      },
      orange: {
        border: "border-orange-500",
        bg: "bg-orange-200", // 薄いオレンジ背景
        header: "bg-orange-500 text-white",
        accent: "text-orange-600",
      },
    };

    const colors = teamColorClasses[color];

    // ボーダークラスを動的に決定
    const borderClass = `border-2 ${colors.border}`;

    return (
      <div
        className={`${borderClass} rounded-lg overflow-hidden shadow-lg max-w-[300px] min-w-[120px] w-full p-0 flex-1`}
      >
        {/* チームヘッダー */}
        <div
          className={`${colors.header} px-2 sm:px-4 py-2 sm:py-3 flex items-center ${team.team_id === "B" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`flex items-center ${team.team_id === "B" ? "flex-row-reverse" : ""}`}
          >
            <span className="font-bold text-sm sm:text-lg">
              {team.is_first_attack ? "先攻" : "後攻"}
            </span>
            {team.voice_channel && (
              <span
                className={`text-xs sm:text-sm opacity-90 ${team.team_id === "B" ? "mr-1 sm:mr-2" : "ml-1 sm:ml-2"}`}
              >
                VC {team.voice_channel}
              </span>
            )}
          </div>
        </div>

        {/* プレイヤーリスト */}
        <div className={`${colors.bg} px-0`}>
          {sortedPlayers.map((player) => {
            const isCurrentUser =
              currentUser && player.user_id === currentUser.user_id;
            const currentUserBorderClass = isCurrentUser
              ? `border-t border-b ${color === "purple" ? "border-t-purple-500 border-b-purple-500" : "border-t-orange-500 border-b-orange-500"}`
              : "";

            // 味方チームかつ自分以外の場合はiアイコンを表示
            const isTeammate =
              currentUserTeam === team.team_id && !isCurrentUser;

            return (
              <div key={player.user_id} className="relative">
                <NamePlate
                  trainerName={player.trainer_name}
                  discordUsername={player.discord_username}
                  twitterId={player.twitter_id}
                  rate={player.rate}
                  maxRate={player.max_rate}
                  avatarUrl={player.discord_avatar_url}
                  primaryBadgeId={player.current_badge}
                  secondaryBadgeId={player.current_badge_2}
                  role={player.role}
                  showInfoButton={isTeammate}
                  onInfoClick={() => handlePlayerInfoClick(player)}
                  teamColor={color}
                  isRightAligned={team.team_id === "B"}
                  className={`mb-0 mx-0 w-full ${currentUserBorderClass}`}
                />
                {isCurrentUser && (
                  <div
                    className={`absolute top-0 bottom-0 ${team.team_id === "A" ? "left-0" : "right-0"}`}
                    style={{
                      width: "10px",
                      background:
                        team.team_id === "A"
                          ? `linear-gradient(90deg, ${color === "purple" ? "#8b5cf6" : "#f97316"} 0%, ${color === "purple" ? "rgba(139,92,246,0)" : "rgba(249,115,22,0)"} 100%)`
                          : `linear-gradient(270deg, ${color === "purple" ? "#8b5cf6" : "#f97316"} 0%, ${color === "purple" ? "rgba(139,92,246,0)" : "rgba(249,115,22,0)"} 100%)`,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* マッチタイトル */}
      <div className="text-center mb-2 sm:mb-6">
        <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold text-gray-800 mb-1 sm:mb-2">
          対戦中
        </h1>
        <div className="text-xs sm:text-sm text-gray-600">
          Match ID: {matchData.match_id}
        </div>
        {currentUserRole && (
          <div className="text-sm sm:text-base text-blue-600 font-semibold mt-1">
            あなたのロールは{getRoleDisplayName(currentUserRole)}です
          </div>
        )}
      </div>

      {/* カウントダウンタイマー */}
      <MatchCountdownTimer
        matchStartedAt={
          Number(matchData.matched_unixtime) ||
          Number(matchData.started_at) ||
          Math.floor(Date.now() / 1000)
        }
        lobbyNumber={sharedLobbyId}
      />

      {/* ロビーID共有セクション */}
      <div className="mt-2 sm:mt-4">
        <p className="text-xs sm:text-sm text-gray-600 mb-1 text-center">
          ホスト（
          <span className="text-blue-600 font-semibold">{currentHostName}</span>
          ）が部屋を建ててロビーIDを入力してください。
        </p>
        <p className="text-xs sm:text-sm text-gray-600 mb-3 text-center">
          相談してホストを替わった場合は「ホストを替わる」ボタンを押してください。
        </p>

        <div className="space-y-2 sm:space-y-3">
          {/* ロビーID入力欄 */}
          <div className="flex flex-col sm:flex-row gap-2 items-center justify-center">
            <input
              type="text"
              value={lobbyId}
              onChange={(e) => setLobbyId(e.target.value)}
              placeholder="ロビーIDを入力"
              className="border border-gray-300 rounded px-3 py-2 text-sm w-full sm:w-auto sm:min-w-[200px] text-center"
              maxLength={8}
            />
            <button
              onClick={handleSendLobbyId}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded font-medium transition-colors text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
              disabled={!isHost || !lobbyId.trim()}
            >
              送信
            </button>
          </div>

          {/* ホスト変更ボタン */}
          <div className="text-center">
            <button
              onClick={handleTransferHost}
              className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              disabled={
                !currentUser ||
                isEveryoneCanSend ||
                currentUser.user_id !== currentHostUserId
              }
            >
              {isEveryoneCanSend ? "全員送信可能" : "ホストを替わる"}
            </button>
          </div>
        </div>
      </div>

      {/* チーム表示 */}
      <div className="flex flex-row gap-1 sm:gap-6 justify-center items-start mt-4">
        <TeamDisplay team={matchData.team_a} color="purple" />
        <TeamDisplay team={matchData.team_b} color="orange" />
      </div>

      {/* マッチ情報 */}
      <div className="mt-2 sm:mt-6 bg-white rounded-lg shadow-lg p-2 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-4 text-center">
          <div>
            <div className="text-xs sm:text-sm text-gray-600">ステータス</div>
            <div className="font-semibold text-sm sm:text-lg">
              {matchData.status === "matched" && "進行中"}
              {matchData.status === "done" && "集計済み"}
            </div>
          </div>
          <div>
            <div className="text-xs sm:text-sm text-gray-600">開始時刻</div>
            <div className="font-semibold text-sm sm:text-lg">
              {(() => {
                // matched_unixtime（秒）またはstarted_atから日時を取得
                const timestamp = matchData.matched_unixtime 
                  ? matchData.matched_unixtime * 1000 // 秒をミリ秒に変換
                  : matchData.started_at 
                  ? new Date(matchData.started_at).getTime()
                  : null;

                return timestamp 
                  ? new Date(timestamp).toLocaleDateString('ja-JP', {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : "-";
              })()}
            </div>
          </div>
          <div>
            <div className="text-xs sm:text-sm text-gray-600">結果報告済み</div>
            <div className="font-semibold text-sm sm:text-lg">
              {matchData.report_count || 0}/10
            </div>
          </div>
        </div>
      </div>

      {/* アクションボタン */}
      <div className="mt-2 sm:mt-6 text-center">
        {isTestMode ? (
          // テストモード：退出ボタンなし、報告ボタンのみ
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="bg-green-500 hover:bg-green-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium transition-colors text-sm sm:text-base shadow-lg"
          >
            試合結果を報告（テスト）
          </button>
        ) : (
          // 実際の試合：通常の報告ボタン
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium transition-colors text-sm sm:text-base"
          >
            試合結果を報告
          </button>
        )}
      </div>

      {/* プレイヤー情報モーダル */}
      {selectedPlayer && (
        <PlayerInfoModal
          player={selectedPlayer}
          isOpen={isPlayerInfoOpen}
          onClose={() => {
            setIsPlayerInfoOpen(false);
            setSelectedPlayer(null);
          }}
        />
      )}

      {/* 試合結果報告モーダル */}
      <MatchReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        matchId={matchData.match_id}
        matchPlayers={[
          ...(matchData.team_a?.players || []),
          ...(matchData.team_b?.players || []),
        ]}
        currentUserTeam={currentUserTeam}
        isTestMode={isTestMode}
        onReportComplete={() => {
          setIsReportModalOpen(false);
          onLeaveMatch?.(); // 報告完了後にマッチ画面から退出
        }}
      />
    </div>
  );
};

export default MatchScreen;
