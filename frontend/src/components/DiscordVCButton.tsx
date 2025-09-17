import React from "react";
import { Headphones } from "lucide-react";

interface DiscordVCButtonProps {
  vcLink?: string;
  vcNumber?: string;
  teamName: string;
  className?: string;
}

const DiscordVCButton: React.FC<DiscordVCButtonProps> = ({
  vcLink,
  vcNumber,
  teamName,
  className = "",
}) => {
  if (!vcLink) return null;

  const handleClick = () => {
    // 新しいウィンドウでDiscord VCを開く
    window.open(vcLink, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors text-xs sm:text-sm font-medium ${className}`}
      title={`${teamName}のVCに接続`}
    >
      <Headphones className="w-3 h-3 sm:w-4 sm:h-4" />
      <span>VC{vcNumber}に接続</span>
    </button>
  );
};

export default DiscordVCButton;