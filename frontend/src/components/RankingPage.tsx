import { useRankings } from "../hooks/useRankings";
import { calcWinRate, formatRelativeOrDate } from "../utils/format";
import Layout from "./Layout";

export default function RankingPage() {
  const { rankings, loading, error } = useRankings(100);

  // 認証不要ページなので、未ログインでも表示する
  // ただしAuth0初期化中はHeaderの表示に揺れが出ないように待機可
  // if (isLoading) return <div className="p-8">読み込み中...</div>;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">ランキング</h1>
        <p className="text-gray-600 mb-6 text-sm">
          ※7日以上プレイしていないプレイヤーはランキングに掲載されません
        </p>

        {loading && <div className="py-6">読み込み中...</div>}
        {error && (
          <div className="py-4 text-red-600">
            ランキングの取得に失敗しました: {error}
          </div>
        )}

        {!loading && !error && (
          <div className="overflow-x-auto bg-white shadow rounded-xl">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left p-3 w-16">順位</th>
                  <th className="text-left p-3">プレイヤー</th>
                  <th className="text-right p-3 w-24">レート</th>
                  <th className="text-right p-3 w-28">最高</th>
                  <th className="text-right p-3 w-24">試合</th>
                  <th className="text-right p-3 w-24">勝利</th>
                  <th className="text-right p-3 w-24">勝率</th>
                  <th className="text-left p-3 w-40">最終試合</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((r) => {
                  // サーバーのwin_rateを優先、なければ計算
                  const winRate = r.win_rate ?? calcWinRate(r.match_count, r.win_count);
                  const avatar = r.discord_avatar_url || "/unitemate-logo.png";
                  return (
                    <tr key={r.user_id} className="border-t border-gray-100">
                      <td className="p-3 font-semibold">{r.rank}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={avatar}
                            alt={r.trainer_name}
                            className="w-9 h-9 rounded-full object-cover"
                          />
                          <div className="flex items-center gap-2">
                            <div className="font-medium">{r.trainer_name}</div>
                            {r.twitter_id && (
                              <a
                                href={`https://x.com/${r.twitter_id.replace(/^@/, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Xで${r.trainer_name}を開く (${r.twitter_id})`}
                                className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100 text-gray-500 hover:text-black transition-colors"
                                title={r.twitter_id}
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  width="16"
                                  height="16"
                                  fill="currentColor"
                                  aria-hidden="true"
                                >
                                  <path d="M18.244 2H21.5l-7.5 8.57L23.5 22h-5.828l-4.57-5.966L7.75 22H4.5l8.047-9.19L2.5 2h5.914l4.134 5.493L18.244 2zm-1.023 18h1.418L7.315 4h-1.5l10.406 16z" />
                                </svg>
                              </a>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-right font-medium">{r.rate}</td>
                      <td className="p-3 text-right">{r.max_rate ?? "-"}</td>
                      <td className="p-3 text-right">{r.match_count ?? 0}</td>
                      <td className="p-3 text-right">{r.win_count ?? 0}</td>
                      <td className="p-3 text-right">{winRate.toFixed(1)}%</td>
                      <td className="p-3">
                        {formatRelativeOrDate(r.last_match_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
