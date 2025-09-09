export const PreferredRole = {
  TOP_LANE: "TOP_LANE",
  SUPPORT: "SUPPORT",
  MIDDLE: "MIDDLE",
  BOTTOM_LANE: "BOTTOM_LANE",
  TANK: "TANK",
} as const;

export type PreferredRole = (typeof PreferredRole)[keyof typeof PreferredRole];

// シーズンデータの型定義
export interface SeasonData {
  season_id: string;
  season_name: string;
  final_rate: number;
  max_rate: number;
  win_rate: number;
  final_rank: number;
  total_matches: number;
  win_count: number;
}

export interface Auth0UserProfile {
  sub: string;
  nickname: string;
  name: string;
  picture: string;
  updated_at: string;
}

export interface User {
  user_id: string;
  auth0_sub: string;
  discord_username: string;
  discord_discriminator?: string | null;
  discord_avatar_url: string;
  trainer_name: string;
  twitter_id?: string | null;
  preferred_roles?: string[]; // ロールIDの配列（マスターデータと連携）
  favorite_pokemon?: string[]; // ポケモンIDの配列
  current_badge?: string; // 現在設定している勲章ID
  current_badge_2?: string; // 2つ目の勲章ID
  owned_badges?: string[]; // 所持している勲章IDのリスト
  bio?: string | null;
  favorite_pokemon?: string[] | null;
  rate: number;
  max_rate: number; // 最高レート
  match_count: number; // 試合数
  win_count: number; // 勝利数
  win_rate: number; // 勝率
  penalty_count: number; // 累積ペナルティ数（減らない）
  penalty_correction: number; // ペナルティ軽減数
  last_penalty_time?: number | null; // 最後のペナルティ付与時刻
  penalty_timeout_until?: number | null; // ペナルティタイムアウト終了時刻
  is_admin: boolean; // 管理者権限フラグ
  is_banned: boolean; // アカウント凍結フラグ
  season_data?: SeasonData[]; // 過去シーズンデータ
  created_at: number; // タイムスタンプ
  updated_at: number; // タイムスタンプ
}

export interface CreateUserRequest {
  auth0_profile: Auth0UserProfile;
  trainer_name: string;
  twitter_id?: string;
  preferred_roles?: PreferredRole[];
  bio?: string;
  favorite_pokemon?: string[];
}

export interface CreateUserFormData {
  trainer_name: string;
  twitter_id: string;
  preferred_roles: PreferredRole[];
  bio: string;
  favorite_pokemon?: string[];
}

export interface ValidationErrors {
  trainer_name?: string;
  twitter_id?: string;
  preferred_roles?: string;
  bio?: string;
  favorite_pokemon?: string;
}

export interface UpdateUserRequest {
  trainer_name?: string;
  twitter_id?: string | null;
  preferred_roles?: PreferredRole[];
  bio?: string | null;
  favorite_pokemon?: string[] | null;
}

export type UpdateUserFormData = CreateUserFormData;
