import { useState, useEffect, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import type { MasterDataResponse, UpdateProfileRequest } from '../types/common';

// API設定 - セキュリティのため、直接AWS APIではなく自社バックエンド経由で呼び出し
const API_BASE_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3001/api';

// 型定義
export interface UserInfo {
  user_id: string;
  auth0_sub: string;
  discord_username: string;
  discord_discriminator?: string | null;
  discord_avatar_url: string;
  app_username: string;
  trainer_name: string;
  twitter_id?: string | null;
  preferred_roles?: string[];
  favorite_pokemon?: string[];
  current_badge?: string;
  bio?: string | null;
  rate: number;
  unitemate_max_rate: number;
  unitemate_num_record: number;
  unitemate_num_win: number;
  unitemate_winrate: number;
  penalty_count: number;
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

export interface MatchRecord {
  pokemon: string;
  match_id: number;
  rate_delta: number;
  started_date: number;
  winlose: boolean;
  team_A: string[];
  team_B: string[];
}

export interface QueueInfo {
  rate_list: number[];
  range_list: number[];
  ongoing: number;
}

export interface RankingEntry {
  user_id: string;
  rate: number;
  unitemate_winrate: number;
}

export interface RankingResponse {
  rankings: RankingEntry[];
}

// APIクライアント - Auth0トークン認証を使用
class UnitemateApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}, token?: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
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
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // ユーザー情報取得
  async getUserInfo(userId: string, token?: string): Promise<UserInfo> {
    return this.request<UserInfo>(`/users/${userId}`, {}, token);
  }

  // ユーザーの試合記録取得
  async getUserRecords(userId: string, token?: string): Promise<{ latest_matches: MatchRecord[] }> {
    return this.request<{ latest_matches: MatchRecord[] }>(`/users/${userId}/records`, {}, token);
  }

  // キュー情報取得
  async getQueueInfo(token?: string): Promise<QueueInfo> {
    return this.request<QueueInfo>('/queue/info', {}, token);
  }

  // ランキング取得
  async getRanking(token?: string): Promise<RankingResponse> {
    return this.request<RankingResponse>('/ranking', {}, token);
  }

  // キューに参加
  async joinQueue(data: {
    user_id: string;
    blocking: string;
    desired_role: string;
    range_spread_speed: number;
    range_spread_count: number;
    discord_id: string;
  }, token?: string): Promise<void> {
    return this.request<void>('/queue/join', {
      method: 'POST',
      body: JSON.stringify(data),
    }, token);
  }

  // キューから退出
  async leaveQueue(userId: string, token?: string): Promise<void> {
    return this.request<void>('/queue/leave', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
      }),
    }, token);
  }

  // マスターデータ取得
  async getMasterData(token?: string): Promise<MasterDataResponse> {
    return this.request<MasterDataResponse>('/master', {}, token);
  }

  // プロフィール更新
  async updateProfile(userId: string, data: UpdateProfileRequest, token?: string): Promise<void> {
    return this.request<void>(`/users/${userId}/profile`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, token);
  }
}

// シングルトンクライアント
const apiClient = new UnitemateApiClient(API_BASE_URL);

// カスタムフック
export const useUserInfo = (userId?: string) => {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  useEffect(() => {
    if (!userId || !isAuthenticated) return;

    const fetchUserInfo = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getAccessTokenSilently();
        const data = await apiClient.getUserInfo(userId, token);
        setUserInfo(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchUserInfo();
  }, [userId, isAuthenticated, getAccessTokenSilently]);

  return { userInfo, loading, error };
};

export const useUserRecords = (userId?: string) => {
  const [records, setRecords] = useState<MatchRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  useEffect(() => {
    if (!userId || !isAuthenticated) return;

    const fetchRecords = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getAccessTokenSilently();
        const data = await apiClient.getUserRecords(userId, token);
        setRecords(data.latest_matches);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, [userId, isAuthenticated, getAccessTokenSilently]);

  return { records, loading, error };
};

export const useQueueInfo = () => {
  const [queueInfo, setQueueInfo] = useState<QueueInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  const fetchQueueInfo = useCallback(async (showLoading = false) => {
    if (!isAuthenticated) return;
    
    if (showLoading) {
      setLoading(true);
    }
    setError(null);
    try {
      const token = await getAccessTokenSilently();
      const data = await apiClient.getQueueInfo(token);
      setQueueInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [isAuthenticated, getAccessTokenSilently]);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    // 初回のみローディング表示
    fetchQueueInfo(true);
    
    // 定期的に更新（ローディング表示なし）
    const interval = setInterval(() => fetchQueueInfo(false), 5000);
    return () => clearInterval(interval);
  }, [isAuthenticated, getAccessTokenSilently, fetchQueueInfo]);

  return { queueInfo, loading, error, refetch: () => fetchQueueInfo(true) };
};

export const useRanking = () => {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchRanking = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getAccessTokenSilently();
        const data = await apiClient.getRanking(token);
        setRankings(data.rankings);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchRanking();
  }, [isAuthenticated, getAccessTokenSilently]);

  return { rankings, loading, error };
};

export const useMatchQueue = () => {
  const { user, getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [isInQueue, setIsInQueue] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const joinQueue = async () => {
    if (!user || !isAuthenticated) return;

    setLoading(true);
    setError(null);
    try {
      const token = await getAccessTokenSilently();
      await apiClient.joinQueue({
        user_id: user.sub || '',
        blocking: 'false',
        desired_role: 'any',
        range_spread_speed: 10,
        range_spread_count: 0,
        discord_id: user.nickname || '',
      }, token);
      setIsInQueue(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const leaveQueue = async () => {
    if (!user || !isAuthenticated) return;

    setLoading(true);
    setError(null);
    try {
      const token = await getAccessTokenSilently();
      await apiClient.leaveQueue(user.sub || '', token);
      setIsInQueue(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return {
    isInQueue,
    loading,
    error,
    joinQueue,
    leaveQueue,
  };
};

// マスターデータ取得フック
export const useMasterData = () => {
  const [masterData, setMasterData] = useState<MasterDataResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchMasterData = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getAccessTokenSilently();
        const data = await apiClient.getMasterData(token);
        setMasterData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchMasterData();
  }, [isAuthenticated, getAccessTokenSilently]);

  return { masterData, loading, error };
};

// プロフィール更新フック
export const useUpdateProfile = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getAccessTokenSilently, user, isAuthenticated } = useAuth0();

  const updateProfile = async (data: UpdateProfileRequest) => {
    if (!user || !isAuthenticated) return;

    setLoading(true);
    setError(null);
    try {
      const token = await getAccessTokenSilently();
      await apiClient.updateProfile(user.sub || '', data, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { updateProfile, loading, error };
};

export default apiClient;