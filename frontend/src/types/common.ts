// 共通データの型定義

// ポケモンデータ
export interface Pokemon {
  id: string;
  name: string;
  name_en: string;
  icon_url: string;
  type: "ATTACKER" | "SPEEDSTER" | "ALL_ROUNDER" | "DEFENDER" | "SUPPORTER";
  difficulty: "NOVICE" | "INTERMEDIATE" | "EXPERT";
  is_active: boolean; // 現在のシーズンで使用可能かどうか
  created_at: string;
  updated_at: string;
}

// Badge型は useBadges.ts で定義（設計仕様に基づく正式版）

// ロール（役割）データ
export interface Role {
  id: string;
  name: string;
  name_en: string;
  description: string;
  icon_url: string;
  color: string; // UI表示用の色
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// シーズンデータ
export interface Season {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 設定データ
export interface Setting {
  id: string;
  value: string | number;
}

// マスターデータのレスポンス型
export interface MasterDataResponse {
  pokemon: Pokemon[];
  // badges は useBadges.ts で別途管理
  roles: Role[];
  seasons: Season[];
  settings: Setting[];
}

// プロフィール更新リクエストの型
export interface UpdateProfileRequest {
  trainer_name?: string;
  twitter_id?: string;
  preferred_roles?: string[];
  favorite_pokemon?: string[];
  current_badge?: string;
  current_badge_2?: string; // 2つ目の勲章
  bio?: string;
}
