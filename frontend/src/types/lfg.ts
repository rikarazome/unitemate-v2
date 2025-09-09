// LFG（味方募集）フォーム関連の型定義

// ポケモンタイプ定義（pokemon/types.tsから独立して定義）
export type PokemonType =
  | "アタック"
  | "バランス"
  | "スピード"
  | "ディフェンス"
  | "サポート";

// ロール定義
export const LFG_ROLES = {
  TOP_LANE: "TOP_LANE",
  SUPPORT: "SUPPORT",
  MIDDLE: "MIDDLE",
  BOTTOM_LANE: "BOTTOM_LANE",
  TANK: "TANK",
} as const;

export type LfgRole = (typeof LFG_ROLES)[keyof typeof LFG_ROLES];

// ロール表示名
export const LFG_ROLE_LABELS = {
  [LFG_ROLES.TOP_LANE]: "上レーン",
  [LFG_ROLES.SUPPORT]: "サポート",
  [LFG_ROLES.MIDDLE]: "中央",
  [LFG_ROLES.BOTTOM_LANE]: "下レーン",
  [LFG_ROLES.TANK]: "タンク",
} as const;

// ポケモンスロット（各ロールで最大4体まで）
export interface PokemonSlot {
  id: string; // ポケモンID
  name: string; // ポケモン名
  type: string; // ポケモンタイプ
  iconUrl: string | null;
}

// ロール別ポケモンスロット
export interface RolePokemonSlots {
  [LFG_ROLES.TOP_LANE]: PokemonSlot[];
  [LFG_ROLES.SUPPORT]: PokemonSlot[];
  [LFG_ROLES.MIDDLE]: PokemonSlot[];
  [LFG_ROLES.BOTTOM_LANE]: PokemonSlot[];
  [LFG_ROLES.TANK]: PokemonSlot[];
}

// LFGフォームの状態
export interface LfgFormState {
  selectedRoles: LfgRole[]; // 選択された希望ロール
  pokemonSlots: RolePokemonSlots; // ロール別のポケモンスロット
}

// ポケモン選択用のフィルター状態
export interface PokemonPickerState {
  selectedType: PokemonType | null;
  selectedRole: LfgRole | null;
  selectedSlotIndex: number | null;
}

// ポケモンプール設定用のプロップス
export interface PokemonPoolProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRoles: LfgRole[];
  pokemonSlots: RolePokemonSlots;
  onUpdatePokemonSlots: (slots: RolePokemonSlots) => void;
}

// ポケモンピッカー用のプロップス
export interface PokemonPickerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRole: LfgRole;
  slotIndex: number;
  onSelectPokemon: (
    role: LfgRole,
    slotIndex: number,
    pokemon: PokemonSlot,
  ) => void;
  currentRoleSlots?: PokemonSlot[]; // 現在のロールで既に選択済みのポケモン
}

// ロールセレクター用のプロップス
export interface RoleSelectorProps {
  selectedRoles: LfgRole[];
  onRoleChange: (roles: LfgRole[]) => void;
  className?: string;
}

// 得意ポケモンボタン用のプロップス
export interface FavPokemonButtonProps {
  selectedRoles: LfgRole[];
  pokemonSlots: RolePokemonSlots;
  onOpenModal: () => void;
  onUpdatePokemonSlots: (slots: RolePokemonSlots) => void;
  className?: string;
}
