import { useAuth0 } from "@auth0/auth0-react";
import { useCallback } from "react";
import { useDummyAuth } from "./useDummyAuth";

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
  const dummyAuth = useDummyAuth();

  const callApi = useCallback(
    async <T>(
      endpoint: string,
      config: ApiConfig = {},
    ): Promise<ApiResponse<T>> => {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...config.headers,
        };

        // ダミー認証またはAuth0認証のトークンを設定
        console.log("useApi - Auth state:", {
          dummyAuth_isAuthenticated: dummyAuth.isAuthenticated,
          dummyAuth_hasToken: !!dummyAuth.accessToken,
          auth0_isAuthenticated: isAuthenticated,
          dummyTokenPrefix: dummyAuth.accessToken
            ? dummyAuth.accessToken.substring(0, 20) + "..."
            : "null",
        });

        if (dummyAuth.isAuthenticated && dummyAuth.accessToken) {
          console.log(
            "useApi - Using dummy auth token:",
            dummyAuth.accessToken.substring(0, 50) + "...",
          );
          headers.Authorization = `Bearer ${dummyAuth.accessToken}`;
        } else if (isAuthenticated) {
          console.log("useApi - Using Auth0 token");
          const token = await getAccessTokenSilently();
          console.log(
            "useApi - Auth0 token prefix:",
            token.substring(0, 20) + "...",
          );
          headers.Authorization = `Bearer ${token}`;
        } else {
          console.log("useApi - No authentication available");
        }

        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}${endpoint}`,
          {
            method: config.method || "GET",
            headers,
            body: config.body ? JSON.stringify(config.body) : undefined,
          },
        );

        const data = await response.json();

        return {
          data: data, // Return data even for error responses (for needs_registration check)
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
    [
      getAccessTokenSilently,
      isAuthenticated,
      dummyAuth.isAuthenticated,
      dummyAuth.accessToken,
    ],
  );

  return { callApi };
};
