/**
 * 統一プロフィールストア (Zustand版)
 * 🔧 FIX: グローバルシングルトンストアとして実装し、全コンポーネントで状態を共有
 */

import { useMemo } from 'react';
import { create } from 'zustand';
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
  penalty_timeout_until?: number | null;
  past_seasons?: SeasonData[];
  latest_matches?: MatchRecord[];
}

interface ProfileStoreState {
  staticData: StaticProfileData | null;
  dynamicData: DynamicProfileData | null;
  loading: boolean;
  error: string | null;
  needsRegistration: boolean;
  initializeAttempted: boolean;
}

interface ProfileStoreActions {
  // データ取得・更新
  fetchUserData: (
    forceFetch: boolean,
    getToken: () => Promise<string>,
    callApi: <T>(endpoint: string, options?: any) => Promise<{ data?: T; error?: string; status?: number }>
  ) => Promise<void>;
  updateStaticData: (updates: Partial<StaticProfileData>) => void;
  addOwnedBadge: (badgeId: string) => void;
  updateEquippedBadges: (badge1?: string, badge2?: string) => void;

  // ユーティリティ
  clearCache: () => void;
  clearStore: () => void;
  setInitializeAttempted: (value: boolean) => void;

  // 計算プロパティ
  getCompleteUserData: () => UserInfo | null;
}

// キャッシュユーティリティ
const cacheUtils = {
  getFromCache<T>(key: string, maxAge: number): T | null {
    try {
      const cached = localStorage.getItem(key);
      const timestamp = localStorage.getItem(`${key}_timestamp`);

      if (!cached || !timestamp) return null;

      const age = Date.now() - parseInt(timestamp);
      if (age > maxAge) {
        localStorage.removeItem(key);
        localStorage.removeItem(`${key}_timestamp`);
        return null;
      }

      return JSON.parse(cached);
    } catch {
      return null;
    }
  },

  saveToCache<T>(key: string, data: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      localStorage.setItem(`${key}_timestamp`, Date.now().toString());
    } catch (error) {
      console.warn('[ProfileStore] Failed to save to cache:', error);
    }
  },

  clearCache(): void {
    Object.values(CACHE_KEYS).forEach(key => {
      localStorage.removeItem(key);
      localStorage.removeItem(`${key}_timestamp`);
    });
  },
};

// サーバーデータを静的・動的に分離
const separateUserData = (serverData: UserInfo) => {
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
    penalty_timeout_until: serverData.penalty_timeout_until,
    past_seasons: serverData.past_seasons,
    latest_matches: serverData.latest_matches,
  };

  return { staticData, dynamicData };
};

// 🔧 Zustandグローバルストア - 全コンポーネントで共有される単一のインスタンス
export const useProfileStore = create<ProfileStoreState & ProfileStoreActions>((set, get) => ({
  // 初期状態
  staticData: null,
  dynamicData: null,
  loading: false,
  error: null,
  needsRegistration: false,
  initializeAttempted: false,

  // サーバーからユーザーデータを取得
  fetchUserData: async (forceFetch, getToken, callApi) => {
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
        set({
          staticData: cachedStatic,
          dynamicData: cachedDynamic,
          loading: false,
          error: null,
        });
        console.log('[ProfileStore] Loaded from cache');
        return;
      }
    }

    set({ loading: true, error: null });

    try {
      const token = await getToken();

      const endpoint = forceFetch
        ? `/api/users/me?_t=${Date.now()}`
        : '/api/users/me';

      const response = await callApi<UserInfo>(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          ...(forceFetch && { 'Cache-Control': 'no-cache, no-store, must-revalidate' }),
        },
      });

      if (response.error) {
        if (response.status === 404) {
          set({ needsRegistration: true, loading: false });
          return;
        }
        throw new Error(response.error);
      }

      if (response.data) {
        const { staticData, dynamicData } = separateUserData(response.data);

        // キャッシュに保存
        cacheUtils.saveToCache(CACHE_KEYS.STATIC_PROFILE, staticData);
        cacheUtils.saveToCache(CACHE_KEYS.DYNAMIC_PROFILE, dynamicData);

        set({
          staticData,
          dynamicData,
          loading: false,
          error: null,
          needsRegistration: false,
        });

        console.log('[ProfileStore] Loaded from server and cached');
      }
    } catch (error) {
      console.error('[ProfileStore] Fetch error:', error);
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  // 静的データを楽観的に更新
  updateStaticData: (updates) => {
    const { staticData } = get();
    if (!staticData) return;

    const updatedStaticData = {
      ...staticData,
      ...updates,
      updated_at: Date.now(),
    };

    cacheUtils.saveToCache(CACHE_KEYS.STATIC_PROFILE, updatedStaticData);
    set({ staticData: updatedStaticData });
    console.log('[ProfileStore] Static data updated:', updates);
  },

  // 勲章を追加
  addOwnedBadge: (badgeId) => {
    const { staticData } = get();
    if (!staticData) return;

    const currentBadges = staticData.owned_badges || [];
    if (currentBadges.includes(badgeId)) return;

    const updatedBadges = [...currentBadges, badgeId];
    const updatedStaticData = {
      ...staticData,
      owned_badges: updatedBadges,
      updated_at: Date.now(),
    };

    cacheUtils.saveToCache(CACHE_KEYS.STATIC_PROFILE, updatedStaticData);
    set({ staticData: updatedStaticData });
    console.log('[ProfileStore] Badge added:', badgeId);
  },

  // 装備勲章を更新
  updateEquippedBadges: (badge1, badge2) => {
    get().updateStaticData({
      current_badge: badge1,
      current_badge_2: badge2,
    });
  },

  // キャッシュをクリア
  clearCache: () => {
    cacheUtils.clearCache();
  },

  // ストアをクリア（ログアウト時）
  clearStore: () => {
    set({
      staticData: null,
      dynamicData: null,
      loading: false,
      error: null,
      needsRegistration: false,
      initializeAttempted: false,
    });
    cacheUtils.clearCache();
    console.log('[ProfileStore] Cleared on logout');
  },

  // 初期化フラグを設定
  setInitializeAttempted: (value) => {
    set({ initializeAttempted: value });
  },

  // 完全なユーザーデータを取得
  getCompleteUserData: () => {
    const { staticData, dynamicData } = get();
    if (!staticData || !dynamicData) return null;
    return { ...staticData, ...dynamicData } as UserInfo;
  },
}));

// 🔧 便利なセレクター - completeUserDataを直接取得できるようにする
// useMemoで結果をキャッシュし、staticData/dynamicDataの参照が変わった時のみ再計算
export const useCompleteUserData = () => {
  const staticData = useProfileStore((state) => state.staticData);
  const dynamicData = useProfileStore((state) => state.dynamicData);

  return useMemo(() => {
    if (!staticData || !dynamicData) return null;
    return { ...staticData, ...dynamicData } as UserInfo;
  }, [staticData, dynamicData]);
};
