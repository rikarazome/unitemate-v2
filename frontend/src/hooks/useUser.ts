import { useAuth0 } from "@auth0/auth0-react";
import { useCallback, useEffect, useState } from "react";
import { useApi } from "./useApi";

interface UserData {
  user_id: string;
  discord_id: string;
  discord_username: string;
  discord_discriminator?: string;
  discord_avatar?: string;
  rate: number;
  match_count: number;
  win_count: number;
  inqueue_status: string;
  created_at: string;
  updated_at: string;
}

export const useUser = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth0();
  const { callApi } = useApi();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserData = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);

    try {
      const response = await callApi<UserData>("/api/users/me");
      
      if (response.error) {
        setError(response.error);
      } else {
        setUserData(response.data || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch user data");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, callApi]);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchUserData();
    }
  }, [isAuthenticated, authLoading, fetchUserData]);

  return {
    userData,
    loading,
    error,
    refetch: fetchUserData,
  };
};