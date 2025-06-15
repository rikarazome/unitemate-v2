import { useAuth0 } from "@auth0/auth0-react";
import { useCallback, useEffect, useState } from "react";
import { useApi } from "./useApi";

// Updated to match the new backend User schema
interface UserData {
  user_id: string;
  auth0_sub: string;
  discord_username: string;
  discord_discriminator?: string | null;
  discord_avatar_url: string;
  app_username: string;
  created_at: string;
  updated_at: string;
}

export const useUser = () => {
  // Get user object from Auth0 to create a new user if they don't exist
  const { user, isAuthenticated, isLoading: authLoading } = useAuth0();
  const { callApi } = useApi();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createUser = useCallback(async () => {
    if (!user) return;

    console.log("Creating a new user...");
    try {
      const newUserResponse = await callApi<UserData>("/api/users", {
        method: "POST",
        body: user, // Send the Auth0 user profile to the backend
      });

      if (newUserResponse.error) {
        setError(newUserResponse.error);
      } else {
        setUserData(newUserResponse.data || null);
        console.log("User created successfully.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    }
  }, [user, callApi]);

  const fetchUserData = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);

    try {
      const response = await callApi<UserData>("/api/users/me");

      if (response.status === 404) {
        // User not found, so create them
        await createUser();
      } else if (response.error) {
        setError(response.error);
      } else {
        setUserData(response.data || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch user data");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, callApi, createUser]);

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
    refetch: fetchUserData,
  };
};