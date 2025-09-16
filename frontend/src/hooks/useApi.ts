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
  const { getAccessTokenSilently, isAuthenticated, loginWithRedirect } = useAuth0();
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
        if (dummyAuth.isAuthenticated && dummyAuth.accessToken) {
          headers.Authorization = `Bearer ${dummyAuth.accessToken}`;
        } else if (isAuthenticated) {
          try {
            const token = await getAccessTokenSilently({
              cacheMode: "on", // Use cache when available, fallback to refresh
            });
            headers.Authorization = `Bearer ${token}`;
          } catch (error: unknown) {
            // Handle specific Auth0 errors
            const authError = error as { error?: string };
            if (authError.error === 'missing_refresh_token' ||
                authError.error === 'invalid_grant' ||
                authError.error === 'login_required' ||
                authError.error === 'consent_required') {
              console.warn('Token refresh failed, redirecting to login:', authError.error);
              // Redirect to login for fresh authentication
              loginWithRedirect({
                authorizationParams: {
                  prompt: 'login' // Force fresh login
                }
              });
              return {
                error: "Authentication expired, redirecting to login",
                status: 401,
              };
            }
            throw error; // Re-throw other errors
          }
        }

        const API_BASE_URL =
          import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
          method: config.method || "GET",
          headers,
          body: config.body ? JSON.stringify(config.body) : undefined,
        });

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
      loginWithRedirect,
      dummyAuth.isAuthenticated,
      dummyAuth.accessToken,
    ],
  );

  return { callApi };
};