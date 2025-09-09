import React from "react";
import { usePublicRanking, type RankingUser } from "../hooks/usePublicRanking";
import { getBadgeSync } from "../hooks/useBadges";

interface RankingScreenProps {
  currentUserId?: string;
}

const RankingScreen: React.FC<RankingScreenProps> = () => {
  const { rankings, loading, error, updatedAt, refetch } = usePublicRanking();

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return "🏆";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return rank.toString();
    }
  };

  const formatWinRate = (winRate: number): string => {
    return `${winRate.toFixed(1)}%`;
  };

  // 勲章に基づく行のスタイルを取得
  const getBadgeRowStyle = (user: RankingUser): object => {
    const primaryBadge = user.current_badge
      ? getBadgeSync(user.current_badge)
      : null;
    const secondaryBadge = user.current_badge_2
      ? getBadgeSync(user.current_badge_2)
      : null;

    // 画像バナーがある場合はそれを優先
    let bannerImageUrl =
      primaryBadge?.banner_image || secondaryBadge?.banner_image;

    if (bannerImageUrl) {
      // URLが//で始まる場合はhttps:を追加
      if (bannerImageUrl.startsWith("//")) {
        bannerImageUrl = `https:${bannerImageUrl}`;
      }
      return {
        backgroundImage: `url(${bannerImageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      };
    }

    // グラデーション背景
    // 1つ目の勲章の開始色
    const primaryColor = primaryBadge?.start_color || "transparent";
    // 2つ目の勲章の終了色（1つ目の勲章の終了色は使わない）
    const secondaryColor = secondaryBadge?.end_color || "transparent";

    if (primaryColor !== "transparent" || secondaryColor !== "transparent") {
      return {
        background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
      };
    }

    return {};
  };

  // 勲章に基づく文字色を取得
  const getBadgeTextColor = (user: RankingUser): string => {
    const primaryBadge = user.current_badge
      ? getBadgeSync(user.current_badge)
      : null;
    const secondaryBadge = user.current_badge_2
      ? getBadgeSync(user.current_badge_2)
      : null;

    const badgeCharColor =
      primaryBadge?.char_color || secondaryBadge?.char_color;
    if (badgeCharColor) {
      return badgeCharColor;
    }

    // CharColorが設定されていない場合はデフォルト（黒文字）
    return "inherit";
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-500">ランキングを読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">{error}</p>
        <button
          onClick={refetch}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          再試行
        </button>
      </div>
    );
  }

  return (
    <div className="w-full py-2 sm:py-4">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6 text-center px-4">
        ランキング
      </h2>

      <div className="bg-white sm:rounded-lg sm:shadow-lg overflow-hidden">
        <div className="w-full">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-1 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold text-gray-700 w-12 sm:w-16">
                  順位
                </th>
                <th className="px-1 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-700">
                  プレイヤー
                </th>
                <th className="px-1 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold text-gray-700 w-16 sm:w-20">
                  レート
                </th>
                <th className="px-1 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold text-gray-700 w-16 sm:w-20">
                  勝率
                </th>
                <th className="px-1 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold text-gray-700 w-10 sm:w-12"></th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((user) => {
                // 各プレイヤーの勲章デザインを適用
                const badgeRowStyle = getBadgeRowStyle(user);
                const badgeTextColor = getBadgeTextColor(user);
                const hasCustomBadgeStyle =
                  Object.keys(badgeRowStyle).length > 0;

                return (
                  <tr
                    key={user.user_id}
                    className="border-b transition-colors bg-white hover:bg-gray-50"
                    style={hasCustomBadgeStyle ? badgeRowStyle : {}}
                  >
                    <td
                      className="px-1 sm:px-4 py-3 sm:py-3 text-center"
                      style={
                        hasCustomBadgeStyle ? { color: badgeTextColor } : {}
                      }
                    >
                      <div className="flex justify-center">
                        <span
                          className={`${user.rank <= 3 ? "text-lg sm:text-2xl" : "text-gray-600 font-bold text-sm sm:text-lg"}`}
                        >
                          {getRankIcon(user.rank)}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-1 sm:px-4 py-3 sm:py-3"
                      style={
                        hasCustomBadgeStyle ? { color: badgeTextColor } : {}
                      }
                    >
                      <div className="flex items-center gap-1 sm:gap-3">
                        <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full flex-shrink-0">
                          {user.discord_avatar_url ? (
                            <img
                              src={user.discord_avatar_url}
                              alt={user.trainer_name}
                              className="w-full h-full rounded-full"
                              onError={(e) => {
                                const img = e.target as HTMLImageElement;
                                img.style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center">
                              <span className="text-xs sm:text-base text-gray-500">
                                👤
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-gray-800 text-xs sm:text-base truncate">
                            {user.trainer_name}
                          </div>
                          <div className="text-[10px] sm:text-xs text-gray-500 truncate sm:block hidden">
                            {user.discord_username &&
                              `@${user.discord_username}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td
                      className="px-1 sm:px-4 py-3 sm:py-3 text-center"
                      style={
                        hasCustomBadgeStyle ? { color: badgeTextColor } : {}
                      }
                    >
                      <span className="font-bold text-sm sm:text-lg">
                        {user.rate}
                      </span>
                    </td>
                    <td
                      className="px-1 sm:px-4 py-3 sm:py-3 text-center"
                      style={
                        hasCustomBadgeStyle ? { color: badgeTextColor } : {}
                      }
                    >
                      <span
                        className="font-semibold text-xs sm:text-base"
                        style={
                          hasCustomBadgeStyle ? { color: badgeTextColor } : {}
                        }
                      >
                        {formatWinRate(user.win_rate)}
                      </span>
                    </td>
                    <td className="px-1 sm:px-4 py-3 sm:py-3 text-center">
                      {user.twitter_id && (
                        <a
                          href={`https://twitter.com/${user.twitter_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block p-1 text-blue-500 hover:text-blue-700 transition-colors"
                          title={`@${user.twitter_id}`}
                        >
                          <svg
                            className="w-4 h-4 sm:w-5 sm:h-5"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                          </svg>
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {rankings.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            ランキングデータがありません
          </div>
        )}
      </div>

      <div className="mt-4 text-center text-xs sm:text-sm text-gray-600 px-4 sm:px-2">
        <div>上位100名を表示</div>
        {updatedAt && (
          <div className="mt-2">
            最終更新: {new Date(updatedAt * 1000).toLocaleString("ja-JP")}
          </div>
        )}
      </div>
    </div>
  );
};

export default RankingScreen;
