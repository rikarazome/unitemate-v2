import React, { useState, useEffect, useCallback } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import type { MasterDataResponse, UpdateProfileRequest } from "../types/common";
import type { MatchData } from "../components/MatchScreen";
import { useDummyAuth } from "./useDummyAuth";

// API設定 - セキュリティのため、直接AWS APIではなく自社バックエンド経由で呼び出し
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

// 型定義
export interface UserInfo {
  user_id: string;
  auth0_sub: string;
  discord_username: string;
  discord_discriminator?: string | null;
  discord_avatar_url: string;
  trainer_name: string;
  twitter_id?: string | null;
  preferred_roles?: string[];
  favorite_pokemon?: string[];
  current_badge?: string;
  current_badge_2?: string;
  owned_badges?: string[];
  bio?: string | null;
  rate: number;
  max_rate: number;
  match_count: number;
  win_count: number;
  win_rate: number;
  penalty_count: number;
  penalty_correction: number; // ペナルティ軽減数
  penalty_timeout_until?: number | null; // ペナルティタイムアウト終了時刻
  latest_matches?: MatchRecord[]; // 直近50戦の戦績
  season_data?: Array<{
    season_id: string;
    season_name: string;
    final_rate: number;
    max_rate: number;
    win_rate: number;
    final_rank: number;
    total_matches: number;
    wins: number;
  }>;
  created_at: number;
  updated_at: number;
}

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
  twitter_id?: string;
  current_badge?: string;
  current_badge_2?: string;
}

export interface RankingResponse {
  rankings: RankingUser[];
  total_count: number;
}

export interface MatchRecord {
  pokemon: string;
  match_id: number;
  rate_delta: number;
  started_date: number;
  winlose: number; // 0: lose, 1: win, 2: invalid
}

// キュー関連の型定義
export interface QueueInfo {
  total_waiting: number;
  ongoing_matches: number;
  ongoing_match_players: string[]; // 自動試合画面切り替え用
  role_counts: {
    [key: string]: number; // 各ロールの待機人数のみ
  };
  previous_matched_unixtime: number; // 前回マッチ時刻（Unix timestamp）
  previous_user_count: number; // 前回マッチ時のキュー人数
  average_wait_time?: number; // 平均待機時間（秒）
}

export interface QueueEntryRequest {
  blocking?: string;
  selected_roles?: string[]; // オプション: 選択したロールのリスト
}

// ポケモン関連のインターフェース
export interface PokemonData {
  pokemon_id: string;
  name_ja: string;
  name_en: string;
  type: string;
  icon_url: string;
  moves: Record<string, string>;
}

// Auth0プロフィール関連のインターフェース
export interface Auth0Profile {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
  [key: string]: unknown;
}

export interface UserQueueStatus {
  in_queue: boolean;
  entry?: {
    user_id: string;
    inqueued_at: number;
    blocking?: string;
    selected_roles: string[]; // 選択したロールのリスト
  };
}

export interface RankingEntry {
  user_id: string;
  rate: number;
  win_rate: number;
}

export interface RankingResponse {
  rankings: RankingUser[];
}

