/**
 * ユーザーデータの管理を静的・動的に分離した型定義
 */

import type { SeasonData } from './user';

// クライアント側で管理可能な静的データ
export interface StaticUserData {
  user_id: string;
  auth0_sub: string;
  discord_username: string;
  discord_discriminator?: string | null;
  discord_avatar_url: string;
  trainer_name: string;
  twitter_id?: string | null;
  preferred_roles?: string[];
  favorite_pokemon?: string[] | null;
  current_badge?: string;
  current_badge_2?: string;
  owned_badges?: string[];
  bio?: string | null;
  is_admin: boolean;
  is_banned: boolean;
  created_at: number;
  updated_at: number;
}

// サーバー側で管理が必要な動的データ
export interface DynamicUserData {
  rate: number;
  max_rate: number;
  match_count: number;
  win_count: number;
  win_rate: number;
  penalty_count: number;
  penalty_correction: number;
  last_penalty_time?: number | null;
  penalty_timeout_until?: number | null;
  past_seasons?: SeasonData[];
}

// 完全なユーザーデータ（結合された形）
export interface CompleteUserData extends StaticUserData, DynamicUserData {}

// プロフィール更新時のリクエストデータ
export interface StaticProfileUpdate {
  trainer_name?: string;
  twitter_id?: string | null;
  preferred_roles?: string[];
  bio?: string | null;
  favorite_pokemon?: string[] | null;
  current_badge?: string;
  current_badge_2?: string;
}