/**
 * ロール選択コンポーネント（チェックボックス）
 * 上レーン / サポート / 中央 / 下レーン / タンク から複数選択可能
 */

import React from "react";
import { LFG_ROLES, LFG_ROLE_LABELS } from "../types/lfg";
import type { LfgRole, RoleSelectorProps } from "../types/lfg";

const RoleSelector: React.FC<RoleSelectorProps> = ({
  selectedRoles,
  onRoleChange,
  className = "",
}) => {
  // ロール選択の切り替え
  const handleRoleToggle = (role: LfgRole) => {
    const isSelected = selectedRoles.includes(role);

    if (isSelected) {
      // 選択解除
      onRoleChange(selectedRoles.filter((r) => r !== role));
    } else {
      // 選択追加
      onRoleChange([...selectedRoles, role]);
    }
  };

  // 5つのロールのリスト
  const roles = [
    LFG_ROLES.TOP_LANE,
    LFG_ROLES.SUPPORT,
    LFG_ROLES.MIDDLE,
    LFG_ROLES.BOTTOM_LANE,
    LFG_ROLES.TANK,
  ];

  // ロール別のアイコンパス定義
  const getRoleIcon = (role: LfgRole) => {
    const roleIcons = {
      [LFG_ROLES.TOP_LANE]: "/role_icons/role_top.png",
      [LFG_ROLES.SUPPORT]: "/role_icons/role_support.png",
      [LFG_ROLES.MIDDLE]: "/role_icons/role_mid.png",
      [LFG_ROLES.BOTTOM_LANE]: "/role_icons/role_bottom.png",
      [LFG_ROLES.TANK]: "/role_icons/role_tank.png",
    };
    return roleIcons[role];
  };

  // ロール別の色定義
  const getRoleColor = (role: LfgRole, isSelected: boolean) => {
    const baseColors = {
      [LFG_ROLES.TOP_LANE]: isSelected
        ? "bg-purple-400 border-purple-400 text-white shadow-md"
        : "bg-purple-400/20 border-purple-400/40 text-purple-500 hover:bg-purple-400/30",
      [LFG_ROLES.SUPPORT]: isSelected
        ? "bg-yellow-400 border-yellow-400 text-white shadow-md"
        : "bg-yellow-400/20 border-yellow-400/40 text-yellow-500 hover:bg-yellow-400/30",
      [LFG_ROLES.MIDDLE]: isSelected
        ? "bg-cyan-400 border-cyan-400 text-white shadow-md"
        : "bg-cyan-400/20 border-cyan-400/40 text-cyan-500 hover:bg-cyan-400/30",
      [LFG_ROLES.BOTTOM_LANE]: isSelected
        ? "bg-red-400 border-red-400 text-white shadow-md"
        : "bg-red-400/20 border-red-400/40 text-red-500 hover:bg-red-400/30",
      [LFG_ROLES.TANK]: isSelected
        ? "bg-green-400 border-green-400 text-white shadow-md"
        : "bg-green-400/20 border-green-400/40 text-green-500 hover:bg-green-400/30",
    };
    return baseColors[role];
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">希望ロール</h3>
        <span className="ml-2 text-sm text-gray-500">（複数選択可）</span>
      </div>

      {/* コンテナで最大幅を制限 */}
      <div className="max-w-2xl mx-auto">
        <div className="grid grid-cols-5 gap-2 max-[500px]:gap-0">
          {roles.map((role) => {
            const isSelected = selectedRoles.includes(role);
            const label = LFG_ROLE_LABELS[role];

            return (
              <label
                key={role}
                className={`
                flex flex-col items-center justify-center p-2 max-[500px]:p-1 rounded-lg border-2 cursor-pointer transition-all duration-200
                hover:scale-105 active:scale-95 text-center aspect-square relative
                ${getRoleColor(role, isSelected)}
              `}
                aria-label={`${label}を${isSelected ? "選択解除" : "選択"}する`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleRoleToggle(role)}
                  className="sr-only"
                  aria-describedby={`role-${role}-description`}
                />

                {/* ロールアイコン */}
                <img
                  src={getRoleIcon(role)}
                  alt={`${label}アイコン`}
                  className="w-8 h-8 max-[500px]:w-6 max-[500px]:h-6 object-contain mb-1"
                />

                {/* ロール名 */}
                <span className="font-medium select-none text-xs max-[500px]:text-[10px] leading-tight">
                  {label}
                </span>

                {/* アクセシビリティ用の説明（非表示） */}
                <span id={`role-${role}-description`} className="sr-only">
                  {label}ロールの選択チェックボックス
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RoleSelector;
