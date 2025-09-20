import React from "react";
import { useQueueInfo, useMatchQueue } from "../hooks/useUnitemateApi";
import type { QueueInfo } from "../hooks/useUnitemateApi";
import { QueueVisualization } from "./QueueVisualization";
import type { LfgRole } from "../types/lfg";

interface QueueStatusProps {
  selectedRoles: LfgRole[];
  onRoleChange: (roles: LfgRole[]) => void;
  externalQueueInfo?: QueueInfo | null; // 外部から渡されるキュー情報（差分更新用）
}

export const QueueStatus: React.FC<QueueStatusProps> = ({ selectedRoles, externalQueueInfo }) => {
  const {
    queueInfo: internalQueueInfo,
    loading: queueLoading,
    error: queueError,
  } = useQueueInfo();
  const { error: actionError, isInQueue, queueEntry } = useMatchQueue();

  // externalQueueInfoが渡された場合はそれを優先、そうでなければinternalを使用
  const queueInfo = externalQueueInfo || internalQueueInfo;

  // デバッグ用ログ追加
  React.useEffect(() => {
    console.log("[QueueStatus] queueInfo updated:", queueInfo);
    console.log("[QueueStatus] Source:", externalQueueInfo ? "external" : "internal");
  }, [queueInfo, externalQueueInfo]);

  // インキュー中の選択ロールを取得
  // インキュー中のみロールをハイライトする
  const userSelectedRoles =
    isInQueue && queueEntry?.selected_roles
      ? queueEntry.selected_roles
      : isInQueue
        ? selectedRoles
        : [];

  // Show development notice if backend is not available
  const isBackendUnavailable =
    queueError &&
    (queueError.includes("404") ||
      queueError.includes("CORS") ||
      queueError.includes("net::ERR_FAILED"));

  if (queueLoading) {
    return <div className="p-4">キュー情報を読み込み中...</div>;
  }

  return (
    <div className="p-4 sm:p-4 p-2 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">マッチングキュー</h2>

      {/* Development Notice */}
      {isBackendUnavailable && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-yellow-800 font-semibold">開発中</p>
          <p className="text-yellow-700 text-sm">
            キューバックエンドが未デプロイです。現在は表示のみ対応しています。
          </p>
        </div>
      )}

      {/* Queue Visualization */}
      {queueInfo && !isBackendUnavailable && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">ロール別エントリー状況</h3>
          <QueueVisualization
            role_counts={queueInfo.role_counts}
            total_waiting={queueInfo.total_waiting}
            ongoingMatches={queueInfo.ongoing_matches}
            isUserInQueue={isInQueue}
            userSelectedRoles={userSelectedRoles}
            previousMatchedTime={queueInfo.previous_matched_unixtime}
            previousUserCount={queueInfo.previous_user_count}
          />
        </div>
      )}

      {/* Mock Queue Visualization for Development */}
      {isBackendUnavailable && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">
            ロール別エントリー状況 (デモ)
          </h3>
          <QueueVisualization
            role_counts={{
              TOP_LANE: 2,
              MIDDLE: 1,
              BOTTOM_LANE: 3,
              SUPPORT: 1,
              TANK: 0,
            }}
            total_waiting={5}
            ongoingMatches={2}
            isUserInQueue={false}
            userSelectedRoles={userSelectedRoles}
          />
        </div>
      )}

      {/* Error Display */}
      {(queueError || actionError) && !isBackendUnavailable && (
        <div className="mt-4 p-3 bg-red-50 text-red-800 rounded">
          {queueError || actionError}
        </div>
      )}
    </div>
  );
};
