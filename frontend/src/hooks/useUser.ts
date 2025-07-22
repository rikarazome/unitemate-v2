import { useAuth0 } from "@auth0/auth0-react";
import { useCallback, useEffect, useState } from "react";
import { useApi } from "./useApi";
import type { User } from "../types/user";

export const useUser = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth0();
  const { callApi } = useApi();
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shouldShowUserCreation, setShouldShowUserCreation] = useState(false);

  const createUser = useCallback(async (userData: User) => {
    setUserData(userData);
    setShouldShowUserCreation(false);
  }, []);

  const fetchUserData = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);
    setShouldShowUserCreation(false);

    try {
      const response = await callApi<User>("/api/users/me");

      if (response.status === 404) {
        // User not found, show user creation form
        setShouldShowUserCreation(true);
      } else if (response.error) {
        setError(response.error);
      } else {
        setUserData(response.data || null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch user data",
      );
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, callApi]);

  useEffect(() => {
    // Fetch data only when authentication is complete and user is authenticated
    if (isAuthenticated && !authLoading) {
      fetchUserData();
    }
  }, [isAuthenticated, authLoading, fetchUserData]);

  return {
    userData,
    loading,
    error,
    shouldShowUserCreation,
    onUserCreated: createUser,
    refetch: fetchUserData,
  };
};
