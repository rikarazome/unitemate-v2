export interface RankingEntry {
  rank: number;
  user_id: string;
  trainer_name: string;
  discord_username?: string;
  discord_avatar_url?: string;
  twitter_id?: string | null;
  rate: number;
  max_rate?: number;
  match_count?: number;
  win_count?: number;
  win_rate?: number;
  last_match_at?: string | null;
}
