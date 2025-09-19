/**
 * Badge data module - centralizes access to Badge data
 */

import badgeRawData from "./badges.json";

// Badge interface matching the existing structure from useBadges.ts
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

// Raw data from JSON to Badge interface conversion
const rawData = badgeRawData as Badge[];

// Transform raw data to Badge structure
export const BADGE_DATA: Badge[] = rawData.map((badge) => ({
  id: badge.id,
  condition: badge.condition || "",
  display: badge.display || "",
  start_color: badge.start_color || null,
  end_color: badge.end_color || null,
  char_color: badge.char_color || null,
  image_card: badge.image_card || null,
  banner_image: badge.banner_image || null,
  type: badge.type || "basic",
  price: badge.price || 0,
  max_sales: badge.max_sales || 0,
  current_sales: badge.current_sales || 0,
}));

// Create a map for O(1) lookups
export const BADGE_MAP = new Map<string, Badge>(
  BADGE_DATA.map((badge) => [badge.id, badge])
);

// Extract all Badge IDs for type checking
export const BADGE_IDS = BADGE_DATA.map((badge) => badge.id);

// Helper functions
export const getBadgeById = (id: string): Badge | undefined => {
  return BADGE_MAP.get(id);
};

export const getAllBadges = (): Badge[] => {
  return BADGE_DATA;
};

export const searchBadges = (query: string): Badge[] => {
  const lowerQuery = query.toLowerCase();
  return BADGE_DATA.filter(
    (badge) =>
      badge.display.toLowerCase().includes(lowerQuery) ||
      badge.condition.toLowerCase().includes(lowerQuery) ||
      badge.id.toLowerCase().includes(lowerQuery)
  );
};

export const getBadgesByType = (type: Badge["type"]): Badge[] => {
  return BADGE_DATA.filter((badge) => badge.type === type);
};

export const getActiveBadges = (): Badge[] => {
  // すべてのバッジがアクティブとして扱う（is_activeプロパティは不要）
  return BADGE_DATA;
};

