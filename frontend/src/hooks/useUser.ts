import { useAuth0 } from "@auth0/auth0-react";
import { useCallback, useEffect, useState } from "react";
import { useApi } from "./useApi";
import type { User } from "../types/user";

export const useUser = () => {
  const {
    isAuthenticated,
    isLoading: authLoading,
    user: auth0User,
    getAccessTokenSilently,
  } = useAuth0();
  const { callApi } = useApi();
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shouldShowUserCreation, setShouldShowUserCreation] = useState(false);

  const createUser = useCallback(async (userData: User) => {
    setUserData(userData);
    setShouldShowUserCreation(false);
  }, []);

  const updateDiscordInfo = useCallback(
    async (currentUser: User) => {
      if (!auth0User || !isAuthenticated) return;

      try {
        const token = await getAccessTokenSilently();

        // Auth0のIDトークンから取得したDiscord情報を専用エンドポイントで更新
        const updateData = {
          auth0_profile: auth0User,
        };

        const response = await callApi<User>("/api/users/me/discord", {
          method: "PUT",
          body: updateData,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.data && !response.error) {
          setUserData(response.data);
          setShouldShowUserCreation(false);
        } else {
          console.error(
            "useUser - Failed to update Discord info:",
            response.error,
          );
          // 更新に失敗してもユーザーデータは表示
          setUserData(currentUser);
          setShouldShowUserCreation(false);
        }
      } catch (err) {
        console.error("useUser - Error updating Discord info:", err);
        // エラーが発生してもユーザーデータは表示
        setUserData(currentUser);
        setShouldShowUserCreation(false);
      }
    },
    [isAuthenticated, callApi, auth0User, getAccessTokenSilently],
  );

  const createUserIfNeeded = useCallback(async () => {
    if (!auth0User || !isAuthenticated) return false;

    try {
      const token = await getAccessTokenSilently();

      // First, debug what Auth0 info we're sending

      // Call debug endpoint to see what the backend receives
      const debugResponse = await callApi<unknown>("/api/debug/auth", {
        method: "POST",
        body: JSON.stringify({
          auth0_profile: auth0User,
          trainer_name: auth0User.nickname || auth0User.name || "Trainer",
          twitter_id: "",
          preferred_roles: [],
          bio: "",
        }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });


      // Create user with Auth0 profile data
      // 重要: useApiで自動的にJSON.stringify()されるため、ここでは生のオブジェクトを渡す
      const response = await callApi<User>("/api/users", {
        method: "POST",
        body: {
          auth0_profile: auth0User,
          trainer_name: auth0User.nickname || auth0User.name || "Trainer",
          twitter_id: "",
          preferred_roles: [],
          bio: "",
        },
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data && !response.error) {
        setUserData(response.data);
        return true;
      } else {
        console.error("useUser - Failed to create user:", response.error);
        return false;
      }
    } catch (err) {
      console.error("useUser - Error creating user:", err);
      return false;
    }
  }, [isAuthenticated, callApi, auth0User, getAccessTokenSilently]);

  const fetchUserData = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);
    setShouldShowUserCreation(false);

    try {
      const response = await callApi<User & { needs_registration?: boolean }>(
        "/api/users/me",
      );

      if (response.status === 404) {
        // Try to create user automatically
        const created = await createUserIfNeeded();
        if (!created) {
          // If auto-creation fails, show the creation form
          setShouldShowUserCreation(true);
        }
      } else if (response.error) {
        setError(response.error);
      } else if (response.data) {

        // プレースホルダーのDiscordユーザー名の場合、IDトークンから取得した情報で更新
        if (response.data.discord_username?.startsWith("User_") && auth0User) {
          await updateDiscordInfo(response.data);
        } else {
          setUserData(response.data);
          setShouldShowUserCreation(false);
        }
      }
    } catch (err) {
      console.error("useUser - Fetch error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch user data",
      );
    } finally {
      setLoading(false);
    }
  }, [
    isAuthenticated,
    callApi,
    createUserIfNeeded,
    auth0User,
    updateDiscordInfo,
  ]);

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
