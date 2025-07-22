export const PreferredRole = {
  TOP_LANE: "TOP_LANE",
  TOP_STUDY: "TOP_STUDY",
  MIDDLE: "MIDDLE",
  BOTTOM_LANE: "BOTTOM_LANE",
  BOTTOM_STUDY: "BOTTOM_STUDY",
} as const;

export type PreferredRole = (typeof PreferredRole)[keyof typeof PreferredRole];

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
  preferred_roles?: PreferredRole[];
  bio?: string | null;
  rate: number;
  max_rate: number;
  match_count: number;
  win_count: number;
  created_at: string;
  updated_at: string;
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
