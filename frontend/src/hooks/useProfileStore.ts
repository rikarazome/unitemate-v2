/**
 * 統一プロフィールストア
 * useUserとuseUserInfoを統合し、localStorageキャッシュを実装
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useDummyAuth } from './useDummyAuth';
import { useApi } from './useApi';
import type { SeasonData } from '../types/user';
import type { UserInfo, MatchRecord } from './useUnitemateApi';

// キャッシュ設定
const CACHE_KEYS = {
  STATIC_PROFILE: 'unitemate_static_profile',
  DYNAMIC_PROFILE: 'unitemate_dynamic_profile',
  CACHE_TIMESTAMP: 'unitemate_profile_timestamp',
} as const;

const CACHE_DURATION = {
  STATIC: 24 * 60 * 60 * 1000, // 24時間
  DYNAMIC: 5 * 60 * 1000, // 5分
} as const;

// 静的プロフィールデータ（クライアント側で管理可能）
interface StaticProfileData {
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
  // is_admin: boolean; // UserInfo型にないため削除
  // is_banned: boolean; // UserInfo型にないため削除
  created_at: number;
  updated_at: number;
}

// 動的プロフィールデータ（サーバー管理必須）
interface DynamicProfileData {
  rate: number;
  max_rate: number;
  match_count: number;
  win_count: number;
  win_rate: number;
  penalty_count: number;
  penalty_correction: number;
  // last_penalty_time?: number | null; // UserInfo型にないため削除
  penalty_timeout_until?: number | null;
  season_data?: SeasonData[];
  latest_matches?: MatchRecord[];
}

interface ProfileStoreState {
  staticData: StaticProfileData | null;
  dynamicData: DynamicProfileData | null;
  loading: boolean;
  error: string | null;
  needsRegistration: boolean;
}

// キャッシュユーティリティ
const cacheUtils = {
  // ローカルストレージからキャッシュデータを取得
  getFromCache<T>(key: string, maxAge: number): T | null {
    try {
      const cached = localStorage.getItem(key);
      const timestamp = localStorage.getItem(`${key}_timestamp`);

      if (!cached || !timestamp) return null;

      const age = Date.now() - parseInt(timestamp);
      if (age > maxAge) {
        // 期限切れのキャッシュを削除
        localStorage.removeItem(key);
        localStorage.removeItem(`${key}_timestamp`);
        return null;
      }

      return JSON.parse(cached);
    } catch {
      return null;
    }
  },

  // ローカルストレージにキャッシュデータを保存
  saveToCache<T>(key: string, data: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      localStorage.setItem(`${key}_timestamp`, Date.now().toString());
    } catch (error) {
      console.warn('[ProfileStore] Failed to save to cache:', error);
    }
  },

  // キャッシュをクリア
  clearCache(): void {
    Object.values(CACHE_KEYS).forEach(key => {
      localStorage.removeItem(key);
      localStorage.removeItem(`${key}_timestamp`);
    });
  },
};

export const useProfileStore = () => {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const dummyAuth = useDummyAuth();
  const { callApi } = useApi();

  const [state, setState] = useState<ProfileStoreState>({
    staticData: null,
    dynamicData: null,
    loading: false,
    error: null,
    needsRegistration: false,
  });

  const initializeAttempted = useRef(false);

  // サーバーデータを静的・動的に分離
  const separateUserData = useCallback((serverData: UserInfo) => {
    const staticData: StaticProfileData = {
      user_id: serverData.user_id,
      auth0_sub: serverData.auth0_sub,
      discord_username: serverData.discord_username,
      discord_discriminator: serverData.discord_discriminator,
      discord_avatar_url: serverData.discord_avatar_url,
      trainer_name: serverData.trainer_name,
      twitter_id: serverData.twitter_id,
      preferred_roles: serverData.preferred_roles,
      favorite_pokemon: serverData.favorite_pokemon || [],
      current_badge: serverData.current_badge,
      current_badge_2: serverData.current_badge_2,
      owned_badges: serverData.owned_badges,
      bio: serverData.bio,
      // is_admin: serverData.is_admin, // UserInfo型にないため削除
      // is_banned: serverData.is_banned, // UserInfo型にないため削除
      created_at: serverData.created_at,
      updated_at: serverData.updated_at,
    };

    const dynamicData: DynamicProfileData = {
      rate: serverData.rate,
      max_rate: serverData.max_rate,
      match_count: serverData.match_count,
      win_count: serverData.win_count,
      win_rate: serverData.win_rate,
      penalty_count: serverData.penalty_count,
      penalty_correction: serverData.penalty_correction,
      // last_penalty_time: serverData.last_penalty_time, // UserInfo型にないため削除
      penalty_timeout_until: serverData.penalty_timeout_until,
      season_data: serverData.season_data?.map(season => ({
        ...season,
        win_count: season.wins // UserInfoのwinsをSeasonDataのwin_countにマップ
      })),
      latest_matches: serverData.latest_matches,
    };

    return { staticData, dynamicData };
  }, []);

  // サーバーからユーザーデータを取得
  const fetchUserData = useCallback(async (forceFetch = false) => {
    if (!isAuthenticated && !dummyAuth.isAuthenticated) return;

    // キャッシュから読み込み（強制取得でない場合）
    if (!forceFetch) {
      const cachedStatic = cacheUtils.getFromCache<StaticProfileData>(
        CACHE_KEYS.STATIC_PROFILE,
        CACHE_DURATION.STATIC
      );
      const cachedDynamic = cacheUtils.getFromCache<DynamicProfileData>(
        CACHE_KEYS.DYNAMIC_PROFILE,
        CACHE_DURATION.DYNAMIC
      );

      if (cachedStatic && cachedDynamic) {
        setState(prev => ({
          ...prev,
          staticData: cachedStatic,
          dynamicData: cachedDynamic,
          loading: false,
          error: null,
        }));
        console.log('[ProfileStore] Loaded from cache');
        return;
      }
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      let token: string;
      if (dummyAuth.isAuthenticated && dummyAuth.accessToken) {
        token = dummyAuth.accessToken;
      } else {
        token = await getAccessTokenSilently();
      }

      // 現在は統一APIを使用（Phase 2で分離予定）
      const response = await callApi<UserInfo>('/api/users/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.error) {
        if (response.status === 404) {
          setState(prev => ({ ...prev, needsRegistration: true, loading: false }));
          return;
        }
        throw new Error(response.error);
      }

      if (response.data) {
        const { staticData, dynamicData } = separateUserData(response.data);

        // キャッシュに保存
        cacheUtils.saveToCache(CACHE_KEYS.STATIC_PROFILE, staticData);
        cacheUtils.saveToCache(CACHE_KEYS.DYNAMIC_PROFILE, dynamicData);

        setState(prev => ({
          ...prev,
          staticData,
          dynamicData,
          loading: false,
          error: null,
          needsRegistration: false,
        }));

        console.log('[ProfileStore] Loaded from server and cached');
      }
    } catch (error) {
      console.error('[ProfileStore] Fetch error:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [isAuthenticated, dummyAuth.isAuthenticated, dummyAuth.accessToken, getAccessTokenSilently, callApi, separateUserData]);

  // 静的データを楽観的に更新（即座にUIに反映）
  const updateStaticData = useCallback((updates: Partial<StaticProfileData>) => {
    setState(prev => {
      if (!prev.staticData) return prev;

      const updatedStaticData = {
        ...prev.staticData,
        ...updates,
        updated_at: Date.now(),
      };

      // キャッシュも更新
      cacheUtils.saveToCache(CACHE_KEYS.STATIC_PROFILE, updatedStaticData);

      console.log('[ProfileStore] Static data updated optimistically:', updates);

      return {
        ...prev,
        staticData: updatedStaticData,
      };
    });
  }, []);

  // 勲章を追加（ショップでの購入時など）
  const addOwnedBadge = useCallback((badgeId: string) => {
    setState(prev => {
      if (!prev.staticData) return prev;

      const currentBadges = prev.staticData.owned_badges || [];
      if (currentBadges.includes(badgeId)) return prev;

      const updatedBadges = [...currentBadges, badgeId];
      const updatedStaticData = {
        ...prev.staticData,
        owned_badges: updatedBadges,
        updated_at: Date.now(),
      };

      // キャッシュも更新
      cacheUtils.saveToCache(CACHE_KEYS.STATIC_PROFILE, updatedStaticData);

      console.log('[ProfileStore] Badge added:', badgeId);

      return {
        ...prev,
        staticData: updatedStaticData,
      };
    });
  }, []);

  // 装備勲章を更新
  const updateEquippedBadges = useCallback((badge1?: string, badge2?: string) => {
    updateStaticData({
      current_badge: badge1,
      current_badge_2: badge2,
    });
  }, [updateStaticData]);

  // 完全なユーザーデータを取得
  const getCompleteUserData = useCallback((): UserInfo | null => {
    const { staticData, dynamicData } = state;
    if (!staticData || !dynamicData) return null;

    return { ...staticData, ...dynamicData } as UserInfo;
  }, [state]);

  // 初期化
  useEffect(() => {
    if ((isAuthenticated || dummyAuth.isAuthenticated) && !initializeAttempted.current) {
      initializeAttempted.current = true;
      fetchUserData(false);
    }
  }, [isAuthenticated, dummyAuth.isAuthenticated, fetchUserData]);

  // ログアウト時のクリーンアップ
  useEffect(() => {
    if (!isAuthenticated && !dummyAuth.isAuthenticated) {
      setState({
        staticData: null,
        dynamicData: null,
        loading: false,
        error: null,
        needsRegistration: false,
      });
      cacheUtils.clearCache();
      initializeAttempted.current = false;
      console.log('[ProfileStore] Cleared on logout');
    }
  }, [isAuthenticated, dummyAuth.isAuthenticated]);

  return {
    // データ
    staticData: state.staticData,
    dynamicData: state.dynamicData,
    completeUserData: getCompleteUserData(),

    // 状態
    loading: state.loading,
    error: state.error,
    needsRegistration: state.needsRegistration,

    // アクション
    fetchUserData,
    updateStaticData,
    addOwnedBadge,
    updateEquippedBadges,

    // ユーティリティ
    hasValidCache: Boolean(state.staticData && state.dynamicData),
    clearCache: cacheUtils.clearCache,
  };
};