// APIクライアント - Auth0トークン認証を使用
class UnitemateApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    token?: string,
  ): Promise<T> {
    const url = `${this.baseUrl}/api${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    // Auth0トークンがある場合は認証ヘッダーを追加
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      // Try to parse error response body
      try {
        const errorBody = await response.json();
        throw new Error(JSON.stringify(errorBody));
      } catch {
        throw new Error(
          `API request failed: ${response.status} ${response.statusText}`,
        );
      }
    }

    return response.json();
  }

  // ユーザー情報取得
  async getUserInfo(token?: string): Promise<UserInfo> {
    return this.request<UserInfo>(`/users/me`, {}, token);
  }

  async getUserDetails(userId: string, token?: string): Promise<UserInfo> {
    return this.request<UserInfo>(`/users/${userId}`, {}, token);
  }

  // ユーザー作成
  async createUser(
    userData: {
      auth0_profile: Auth0Profile;
      trainer_name: string;
      twitter_id?: string;
      preferred_roles?: string[];
      bio?: string;
    },
    token?: string,
  ): Promise<UserInfo> {
    return this.request<UserInfo>(
      `/users`,
      {
        method: "POST",
        body: JSON.stringify(userData),
      },
      token,
    );
  }

  // ユーザーの試合記録取得
  async getUserRecords(
    _userId?: string,
    token?: string,
  ): Promise<{ latest_matches: MatchRecord[] }> {
    return this.request<{ latest_matches: MatchRecord[] }>(
      `/users/me/records`,
      {},
      token,
    );
  }

  // ランキング取得
  async getRanking(token?: string): Promise<RankingResponse> {
    return this.request<RankingResponse>("/users/ranking", {}, token);
  }

  // マスターデータ取得
  async getMasterData(token?: string): Promise<MasterDataResponse> {
    return this.request<MasterDataResponse>("/master", {}, token);
  }

  // 設定更新
  async updateSetting(
    data: { id: string; value: string | number },
    token?: string,
  ): Promise<void> {
    return this.request<void>(
      "/master/settings",
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
      token,
    );
  }

  // プロフィール更新
  async updateProfile(
    data: UpdateProfileRequest,
    token?: string,
  ): Promise<void> {
    return this.request<void>(
      `/users/me/profile`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
      token,
    );
  }

  // Pokemon関連
  async getAllPokemon(token?: string): Promise<PokemonData[]> {
    return this.request<PokemonData[]>("/pokemon", {}, token);
  }

  async getPokemonByRole(role: string, token?: string): Promise<PokemonData[]> {
    return this.request<PokemonData[]>(`/pokemon/role/${role}`, {}, token);
  }

  // Achievements関連
  async getUserAchievements(
    token?: string,
  ): Promise<Array<{ id: string; name: string; earned_at: number }>> {
    return this.request<Array<{ id: string; name: string; earned_at: number }>>(
      "/users/me/achievements",
      {},
      token,
    );
  }

  // キュー関連のAPI
  async getQueueInfo(token?: string): Promise<QueueInfo> {
    return this.request<QueueInfo>("/queue", {}, token);
  }

  async joinQueue(
    request: QueueEntryRequest = {},
    token?: string,
  ): Promise<void> {
    return this.request<void>(
      "/queue/join",
      {
        method: "POST",
        body: JSON.stringify(request),
      },
      token,
    );
  }

  async leaveQueue(token?: string): Promise<void> {
    return this.request<void>(
      "/queue/leave",
      {
        method: "POST",
      },
      token,
    );
  }

  async getMyQueueStatus(token?: string): Promise<UserQueueStatus> {
    try {
      return await this.request<UserQueueStatus>("/queue/me", {}, token);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes("404")) {
        return { in_queue: false };
      }
      throw error;
    }
  }

  async getRecentAchievements(
    limit: number = 10,
    token?: string,
  ): Promise<Array<{ id: string; name: string; earned_at: number }>> {
    return this.request<Array<{ id: string; name: string; earned_at: number }>>(
      `/users/me/achievements/recent?limit=${limit}`,
      {},
      token,
    );
  }

  async checkAchievements(token?: string): Promise<unknown> {
    return this.request<unknown>(
      "/users/me/achievements/check",
      {
        method: "POST",
        body: JSON.stringify({}),
      },
      token,
    );
  }

  // 試合関連のメソッド
  async getCurrentMatch(token?: string): Promise<unknown> {
    return this.request<unknown>("/matches/current", {}, token);
  }

  async reportMatchResult(
    matchId: string,
    reportData: {
      result: "A-win" | "B-win" | "invalid";
      banned_pokemon: string;
      picked_pokemon: string;
      pokemon_move1: string;
      pokemon_move2: string;
      violation_report?: string;
    },
    token?: string,
  ): Promise<void> {
    return this.request<void>(
      `/matches/${matchId}/report`,
      {
        method: "POST",
        body: JSON.stringify(reportData),
      },
      token,
    );
  }

  // ロビーID関連のメソッド
  async updateLobbyId(
    lobbyId: string,
    hostUserId?: string,
    token?: string,
  ): Promise<void> {
    return this.request<void>(
      "/matches/lobby/update",
      {
        method: "POST",
        body: JSON.stringify({ lobby_id: lobbyId, host_user_id: hostUserId }),
      },
      token,
    );
  }

  async transferHost(token?: string): Promise<void> {
    return this.request<void>(
      "/matches/host/transfer",
      {
        method: "POST",
        body: JSON.stringify({}),
      },
      token,
    );
  }

  // ランキング関連のメソッド（認証不要）
  async getUserRanking(): Promise<RankingResponse> {
    return this.request<RankingResponse>("/users/ranking", {
      method: "GET",
    });
  }

  // 管理者用試合管理API
  async getAdminMatches(
    status: string = "all",
    token?: string,
  ): Promise<{ matches: MatchData[] }> {
    const params = new URLSearchParams({ status });
    return this.request<{ matches: MatchData[] }>(
      `/admin/matches?${params}`,
      {},
      token,
    );
  }

  async getAdminMatchDetail(
    matchId: string,
    token?: string,
  ): Promise<MatchData> {
    return this.request<MatchData>(`/admin/matches/${matchId}`, {}, token);
  }

  // Discord サーバー参加確認
  async checkDiscordServerMembership(
    token?: string,
  ): Promise<{
    is_member: boolean;
    discord_user_id?: string;
    guild_id?: string;
    message?: string;
    reason?: string;
  }> {
    return this.request<{
      is_member: boolean;
      discord_user_id?: string;
      guild_id?: string;
      message?: string;
      reason?: string;
    }>("/discord/check-membership", {}, token);
  }

  // Stripe決済 - Checkoutセッション作成
  async createCheckoutSession(
    badgeData: {
      badgeId: string;
      badgeName: string;
      price: number;
      userId?: string;
    },
    token?: string,
  ): Promise<{ url: string; session_id: string }> {
    return this.request<{ url: string; session_id: string }>(
      "/create-checkout-session",
      {
        method: "POST",
        body: JSON.stringify(badgeData),
      },
      token,
    );
  }
}

// シングルトンクライアント
const apiClient = new UnitemateApiClient(API_BASE_URL);

// カスタムフック
export const useUserInfo = () => {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const dummyAuth = useDummyAuth();

  const fetchUserInfo = useCallback(async () => {
    // ダミー認証またはAuth0認証のどちらかが有効でない場合はスキップ
    if (!isAuthenticated && !dummyAuth.isAuthenticated) return;

    setLoading(true);
    setError(null);
    setNeedsRegistration(false);
    try {
      let token: string;
      if (dummyAuth.isAuthenticated && dummyAuth.accessToken) {
        token = dummyAuth.accessToken;
      } else {
        token = await getAccessTokenSilently();
      }
      const data = await apiClient.getUserInfo(token);
      setUserInfo(data);
    } catch (err) {
      if (err instanceof Error) {
        // Check if this is a "needs registration" error
        try {
          const errorBody = JSON.parse(err.message);
          if (errorBody.needs_registration) {
            setNeedsRegistration(true);
          } else {
            setError(err.message);
          }
        } catch {
          // Not a JSON error, treat as regular error
          // 404エラーの場合は自動作成が試行されているはずなので、少し待ってからリトライ
          if (
            err.message.includes("404") ||
            err.message.includes("User not found")
          ) {
            setTimeout(() => {
              fetchUserInfo();
            }, 1000); // 1秒後にリトライ
          } else {
            setError(err.message);
          }
        }
      } else {
        setError("Unknown error");
      }
    } finally {
      setLoading(false);
    }
  }, [
    isAuthenticated,
    getAccessTokenSilently,
    dummyAuth.isAuthenticated,
    dummyAuth.accessToken,
  ]);

  useEffect(() => {
    fetchUserInfo();
  }, [fetchUserInfo]);

  return {
    userInfo,
    loading,
    error,
    needsRegistration,
    refetch: fetchUserInfo,
  };
};

export const useUserRecords = (userId?: string) => {
  const [records, setRecords] = useState<MatchRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const dummyAuth = useDummyAuth();

  useEffect(() => {
    if (!userId || (!isAuthenticated && !dummyAuth.isAuthenticated)) return;

    const fetchRecords = async () => {
      setLoading(true);
      setError(null);
      try {
        let token: string;
        if (dummyAuth.isAuthenticated && dummyAuth.accessToken) {
          token = dummyAuth.accessToken;
        } else {
          token = await getAccessTokenSilently();
        }
        const data = await apiClient.getUserRecords(userId, token);
        setRecords(data.latest_matches);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, [
    userId,
    isAuthenticated,
    getAccessTokenSilently,
    dummyAuth.isAuthenticated,
    dummyAuth.accessToken,
  ]);

  return { records, loading, error };
};

export const useQueueInfo = () => {
  const [queueInfo, setQueueInfo] = useState<QueueInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const dummyAuth = useDummyAuth();

  const fetchQueueInfo = useCallback(
    async (showLoading = false) => {
      if (!isAuthenticated && !dummyAuth.isAuthenticated) return;

      if (showLoading) {
        setLoading(true);
      }
      setError(null);
      try {
        let token: string;
        if (dummyAuth.isAuthenticated && dummyAuth.accessToken) {
          token = dummyAuth.accessToken;
        } else {
          token = await getAccessTokenSilently();
        }
        const data = await apiClient.getQueueInfo(token);
        setQueueInfo(data);
        setRetryCount(0); // Reset retry count on success
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);

        // Auth0のgetAccessTokenSilentlyが失敗した場合、または401/403エラーの場合
        if (
          err instanceof Error &&
          (err.message.includes("Login required") ||
            err.message.includes("Missing Refresh Token") ||
            err.message.includes("The user is not authenticated") ||
            errorMessage.includes("401") ||
            errorMessage.includes("403") ||
            errorMessage.includes("Unauthorized"))
        ) {
          console.warn("Authentication issue detected, stopping queue updates");
          setRetryCount(999); // 大きな値を設定して即座に停止
          setError("認証の有効期限が切れました。再度ログインしてください。");
          return;
        }

        setRetryCount((prev) => prev + 1);
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [
      isAuthenticated,
      getAccessTokenSilently,
      dummyAuth.isAuthenticated,
      dummyAuth.accessToken,
    ],
  );

  useEffect(() => {
    if (!isAuthenticated && !dummyAuth.isAuthenticated) return;

    // 初回のみローディング表示
    fetchQueueInfo(true);

    // エラーが連続する場合は定期更新を停止
    if (retryCount >= 3) {
      console.warn(
        "Queue info fetch failed 3 times, stopping automatic updates",
      );
      return;
    }

    // リソース不足エラーや接続エラーの場合は即座に停止
    if (
      error &&
      (error.includes("ERR_INSUFFICIENT_RESOURCES") ||
        error.includes("Failed to fetch"))
    ) {
      console.warn(
        "Queue info fetch disabled due to resource/connection errors:",
        error,
      );
      return;
    }

    // WebSocketが無効の場合のみポーリング（10秒間隔）
    // WebSocket有効時はこのポーリングは不要
    const interval = setInterval(() => fetchQueueInfo(false), 10000);
    return () => clearInterval(interval);
  }, [
    isAuthenticated,
    getAccessTokenSilently,
    fetchQueueInfo,
    retryCount,
    dummyAuth.isAuthenticated,
    error,
  ]);

  return { queueInfo, loading, error, refetch: () => fetchQueueInfo(true) };
};

export const useRanking = () => {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const dummyAuth = useDummyAuth();

  useEffect(() => {
    if (!isAuthenticated && !dummyAuth.isAuthenticated) return;

    const fetchRanking = async () => {
      setLoading(true);
      setError(null);
      try {
        let token: string;
        if (dummyAuth.isAuthenticated && dummyAuth.accessToken) {
          token = dummyAuth.accessToken;
        } else {
          token = await getAccessTokenSilently();
        }
        const data = await apiClient.getRanking(token);
        setRankings(data.rankings);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchRanking();
  }, [
    isAuthenticated,
    getAccessTokenSilently,
    dummyAuth.isAuthenticated,
    dummyAuth.accessToken,
  ]);

  return { rankings, loading, error };
};

export const useMatchQueue = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userStatus, setUserStatus] = useState<UserQueueStatus>({
    in_queue: false,
  });
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const dummyAuth = useDummyAuth();

  const joinQueue = async (request: QueueEntryRequest = {}) => {
    if (!isAuthenticated && !dummyAuth.isAuthenticated) return;

    setLoading(true);
    setError(null);
    try {
      let token: string;
      if (dummyAuth.isAuthenticated && dummyAuth.accessToken) {
        token = dummyAuth.accessToken;
      } else {
        token = await getAccessTokenSilently();
      }
      await apiClient.joinQueue(request, token);
      await checkStatus(); // 状態を更新
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const leaveQueue = async () => {
    if (!isAuthenticated && !dummyAuth.isAuthenticated) return;

    setLoading(true);
    setError(null);
    try {
      let token: string;
      if (dummyAuth.isAuthenticated && dummyAuth.accessToken) {
        token = dummyAuth.accessToken;
      } else {
        token = await getAccessTokenSilently();
      }
      await apiClient.leaveQueue(token);
      await checkStatus(); // 状態を更新
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = useCallback(async () => {
    if (!isAuthenticated && !dummyAuth.isAuthenticated) return;

    try {
      let token: string;
      if (dummyAuth.isAuthenticated && dummyAuth.accessToken) {
        token = dummyAuth.accessToken;
      } else {
        token = await getAccessTokenSilently();
      }
      const status = await apiClient.getMyQueueStatus(token);
      setUserStatus(status);
      setError(null); // 成功時はエラーをクリア
    } catch (err) {
      console.error("Failed to check queue status:", err);
      setError(
        err instanceof Error ? err.message : "Queue status check failed",
      );
      setUserStatus({ in_queue: false });
    }
  }, [
    isAuthenticated,
    getAccessTokenSilently,
    dummyAuth.isAuthenticated,
    dummyAuth.accessToken,
  ]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // 10秒ごとに状態をチェック（エラーが多い場合は停止）
  useEffect(() => {
    if (!userStatus.in_queue) return;
    if (
      error &&
      (error.includes("404") ||
        error.includes("500") ||
        error.includes("CORS") ||
        error.includes("ERR_INSUFFICIENT_RESOURCES") ||
        error.includes("Failed to fetch"))
    ) {
      console.warn("Queue status check disabled due to backend errors:", error);
      return;
    }

    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [userStatus.in_queue, checkStatus, error]);

  return {
    joinQueue,
    leaveQueue,
    checkStatus,
    loading,
    error,
    isInQueue: userStatus.in_queue,
    queueEntry: userStatus.entry,
  };
};

// マスターデータ取得フック
export const useMasterData = () => {
  const [masterData, setMasterData] = useState<MasterDataResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const dummyAuth = useDummyAuth();

  useEffect(() => {
    if (!isAuthenticated && !dummyAuth.isAuthenticated) return;

    const fetchMasterData = async () => {
      setLoading(true);
      setError(null);
      try {
        let token: string;
        if (dummyAuth.isAuthenticated && dummyAuth.accessToken) {
          token = dummyAuth.accessToken;
        } else {
          token = await getAccessTokenSilently();
        }
        const data = await apiClient.getMasterData(token);
        setMasterData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchMasterData();
  }, [
    isAuthenticated,
    getAccessTokenSilently,
    dummyAuth.isAuthenticated,
    dummyAuth.accessToken,
  ]);

  return { masterData, loading, error };
};

// プロフィール更新フック
export const useUpdateProfile = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getAccessTokenSilently, user, isAuthenticated } = useAuth0();
  const dummyAuth = useDummyAuth();

  const updateProfile = async (data: UpdateProfileRequest) => {
    if (
      (!user && !dummyAuth.isAuthenticated) ||
      (!isAuthenticated && !dummyAuth.isAuthenticated)
    )
      return;

    setLoading(true);
    setError(null);
    try {
      let token: string;
      if (dummyAuth.isAuthenticated && dummyAuth.accessToken) {
        token = dummyAuth.accessToken;
      } else {
        token = await getAccessTokenSilently();
      }
      await apiClient.updateProfile(data, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { updateProfile, loading, error };
};

// ユーザー作成フック
export const useCreateUser = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getAccessTokenSilently, user, isAuthenticated } = useAuth0();
  const dummyAuth = useDummyAuth();

  const createUser = async (userData: {
    trainer_name: string;
    twitter_id?: string;
    preferred_roles?: string[];
    bio?: string;
  }) => {
    if (
      (!user && !dummyAuth.isAuthenticated) ||
      (!isAuthenticated && !dummyAuth.isAuthenticated)
    )
      return null;

    setLoading(true);
    setError(null);
    try {
      let token: string;
      if (dummyAuth.isAuthenticated && dummyAuth.accessToken) {
        token = dummyAuth.accessToken;
      } else {
        token = await getAccessTokenSilently();
      }
      const result = await apiClient.createUser(
        {
          auth0_profile: user ? { sub: user.sub || "", ...user } : { sub: "" }, // Use empty object for dummy users
          ...userData,
        },
        token,
      );
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { createUser, loading, error };
};

// UnitemateApiClient直接アクセス用フック
export const useUnitemateApi = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const dummyAuth = useDummyAuth();

  return React.useMemo(
    () => ({
      unitemateApi: {
        async getCurrentMatch() {
          let token: string | undefined;
          if (dummyAuth.isAuthenticated && dummyAuth.accessToken) {
            token = dummyAuth.accessToken;
          } else if (isAuthenticated) {
            token = await getAccessTokenSilently();
          }
          return apiClient.getCurrentMatch(token);
        },
        async reportMatchResult(
          matchId: string,
          reportData: {
            result: "A-win" | "B-win" | "invalid";
            banned_pokemon: string;
            picked_pokemon: string;
            pokemon_move1: string;
            pokemon_move2: string;
            violation_report?: string;
          },
        ) {
          let token: string | undefined;
          if (dummyAuth.isAuthenticated && dummyAuth.accessToken) {
            token = dummyAuth.accessToken;
          } else if (isAuthenticated) {
            token = await getAccessTokenSilently();
          }
          return apiClient.reportMatchResult(matchId, reportData, token);
        },
        async updateLobbyId(lobbyId: string, hostUserId?: string) {
          let token: string | undefined;
          if (dummyAuth.isAuthenticated && dummyAuth.accessToken) {
            token = dummyAuth.accessToken;
          } else if (isAuthenticated) {
            token = await getAccessTokenSilently();
          }
          return apiClient.updateLobbyId(lobbyId, hostUserId, token);
        },
        async transferHost() {
          let token: string | undefined;
          if (dummyAuth.isAuthenticated && dummyAuth.accessToken) {
            token = dummyAuth.accessToken;
          } else if (isAuthenticated) {
            token = await getAccessTokenSilently();
          }
          return apiClient.transferHost(token);
        },
        async getUserRanking() {
          // ランキングは認証不要で取得
          return apiClient.getUserRanking();
        },
        async getUserDetails(userId: string) {
          let token: string | undefined;
          if (dummyAuth.isAuthenticated && dummyAuth.accessToken) {
            token = dummyAuth.accessToken;
          } else if (isAuthenticated) {
            token = await getAccessTokenSilently();
          }
          return apiClient.getUserDetails(userId, token);
        },
        async getAdminMatches(
          status: string = "all",
        ): Promise<{ matches: MatchData[] }> {
          let token: string | undefined;
          if (dummyAuth.isAuthenticated && dummyAuth.accessToken) {
            token = dummyAuth.accessToken;
          } else if (isAuthenticated) {
            token = await getAccessTokenSilently();
          }
          return apiClient.getAdminMatches(status, token);
        },
        async getAdminMatchDetail(matchId: string) {
          let token: string | undefined;
          if (dummyAuth.isAuthenticated && dummyAuth.accessToken) {
            token = dummyAuth.accessToken;
          } else if (isAuthenticated) {
            token = await getAccessTokenSilently();
          }
          return apiClient.getAdminMatchDetail(matchId, token);
        },
        async checkDiscordServerMembership() {
          let token: string | undefined;
          if (dummyAuth.isAuthenticated && dummyAuth.accessToken) {
            token = dummyAuth.accessToken;
          } else if (isAuthenticated) {
            token = await getAccessTokenSilently();
          }
          return apiClient.checkDiscordServerMembership(token);
        },
        async createCheckoutSession(badgeData: {
          badgeId: string;
          badgeName: string;
          price: number;
          userId?: string;
        }) {
          let token: string | undefined;
          if (dummyAuth.isAuthenticated && dummyAuth.accessToken) {
            token = dummyAuth.accessToken;
          } else if (isAuthenticated) {
            token = await getAccessTokenSilently();
          }
          return apiClient.createCheckoutSession(badgeData, token);
        },
      },
    }),
    [
      getAccessTokenSilently,
      isAuthenticated,
      dummyAuth.isAuthenticated,
      dummyAuth.accessToken,
    ],
  );
};

// Pokemon関連のフック
// 非推奨: ../hooks/usePokemon の useAllPokemon を使用してください
export const usePokemon = () => {
  const [pokemon, setPokemon] = useState<PokemonData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const dummyAuth = useDummyAuth();

  useEffect(() => {
    if (!isAuthenticated && !dummyAuth.isAuthenticated) return;

    const fetchPokemon = async () => {
      setLoading(true);
      setError(null);
      try {
        let token: string;
        if (dummyAuth.isAuthenticated && dummyAuth.accessToken) {
          token = dummyAuth.accessToken;
        } else {
          token = await getAccessTokenSilently();
        }
        const data = await apiClient.getAllPokemon(token);
        setPokemon(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchPokemon();
  }, [
    isAuthenticated,
    getAccessTokenSilently,
    dummyAuth.isAuthenticated,
    dummyAuth.accessToken,
  ]);

  return { pokemon, loading, error };
};

// 非推奨: ../hooks/usePokemon の useAllPokemon でフィルタリングしてください
export const usePokemonByRole = (role?: string) => {
  const [pokemon, setPokemon] = useState<PokemonData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const dummyAuth = useDummyAuth();

  useEffect(() => {
    if ((!isAuthenticated && !dummyAuth.isAuthenticated) || !role) return;

    const fetchPokemon = async () => {
      setLoading(true);
      setError(null);
      try {
        let token: string;
        if (dummyAuth.isAuthenticated && dummyAuth.accessToken) {
          token = dummyAuth.accessToken;
        } else {
          token = await getAccessTokenSilently();
        }
        const data = await apiClient.getPokemonByRole(role, token);
        setPokemon(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchPokemon();
  }, [
    role,
    isAuthenticated,
    getAccessTokenSilently,
    dummyAuth.isAuthenticated,
    dummyAuth.accessToken,
  ]);

  return { pokemon, loading, error };
};

// Achievements関連のフック
export const useUserAchievements = () => {
  const [achievements, setAchievements] = useState<
    Array<{ id: string; name: string; earned_at: number }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const dummyAuth = useDummyAuth();

  useEffect(() => {
    if (!isAuthenticated && !dummyAuth.isAuthenticated) return;

    const fetchAchievements = async () => {
      setLoading(true);
      setError(null);
      try {
        let token: string;
        if (dummyAuth.isAuthenticated && dummyAuth.accessToken) {
          token = dummyAuth.accessToken;
        } else {
          token = await getAccessTokenSilently();
        }
        const data = await apiClient.getUserAchievements(token);
        setAchievements(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchAchievements();
  }, [
    isAuthenticated,
    getAccessTokenSilently,
    dummyAuth.isAuthenticated,
    dummyAuth.accessToken,
  ]);

  return { achievements, loading, error };
};

export const useRecentAchievements = (limit: number = 10) => {
  const [achievements, setAchievements] = useState<
    Array<{ id: string; name: string; earned_at: number }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const dummyAuth = useDummyAuth();

  useEffect(() => {
    if (!isAuthenticated && !dummyAuth.isAuthenticated) return;

    const fetchAchievements = async () => {
      setLoading(true);
      setError(null);
      try {
        let token: string;
        if (dummyAuth.isAuthenticated && dummyAuth.accessToken) {
          token = dummyAuth.accessToken;
        } else {
          token = await getAccessTokenSilently();
        }
        const data = await apiClient.getRecentAchievements(limit, token);
        setAchievements(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchAchievements();
  }, [
    limit,
    isAuthenticated,
    getAccessTokenSilently,
    dummyAuth.isAuthenticated,
    dummyAuth.accessToken,
  ]);

  return { achievements, loading, error };
};

export const useAchievementChecker = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const dummyAuth = useDummyAuth();

  const checkAchievements = async () => {
    if (!isAuthenticated && !dummyAuth.isAuthenticated) return null;

    setLoading(true);
    setError(null);
    try {
      let token: string;
      if (dummyAuth.isAuthenticated && dummyAuth.accessToken) {
        token = dummyAuth.accessToken;
      } else {
        token = await getAccessTokenSilently();
      }
      const result = await apiClient.checkAchievements(token);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { checkAchievements, loading, error };
};

export default apiClient;
