import { useState, useEffect } from "react";

interface Season {
  id: string;
  name: string;
  description?: string;
  start_date: number;
  end_date: number;
  image_url?: string;
  theme_color?: string;
  is_active: boolean;
  created_at: number;
  updated_at: number;
}

interface SeasonInfo {
  current_season: Season | null;
  is_season_active: boolean;
  next_season: Season | null;
}

export const useSeasonInfo = () => {
  const [seasonInfo, setSeasonInfo] = useState<SeasonInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSeasonInfo = async () => {
    try {
      setLoading(true);
      setError(null);

      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
      const response = await fetch(`${API_BASE_URL}/api/seasons/active`);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      setSeasonInfo(data);
    } catch (err) {
      console.error("Failed to fetch season info:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setSeasonInfo(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeasonInfo();
  }, []);

  const refreshSeasonInfo = () => {
    fetchSeasonInfo();
  };

  return {
    seasonInfo,
    loading,
    error,
    refreshSeasonInfo,
  };
};