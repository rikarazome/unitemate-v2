import React, { useState, useEffect, useCallback } from "react";
import { useUnitemateApi } from "../hooks/useUnitemateApi";

interface AdminMatchSummary {
  match_id: string;
  status: "matched" | "done";
  matched_unixtime: number;
  team_a_count: number;
  team_b_count: number;
  report_count: number;
  lobby_id: string;
  host_trainer_name: string;
}

interface AdminMatchDetailView {
  match: {
    match_id: string;
    status: "matched" | "done";
    matched_unixtime: number;
    lobby_id?: string;
    host_user_id?: string;
    winner_team?: "A" | "B";
    team_a: Array<{ user_id: string; trainer_name: string; role: string }>;
    team_b: Array<{ user_id: string; trainer_name: string; role: string }>;
  };
  reports: {
    user_id: string;
    trainer_name: string;
    reported_at: number;
    result: "win" | "lose";
    team: "A" | "B";
    reported_players?: string[];
    report_reason?: string;
  }[];
  penalty_summary: {
    [user_id: string]: {
      trainer_name: string;
      report_count: number;
      reporters: {
        user_id: string;
        trainer_name: string;
        team: "A" | "B";
        reason?: string;
      }[];
    };
  };
  penalty_status: {
    processed: boolean;
    penalty_players: string[];
    processing_time?: number;
  };
}

