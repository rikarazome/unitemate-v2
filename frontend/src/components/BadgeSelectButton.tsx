import React from "react";
import { getBadgeSync } from "../hooks/useBadges";

interface BadgeSelectButtonProps {
  value?: string;
  onChange: (value: string) => void;
  excludeBadgeId?: string;
  ownedBadgeIds: string[];
  placeholder: string;
  className?: string;
}

const BadgeSelectButton: React.FC<BadgeSelectButtonProps> = ({
  value,
  onChange: _onChange,
  excludeBadgeId: _excludeBadgeId,
  ownedBadgeIds: _ownedBadgeIds,
  placeholder,
  className = "",
}) => {
  const selectedBadge = getBadgeSync(value || "");

  return (
    <div className={className}>
      {selectedBadge ? (
        <div
          className="px-4 py-3 rounded-lg text-sm font-bold text-center border-2 border-gray-300 cursor-pointer hover:border-gray-400 transition-all hover:shadow-md"
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
                    background: `linear-gradient(135deg, ${selectedBadge.start_color}, ${selectedBadge.end_color})`,
                  }
                : {
                    background: "#6b7280",
                  }),
            color: selectedBadge.image_card
              ? selectedBadge.char_color || "#ffffff"
              : selectedBadge.char_color || "#ffffff",
            textShadow: selectedBadge.image_card
              ? "1px 1px 2px rgba(0,0,0,0.7)"
              : "none",
          }}
        >
          {selectedBadge.display}
        </div>
      ) : (
        <div className="px-4 py-3 rounded-lg text-sm text-gray-500 text-center border-2 border-dashed border-gray-300 bg-gray-50 cursor-pointer hover:border-gray-400 hover:bg-gray-100 transition-all hover:shadow-md">
          {placeholder}
        </div>
      )}
    </div>
  );
};

export default BadgeSelectButton;