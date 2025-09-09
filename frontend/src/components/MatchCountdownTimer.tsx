import React, { useState, useEffect } from "react";
import { useMasterData } from "../hooks/useUnitemateApi";
import type { Setting } from "../types/common";

interface MatchCountdownTimerProps {
  matchStartedAt: number; // マッチ開始時刻（unixtime）
  lobbyNumber?: string; // ロビー番号
}

type CountdownPhase =
  | "lobby_create"
  | "lobby_waiting"
  | "lobby_join"
  | "match_ready";

const MatchCountdownTimer: React.FC<MatchCountdownTimerProps> = ({
  matchStartedAt,
  lobbyNumber,
}) => {
  const { masterData } = useMasterData();
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000));

  // 初期フェーズを計算
  const calculateInitialPhase = (): CountdownPhase => {
    const initialElapsed = Math.floor(Date.now() / 1000) - matchStartedAt;

    if (lobbyNumber) {
      if (initialElapsed >= 250) return "match_ready";
      return "lobby_join";
    }

    if (initialElapsed >= 150) return "lobby_waiting";
    return "lobby_create";
  };

  const [phase, setPhase] = useState<CountdownPhase>(calculateInitialPhase());

  // マスターデータから制限時間を取得（デフォルト値をすぐに使用）
  const lobbyCreateTimeout = masterData?.settings
    ? Number(
        masterData.settings.find(
          (s: Setting) => s.id === "lobby_create_timeout",
        )?.value,
      ) || 150
    : 150;
  const lobbyJoinTimeout = masterData?.settings
    ? Number(
        masterData.settings.find((s: Setting) => s.id === "lobby_join_timeout")
          ?.value,
      ) || 250
    : 250;

  // 1秒ごとに時刻を更新
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // フェーズの自動切り替え
  useEffect(() => {
    const elapsedTime = currentTime - matchStartedAt;

    // ロビー作成フェーズ → ロビー待機フェーズ
    if (phase === "lobby_create" && elapsedTime >= lobbyCreateTimeout) {
      setPhase("lobby_waiting");
    }

    // ロビー番号が入力されたら → ロビー参加フェーズ
    if (
      lobbyNumber &&
      (phase === "lobby_create" || phase === "lobby_waiting")
    ) {
      setPhase("lobby_join");
    }

    // ロビー参加フェーズ → 試合準備完了フェーズ
    if (phase === "lobby_join" && elapsedTime >= lobbyJoinTimeout) {
      setPhase("match_ready");
    }
  }, [
    lobbyNumber,
    phase,
    currentTime,
    matchStartedAt,
    lobbyCreateTimeout,
    lobbyJoinTimeout,
  ]);

  // 経過時間と残り時間の計算
  const elapsedTime = currentTime - matchStartedAt;

  let remainingTime = 0;
  let message = "";

  switch (phase) {
    case "lobby_create":
      remainingTime = Math.max(0, lobbyCreateTimeout - elapsedTime);
      message =
        remainingTime > 0
          ? "時間内にロビーが建たない場合、試合を無効にしてください"
          : "ロビーが建っていない場合は試合を無効にしてください";
      break;

    case "lobby_waiting":
      message = "ロビーが建っていない場合は試合を無効にしてください";
      break;

    case "lobby_join":
      // ロビー参加フェーズも試合開始時刻からカウント
      remainingTime = Math.max(0, lobbyJoinTimeout - elapsedTime);

      if (remainingTime > 0) {
        message =
          "時間内にゲーム内ロビーに全員揃わない場合、試合を無効にしてください";
      } else {
        message =
          "速やかに試合を開始してください\n揃っていない場合は試合を無効にしてください";
      }
      break;

    case "match_ready":
      message =
        "速やかに試合を開始してください\n揃っていない場合は試合を無効にしてください";
      break;
  }

  // 30秒を切ったら警告色に
  const isWarning = remainingTime > 0 && remainingTime <= 30;
  const timerColor = isWarning ? "text-red-600" : "text-blue-600";
  const messageColor = isWarning ? "text-red-700" : "text-gray-700";

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6 mb-6">
      <div className="text-center">
        {/* タイマー表示 */}
        {remainingTime > 0 && (
          <div
            className={`text-4xl font-bold mb-4 transition-colors duration-300 ${timerColor}`}
          >
            {Math.floor(remainingTime / 60)}:
            {String(remainingTime % 60).padStart(2, "0")}
          </div>
        )}

        {/* メッセージ表示 */}
        <div
          className={`text-lg font-medium transition-colors duration-300 ${messageColor} whitespace-pre-line`}
        >
          {message}
        </div>

        {/* ロビー番号表示 */}
        {lobbyNumber && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-sm text-green-700 font-medium">
              ロビー番号:{" "}
              <span className="font-mono text-lg">{lobbyNumber}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchCountdownTimer;
