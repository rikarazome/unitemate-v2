export const PreferredRole = {
  TOP_LANE: "TOP_LANE",
  TOP_STUDY: "TOP_STUDY",
  MIDDLE: "MIDDLE",
  BOTTOM_LANE: "BOTTOM_LANE",
  BOTTOM_STUDY: "BOTTOM_STUDY",
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
  wins: number;
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
  app_username: string;
  trainer_name: string;
  twitter_id?: string | null;
  preferred_roles?: string[]; // ロールIDの配列（マスターデータと連携）
  favorite_pokemon?: string[]; // ポケモンIDの配列
  current_badge?: string; // 現在設定している勲章ID
  bio?: string | null;
  rate: number;
  unitemate_max_rate: number; // バックエンドのフィールド名に合わせる
  unitemate_num_record: number; // バックエンドのフィールド名に合わせる
  unitemate_num_win: number; // バックエンドのフィールド名に合わせる
  unitemate_winrate: number; // バックエンドのフィールド名に合わせる
  penalty_count: number; // ペナルティ数
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
}

export interface CreateUserFormData {
  trainer_name: string;
  twitter_id: string;
  preferred_roles: PreferredRole[];
  bio: string;
}

export interface ValidationErrors {
  trainer_name?: string;
  twitter_id?: string;
  preferred_roles?: string;
  bio?: string;
}
