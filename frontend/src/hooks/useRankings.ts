import { useCallback, useEffect, useState } from "react";
import { useApi } from "./useApi";
import type { RankingEntry } from "../types/ranking";

export const useRankings = (limit: number = 100) => {
  const { callApi } = useApi();
  const [data, setData] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRankings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await callApi<RankingEntry[]>(
        `/api/rankings?limit=${encodeURIComponent(limit)}`,
      );
      if (res.error) {
        setError(res.error);
        setData([]);
      } else {
        setData(res.data || []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch rankings");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [callApi, limit]);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  return { rankings: data, loading, error, refetch: fetchRankings };
};
