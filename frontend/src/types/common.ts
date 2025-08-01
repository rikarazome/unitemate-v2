// 共通データの型定義

// ポケモンデータ
export interface Pokemon {
  id: string;
  name: string;
  name_en: string;
  icon_url: string;
  type: 'ATTACKER' | 'SPEEDSTER' | 'ALL_ROUNDER' | 'DEFENDER' | 'SUPPORTER';
  difficulty: 'NOVICE' | 'INTERMEDIATE' | 'EXPERT';
  is_active: boolean; // 現在のシーズンで使用可能かどうか
  created_at: string;
  updated_at: string;
}

// 勲章データ
export interface Badge {
  id: string;
  name: string;
  description: string;
  icon_url: string;
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  unlock_condition: string; // 解除条件の説明
  unlock_requirements: {
    min_rate?: number;
    min_matches?: number;
    min_wins?: number;
    special_condition?: string;
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

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

// マスターデータのレスポンス型
export interface MasterDataResponse {
  pokemon: Pokemon[];
  badges: Badge[];
  roles: Role[];
  seasons: Season[];
}

// プロフィール更新リクエストの型
export interface UpdateProfileRequest {
  trainer_name?: string;
  twitter_id?: string;
  preferred_roles?: string[];
  favorite_pokemon?: string[];
  current_badge?: string;
  bio?: string;
}