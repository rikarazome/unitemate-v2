import React, { useMemo } from "react";
import { getAllBadges } from "../hooks/useBadges";

interface BadgeSelectorProps {
  value: string | null | undefined;
  onChange: (value: string) => void;
  excludeBadgeId?: string; // 除外する勲章ID（同じ勲章を選択させないため）
  ownedBadgeIds?: string[]; // 所持している勲章IDのリスト
  className?: string;
  label?: string;
  placeholder?: string;
}

// BadgePreviewは将来の使用のために削除せずコメントアウト
/*
const BadgePreview: React.FC<{ badge: Badge; isCompact?: boolean }> = ({ badge, isCompact = false }) => {
  // Implementation...
};
*/

const BadgeSelector: React.FC<BadgeSelectorProps> = ({
  value,
  onChange,
  excludeBadgeId,
  ownedBadgeIds = [],
  className = "",
  label,
  placeholder = "勲章を選択してください",
}) => {
  const allBadges = useMemo(() => getAllBadges(), []);

  // 選択可能な勲章をフィルタリング
  const availableBadges = useMemo(() => {
    console.log("BadgeSelector - ownedBadgeIds:", ownedBadgeIds);
    console.log("BadgeSelector - allBadges count:", allBadges.length);

    return allBadges.filter((badge) => {
      // 除外する勲章をフィルタ
      if (badge.id === excludeBadgeId) return false;
      // 所持勲章のみ選択可能
      if (!ownedBadgeIds.includes(badge.id)) return false;
      return true;
    });
  }, [allBadges, excludeBadgeId, ownedBadgeIds]);

  // 現在選択されている勲章
  const selectedBadge = useMemo(() => {
    return value ? allBadges.find((b) => b.id === value) : null;
  }, [allBadges, value]);

  return (
    <div className={className}>
      {label && (
        <label className="block text-xs text-gray-600 mb-1">{label}</label>
      )}

      <div className="relative">
        {/* 選択された勲章がある場合はドロップダウンボタンをその勲章のデザインにする */}
        {selectedBadge ? (
          <button
            type="button"
            onClick={() => {
              // カスタムドロップダウンを開く（実装は後で行う）
              const select = document.getElementById(`badge-select-${value}`);
              if (select) {
                (select as HTMLSelectElement).click();
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-left relative"
            style={{
              ...(selectedBadge.image_card
                ? {
                    backgroundImage: `url(${selectedBadge.image_card.startsWith("//") ? `https:${selectedBadge.image_card}` : selectedBadge.image_card})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                  }
                : selectedBadge.start_color && selectedBadge.end_color
                  ? {
                      backgroundImage: `linear-gradient(45deg, ${selectedBadge.start_color}, ${selectedBadge.end_color})`,
                    }
                  : selectedBadge.start_color
                    ? {
                        backgroundColor: selectedBadge.start_color,
                      }
                    : {
                        backgroundColor: "#e5e7eb",
                      }),
              color: selectedBadge.image_card
                ? selectedBadge.char_color || "#FFFFFF"
                : selectedBadge.start_color || selectedBadge.end_color
                  ? "#FFFFFF"
                  : "#374151",
              textShadow:
                selectedBadge.image_card ||
                selectedBadge.start_color ||
                selectedBadge.end_color
                  ? "1px 1px 2px rgba(0,0,0,0.7)"
                  : "none",
            }}
          >
            <span className="font-semibold text-sm">
              {selectedBadge.display}
            </span>
            <span className="text-xs opacity-80 ml-1 hidden sm:inline">
              - {selectedBadge.condition}
            </span>

            {/* ドロップダウンアイコン */}
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </button>
        ) : (
          // 未選択の場合は通常のボタン
          <button
            type="button"
            onClick={() => {
              const select = document.getElementById(
                `badge-select-${value || "none"}`,
              );
              if (select) {
                (select as HTMLSelectElement).click();
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-left bg-white text-gray-500 text-sm relative"
          >
            {placeholder}

            {/* ドロップダウンアイコン */}
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
              <svg
                className="w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </button>
        )}

        {/* 実際のselectは非表示にして、上のボタンから操作する */}
        <select
          id={`badge-select-${value || "none"}`}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        >
          <option value="">{placeholder}</option>
          {availableBadges.length === 0 ? (
            <option value="" disabled>
              所持している勲章がありません
            </option>
          ) : (
            availableBadges.map((badge) => (
              <option key={badge.id} value={badge.id}>
                {badge.display} - {badge.condition}
              </option>
            ))
          )}
        </select>
      </div>
    </div>
  );
};

export default BadgeSelector;