const AdminMatchManagement: React.FC = () => {
  const { unitemateApi } = useUnitemateApi();
  const [matches, setMatches] = useState<AdminMatchSummary[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  const [selectedMatchDetail, setSelectedMatchDetail] =
    useState<AdminMatchDetailView | null>(null);
  const [filter, setFilter] = useState<"all" | "matched" | "done">("matched");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 試合一覧を取得
  const fetchMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await unitemateApi.getAdminMatches(filter);
      // Map MatchData to AdminMatchSummary
      const mappedMatches: AdminMatchSummary[] = (response.matches || []).map(
        (match) => ({
          match_id: match.match_id,
          status: match.status,
          matched_unixtime: match.matched_unixtime || Date.now(),
          team_a_count: match.team_a?.players?.length || 0,
          team_b_count: match.team_b?.players?.length || 0,
          report_count: match.user_reports?.length || 0,
          lobby_id: match.lobby_id || "",
          host_trainer_name:
            match.team_a?.players?.[0]?.trainer_name || "Unknown",
        }),
      );
      setMatches(mappedMatches);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "試合一覧の取得に失敗しました",
      );
    } finally {
      setLoading(false);
    }
  }, [unitemateApi, filter]);

  // 試合詳細を取得
  const fetchMatchDetail = useCallback(
    async (matchId: string) => {
      setDetailLoading(true);
      try {
        const response = await unitemateApi.getAdminMatchDetail(matchId);
        // Map MatchData to AdminMatchDetailView
        const mappedDetail: AdminMatchDetailView = {
          match: {
            match_id: response.match_id,
            status: response.status,
            matched_unixtime: response.matched_unixtime || Date.now(),
            lobby_id: response.lobby_id,
            host_user_id: response.host_user_id,
            team_a:
              response.team_a?.players?.map((p) => ({
                user_id: p.user_id,
                trainer_name: p.trainer_name || p.user_id,
                role: p.role || "UNKNOWN",
              })) || [],
            team_b:
              response.team_b?.players?.map((p) => ({
                user_id: p.user_id,
                trainer_name: p.trainer_name || p.user_id,
                role: p.role || "UNKNOWN",
              })) || [],
          },
          reports: (response.user_reports || []).map((r) => ({
            user_id: r.user_id,
            trainer_name: r.user_id, // TODO: Map to actual trainer name
            result: (r.result as "win" | "lose") || "lose",
            reported_at: r.reported_at,
            team: "A" as "A" | "B", // TODO: Determine actual team
            reported_players: [],
            report_reason: undefined,
          })),
          penalty_summary: {}, // TODO: Implement penalty summary
          penalty_status: {
            processed: false,
            penalty_players: [],
            processing_time: undefined,
          },
        };
        setSelectedMatchDetail(mappedDetail);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "試合詳細の取得に失敗しました",
        );
      } finally {
        setDetailLoading(false);
      }
    },
    [unitemateApi],
  );

  // フィルター変更時に再取得
  useEffect(() => {
    fetchMatches();
  }, [filter, fetchMatches]);

  // 選択された試合の詳細を取得
  useEffect(() => {
    if (selectedMatch) {
      fetchMatchDetail(selectedMatch);
    }
  }, [selectedMatch, fetchMatchDetail]);

  const formatDate = (unixtime: number) => {
    return new Date(unixtime * 1000).toLocaleString("ja-JP");
  };

  const getStatusText = (status: string) => {
    const statusMap = {
      matched: "進行中",
      done: "完了",
    };
    return statusMap[status as keyof typeof statusMap] || status;
  };

  const getStatusColor = (status: string) => {
    const colorMap = {
      matched: "text-blue-600 bg-blue-100",
      done: "text-green-600 bg-green-100",
    };
    return (
      colorMap[status as keyof typeof colorMap] || "text-gray-600 bg-gray-100"
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">試合管理</h2>
        <button
          onClick={fetchMatches}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          disabled={loading}
        >
          {loading ? "読み込み中..." : "更新"}
        </button>
      </div>

      {/* フィルター */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex gap-4 items-center">
          <label className="font-medium text-gray-700">状態:</label>
          <select
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value as "all" | "matched" | "done")
            }
            className="border border-gray-300 rounded px-3 py-1"
          >
            <option value="all">全て</option>
            <option value="matched">進行中</option>
            <option value="done">完了</option>
          </select>
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* 試合一覧 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  試合ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状態
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  開始時刻
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  プレイヤー数
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  結果報告
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ロビーID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ホスト
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {matches.map((match) => (
                <tr key={match.match_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {match.match_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(match.status)}`}
                    >
                      {getStatusText(match.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(match.matched_unixtime)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {match.team_a_count + match.team_b_count}人
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {match.report_count}/10
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {match.lobby_id || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {match.host_trainer_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => setSelectedMatch(match.match_id)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      詳細
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 試合詳細モーダル */}
      {selectedMatch && (
        <MatchDetailModal
          matchId={selectedMatch}
          matchDetail={selectedMatchDetail}
          loading={detailLoading}
          onClose={() => {
            setSelectedMatch(null);
            setSelectedMatchDetail(null);
          }}
        />
      )}
    </div>
  );
};

// 試合詳細モーダルコンポーネント
const MatchDetailModal: React.FC<{
  matchId: string;
  matchDetail: AdminMatchDetailView | null;
  loading: boolean;
  onClose: () => void;
}> = ({ matchId, matchDetail, loading, onClose }) => {
  if (!matchDetail && !loading) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="flex justify-between items-center p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-800">
            試合詳細 - {matchId}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <span className="text-2xl">×</span>
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : matchDetail ? (
            <div className="space-y-6">
              {/* 基本情報 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-3">基本情報</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">状態:</span>{" "}
                    {matchDetail.match.status}
                  </div>
                  <div>
                    <span className="font-medium">開始時刻:</span>{" "}
                    {new Date(
                      matchDetail.match.matched_unixtime * 1000,
                    ).toLocaleString()}
                  </div>
                  <div>
                    <span className="font-medium">ロビーID:</span>{" "}
                    {matchDetail.match.lobby_id || "-"}
                  </div>
                  <div>
                    <span className="font-medium">勝利チーム:</span>{" "}
                    {matchDetail.match.winner_team || "-"}
                  </div>
                </div>
              </div>

              {/* 結果報告状況 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-3">
                  結果報告状況 ({matchDetail.reports.length}/10)
                </h4>
                <div className="space-y-2">
                  {matchDetail.reports.map((report, index) => (
                    <div key={index} className="bg-white rounded p-3 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">
                          {report.trainer_name}
                        </span>
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            report.result === "win"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {report.result === "win" ? "勝利" : "敗北"}
                        </span>
                      </div>
                      <div className="text-gray-600 mt-1">
                        チーム{report.team} |{" "}
                        {new Date(
                          report.reported_at * 1000,
                        ).toLocaleTimeString()}
                      </div>
                      {report.reported_players &&
                        report.reported_players.length > 0 && (
                          <div className="text-red-600 mt-1">
                            通報: {report.reported_players.length}人
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 通報集計 */}
              {Object.keys(matchDetail.penalty_summary).length > 0 && (
                <div className="bg-red-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3">通報集計</h4>
                  <div className="space-y-3">
                    {Object.entries(matchDetail.penalty_summary).map(
                      ([userId, summary]) => (
                        <div key={userId} className="bg-white rounded p-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium">
                              {summary.trainer_name}
                            </span>
                            <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm">
                              {summary.report_count}件の通報
                            </span>
                          </div>
                          <div className="text-sm text-gray-600">
                            通報者:{" "}
                            {summary.reporters
                              .map((r) => r.trainer_name)
                              .join(", ")}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}

              {/* ペナルティ処理状況 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-3">
                  ペナルティ処理状況
                </h4>
                <div className="text-sm">
                  <div
                    className={`font-medium ${matchDetail.penalty_status.processed ? "text-green-600" : "text-yellow-600"}`}
                  >
                    {matchDetail.penalty_status.processed
                      ? "処理済み"
                      : "未処理"}
                  </div>
                  {matchDetail.penalty_status.penalty_players.length > 0 && (
                    <div className="mt-2">
                      <span className="font-medium">ペナルティ対象:</span>{" "}
                      {matchDetail.penalty_status.penalty_players.length}人
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              データの読み込みに失敗しました
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminMatchManagement;
