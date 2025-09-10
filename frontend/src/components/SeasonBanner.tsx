import React from "react";
import { useSeasonInfo } from "../hooks/useSeasonInfo";

const SeasonBanner: React.FC = () => {
  const { seasonInfo, loading, error } = useSeasonInfo();

  // ローディング中や取得失敗時は何も表示しない
  if (loading || error || !seasonInfo?.is_season_active || !seasonInfo.current_season) {
    return null;
  }

  const season = seasonInfo.current_season;

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isSeasonEnding = () => {
    const now = Date.now() / 1000;
    const timeLeft = season.end_date - now;
    const daysLeft = timeLeft / (24 * 60 * 60);
    return daysLeft <= 7; // 残り7日以下で警告
  };

  const getDaysLeft = () => {
    const now = Date.now() / 1000;
    const timeLeft = season.end_date - now;
    const daysLeft = Math.ceil(timeLeft / (24 * 60 * 60));
    return Math.max(0, daysLeft);
  };

  return (
    <div
      className="relative mb-6 rounded-xl overflow-hidden shadow-lg"
      style={{
        background: `linear-gradient(135deg, ${season.theme_color || "#ff6b35"}20, ${season.theme_color || "#ff6b35"}40)`,
        borderLeft: `4px solid ${season.theme_color || "#ff6b35"}`,
      }}
    >
      {/* 背景イメージ（あれば） */}
      {season.image_url && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: `url(${season.image_url})` }}
        />
      )}

      <div className="relative p-4 md:p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* シーズン情報 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-3 h-3 rounded-full animate-pulse"
                style={{ backgroundColor: season.theme_color || "#ff6b35" }}
              />
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 truncate">
                {season.name}
              </h2>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                開催中
              </span>
            </div>

            {season.description && (
              <p className="text-gray-700 text-sm md:text-base mb-3 line-clamp-2">
                {season.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>
                  {formatDate(season.start_date)} 〜 {formatDate(season.end_date)}
                </span>
              </div>

              {isSeasonEnding() && (
                <div className="flex items-center gap-1 text-orange-600 font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>残り{getDaysLeft()}日</span>
                </div>
              )}
            </div>
          </div>

          {/* 次シーズン予告（あれば） */}
          {seasonInfo.next_season && (
            <div className="bg-white/70 backdrop-blur-sm rounded-lg p-3 min-w-0 max-w-xs">
              <div className="text-xs text-gray-500 mb-1">次シーズン予告</div>
              <div className="font-medium text-gray-900 truncate">
                {seasonInfo.next_season.name}
              </div>
              <div className="text-xs text-gray-600">
                {formatDateTime(seasonInfo.next_season.start_date)}開始
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SeasonBanner;