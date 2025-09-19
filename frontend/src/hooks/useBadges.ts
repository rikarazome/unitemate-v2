import { useState, useEffect, useCallback } from "react";
import { useApi } from "./useApi";
import { getAllBadges as getLocalBadges, getBadgeById as getLocalBadgeById } from "../data/badges";

// 勲章データの型定義
export interface Badge {
  id: string;
  condition: string;
  display: string;
  start_color: string | null;
  end_color: string | null;
  char_color: string | null;
  image_card: string | null;
  banner_image: string | null;
  type: "gradient" | "image" | "basic";
  price: number;
  max_sales: number; // 最大販売数（0の場合は無制限）
  current_sales: number; // 現在販売数
}

export interface UserBadge {
  badge_id: string;
  earned_at: number;
  earned_date: string;
}

export interface BadgeEquipment {
  primary_badge: string | null;
  secondary_badge: string | null;
}

// ローカルデータから取得した勲章データをキャッシュ
let cachedBadgesData: Badge[] | null = null;

// API設定
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";


/**
 * ローカルデータから勲章データを取得する関数
 */
const fetchLocalBadges = (): Badge[] => {
  try {
    return getLocalBadges();
  } catch (error) {
    console.warn("Failed to fetch local badges data:", error);
    return [];
  }
};

/**
 * グローバルな勲章データアクセス用のヘルパー関数（認証が必要な場合は useBadges フックを使用してください）
 */
export const getBadge = async (badgeId: string, _callApi?: ReturnType<typeof useApi>["callApi"]): Promise<Badge | undefined> => {
  const badges = await getAllBadges(_callApi);
  return badges.find((badge) => badge.id === badgeId);
};

export const getAllBadges = async (_callApi?: ReturnType<typeof useApi>["callApi"]): Promise<Badge[]> => {
  if (cachedBadgesData) {
    return cachedBadgesData;
  }

  // ローカルデータから取得
  cachedBadgesData = fetchLocalBadges();

  return cachedBadgesData || [];
};

// 同期版（フォールバック用）
export const getBadgeSync = (badgeId: string): Badge | undefined => {
  if (cachedBadgesData) {
    return cachedBadgesData.find((badge) => badge.id === badgeId);
  }
  // ローカルデータから直接取得
  return getLocalBadgeById(badgeId);
};

export const getAllBadgesSync = (): Badge[] => {
  if (cachedBadgesData) {
    return cachedBadgesData;
  }
  // ローカルデータから直接取得
  return getLocalBadges();
};

/**
 * 勲章データを初期化（ローカルデータから取得してキャッシュ）
 * アプリ開始時に呼び出すことで、認証なしでも勲章データを使用可能にする
 */
export const initializeBadges = async (): Promise<void> => {
  if (!cachedBadgesData) {
    try {
      cachedBadgesData = fetchLocalBadges();
    } catch (error) {
      console.warn("Failed to initialize badge data:", error);
    }
  }
};

/**
 * 勲章関連のフック
 */
export const useBadges = (authToken?: string) => {
  const { callApi } = useApi();
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [masterBadges, setMasterBadges] = useState<Badge[]>([]);

  // マスターデータを取得（ローカルデータを使用）
  const fetchMasterBadges = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // ローカルのバッジデータを取得
      const badges = fetchLocalBadges();

      setMasterBadges(badges);
      cachedBadgesData = badges;

      return badges;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      console.error("Failed to fetch master badges:", err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // 全勲章マスターデータを取得（フック内の関数名を変更）
  const getAllBadgesInternal = (): Badge[] => {
    return masterBadges.length > 0 ? masterBadges : cachedBadgesData || getLocalBadges();
  };

  // 特定の勲章データを取得（フック内の関数名を変更）
  const getBadgeInternal = (badgeId: string): Badge | undefined => {
    const badges = getAllBadgesInternal();
    return badges.find((badge) => badge.id === badgeId);
  };

  // ユーザーの所持勲章を取得
  const fetchUserBadges = useCallback(async () => {
    if (!authToken) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/users/me/badges`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // バックエンドAPIレスポンス形式に合わせて調整
      if (data.owned_badges && Array.isArray(data.owned_badges)) {
        // バックエンドからは勲章IDのリストが返される想定
        const userBadgeList: UserBadge[] = data.owned_badges.map(
          (badgeId: string) => ({
            badge_id: badgeId,
            earned_at: Date.now(),
            earned_date: new Date().toISOString(),
          }),
        );
        setUserBadges(userBadgeList);
      } else {
        setUserBadges([]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      console.error("Failed to fetch user badges:", err);
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  // 勲章を装着
  const equipBadges = async (equipment: BadgeEquipment): Promise<boolean> => {
    if (!authToken) return false;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${API_BASE_URL}/api/users/me/badges/equip`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            primary_badge: equipment.primary_badge,
            secondary_badge: equipment.secondary_badge,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      console.error("Failed to equip badges:", err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // 勲章を授与（管理者用）
  const awardBadge = async (
    userId: string,
    badgeId: string,
  ): Promise<boolean> => {
    if (!authToken) return false;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/admin/badges/award`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
          badge_id: badgeId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      console.error("Failed to award badge:", err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // ユーザーが特定の勲章を所持しているかチェック
  const hasBadge = (badgeId: string): boolean => {
    return userBadges.some((badge) => badge.badge_id === badgeId);
  };

  // 所持している勲章の詳細データを取得
  const getOwnedBadges = (): Badge[] => {
    return userBadges
      .map((userBadge) => getBadgeInternal(userBadge.badge_id))
      .filter((badge): badge is Badge => badge !== undefined);
  };

  // 初回ロード
  useEffect(() => {
    // マスターデータを取得
    fetchMasterBadges();
    
    // ユーザー勲章を取得
    if (authToken) {
      fetchUserBadges();
    }
  }, [authToken, fetchUserBadges, fetchMasterBadges]);

  return {
    // データ
    userBadges,
    allBadges: getAllBadgesInternal(),
    ownedBadges: getOwnedBadges(),

    // 状態
    loading,
    error,

    // 関数
    getBadge: getBadgeInternal,
    getAllBadges: getAllBadgesInternal,
    fetchUserBadges,
    fetchMasterBadges,
    equipBadges,
    awardBadge,
    hasBadge,

    // リセット
    clearError: () => setError(null),
  };
};
