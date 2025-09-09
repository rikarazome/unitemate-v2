import { useState, useEffect } from "react";

// API設定
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

// 型定義（useUnitemateApi.tsと同じ）
export interface RankingUser {
  rank: number;
  user_id: string;
  trainer_name: string;
  rate: number;
  best_rate: number;
  win_rate: number;
  win_count: number;
  lose_count: number;
  discord_username?: string;
  discord_avatar_url?: string;
  current_badge?: string;
  current_badge_2?: string;
  twitter_id?: string;
}

export interface RankingResponse {
  rankings: RankingUser[];
  total_count: number;
  updated_at?: number;
}

/**
 * 公開ランキングデータを取得するフック
 * 認証不要で事前計算されたランキングを取得
 */
export const usePublicRanking = () => {
  const [rankings, setRankings] = useState<RankingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | undefined>(undefined);

  const fetchRankings = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/public/ranking`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: RankingResponse = await response.json();
      setRankings(data.rankings);
      setUpdatedAt(data.updated_at);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      console.error("Failed to fetch rankings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRankings();
  }, []);

  return {
    rankings,
    loading,
    error,
    updatedAt,
    refetch: fetchRankings,
  };
};
