import { useAuth0 } from "@auth0/auth0-react";
import { useCallback } from "react";

interface ApiConfig {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

export const useApi = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  const callApi = useCallback(
    async <T>(endpoint: string, config: ApiConfig = {}): Promise<ApiResponse<T>> => {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...config.headers,
        };

        if (isAuthenticated) {
          const token = await getAccessTokenSilently();
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}${endpoint}`,
          {
            method: config.method || "GET",
            headers,
            body: config.body ? JSON.stringify(config.body) : undefined,
          }
        );

        const data = await response.json();

        return {
          data: response.ok ? data : undefined,
          error: response.ok ? undefined : data.error || "Unknown error",
          status: response.status,
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "Network error",
          status: 0,
        };
      }
    },
    [getAccessTokenSilently, isAuthenticated]
  );

  return { callApi };
};