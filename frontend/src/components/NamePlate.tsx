/**
 * ネームプレートコンポーネント
 * 勲章に応じたグラデーション背景またはバナー画像背景でユーザー情報を表示
 */

import React from "react";
import { useBadges } from "../hooks/useBadges";
import { useAuth0 } from "@auth0/auth0-react";
import { useDummyAuth } from "../hooks/useDummyAuth";

interface NamePlateProps {
  // ユーザー情報
  trainerName: string;
  discordUsername?: string;
  twitterId?: string;
  rate: number;
  maxRate: number;
  avatarUrl?: string;

  // 勲章情報（勲章IDを受け取る）
  primaryBadgeId?: string | null;
  secondaryBadgeId?: string | null;

  // ロール情報
  role?: string; // プレイヤーのロール（TOP_LANE, MIDDLE, BOTTOM_LANE, SUPPORT, TANK）

  // レイアウト設定
  width?: number; // 120px～300px（指定されない場合は自動調整）
  showTwitterButton?: boolean; // 右上のTwitterボタン表示
  showInfoButton?: boolean; // 右上の情報ボタン表示
  onInfoClick?: () => void; // 情報ボタンクリック時のコールバック
  teamColor?: "purple" | "orange"; // チーム色（iボタンの色用）
  isRightAligned?: boolean; // 右寄せレイアウト（チームB用）
  className?: string;
}

const NamePlate: React.FC<NamePlateProps> = ({
  trainerName,
  discordUsername,
  twitterId: _twitterId, // eslint-disable-line @typescript-eslint/no-unused-vars
  rate,
  maxRate,
  avatarUrl,
  primaryBadgeId,
  secondaryBadgeId,
  role,
  width,
  showTwitterButton: _showTwitterButton = false, // eslint-disable-line @typescript-eslint/no-unused-vars
  showInfoButton = false,
  onInfoClick,
  teamColor,
  isRightAligned = false,
  className = "",
}) => {
  // 認証情報を取得
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const dummyAuth = useDummyAuth();
  
  // トークンを取得
  const [authToken, setAuthToken] = React.useState<string | undefined>();
  React.useEffect(() => {
    const getToken = async () => {
      if (isAuthenticated) {
        try {
          const token = await getAccessTokenSilently();
          setAuthToken(token);
        } catch (error) {
          console.error("Failed to get auth token:", error);
        }
      } else if (dummyAuth.isAuthenticated && dummyAuth.token) {
        setAuthToken(dummyAuth.token);
      }
    };
    getToken();
  }, [isAuthenticated, getAccessTokenSilently, dummyAuth.isAuthenticated, dummyAuth.token]);

  // 勲章データを取得
  const { getBadge } = useBadges(authToken);
  // 幅が指定されていない場合は、CSSで自動調整（min-120px, max-300px）
  const useFixedWidth = width !== undefined;
  const clampedWidth = useFixedWidth
    ? Math.max(120, Math.min(300, width))
    : undefined;

  // ロールアイコンのパスを取得
  const getRoleIconPath = (role?: string) => {
    if (!role) return null;

    const roleMap: { [key: string]: string } = {
      TOP_LANE: "/role_icons/role_top.png",
      MIDDLE: "/role_icons/role_mid.png",
      BOTTOM_LANE: "/role_icons/role_bottom.png",
      SUPPORT: "/role_icons/role_support.png",
      TANK: "/role_icons/role_tank.png",
    };

    return roleMap[role.toUpperCase()] || null;
  };

  const roleIconPath = getRoleIconPath(role);

  // 勲章データを取得
  const primaryBadge = primaryBadgeId ? getBadge(primaryBadgeId) : null;
  const secondaryBadge = secondaryBadgeId ? getBadge(secondaryBadgeId) : null;

  // グラデーション色の決定
  const getGradientColors = () => {
    // 1つ目の勲章の開始色
    const primaryColor = primaryBadge?.start_color || "transparent";

    // 2つ目の勲章の終了色（1つ目の勲章の終了色は使わない）
    const secondaryColor = secondaryBadge?.end_color || "transparent";

    return { primaryColor, secondaryColor };
  };

  // 画像の優先順位: 1つ目の勲章 > 2つ目の勲章
  let imageCardUrl = primaryBadge?.image_card || secondaryBadge?.image_card;
  let bannerImageUrl =
    primaryBadge?.banner_image || secondaryBadge?.banner_image;

  // URLが//で始まる場合はhttps:を追加
  if (imageCardUrl && imageCardUrl.startsWith("//")) {
    imageCardUrl = `https:${imageCardUrl}`;
  }
  if (bannerImageUrl && bannerImageUrl.startsWith("//")) {
    bannerImageUrl = `https:${bannerImageUrl}`;
  }

  // ランキング用の横長レイアウトの場合はbanner_imageを使用
  const backgroundImageUrl =
    width && width > 200 ? bannerImageUrl || imageCardUrl : imageCardUrl;

  const { primaryColor, secondaryColor } = getGradientColors();

  // 文字色の決定
  const textColor = (() => {
    // char_colorが指定されている場合はそれを使用
    const badgeCharColor =
      primaryBadge?.char_color || secondaryBadge?.char_color;
    if (badgeCharColor) {
      return badgeCharColor;
    }

    // char_colorが指定されていない場合は常にデフォルト（黒文字）
    return "#000000";
  })();

  // 背景スタイルの決定
  const backgroundStyle = backgroundImageUrl
    ? {
        backgroundImage: `url(${backgroundImageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center center",
        backgroundRepeat: "no-repeat",
      }
    : primaryColor === "transparent" && secondaryColor === "transparent"
      ? {
          background: "transparent",
        }
      : {
          background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
        };

  // レスポンシブなフォントサイズ
  const getFontSizeClasses = () => {
    if (useFixedWidth && clampedWidth && clampedWidth <= 140) {
      return {
        name: "text-[10px]",
        username: "text-[8px]",
        rate: "text-[9px]",
        label: "text-[7px]",
        avatar: "w-5 h-5",
      };
    } else if (useFixedWidth && clampedWidth && clampedWidth <= 200) {
      return {
        name: "text-xs",
        username: "text-[10px]",
        rate: "text-[10px]",
        label: "text-[8px]",
        avatar: "w-6 h-6",
      };
    } else if (useFixedWidth) {
      return {
        name: "text-sm",
        username: "text-xs",
        rate: "text-xs",
        label: "text-[10px]",
        avatar: "w-8 h-8",
      };
    } else {
      // 自動サイズ調整の場合、レスポンシブクラスを使用
      return {
        name: "text-xs sm:text-sm",
        username: "text-[10px] sm:text-xs",
        rate: "text-[10px] sm:text-xs",
        label: "text-[8px] sm:text-[10px]",
        avatar: "w-6 h-6 sm:w-8 sm:h-8",
      };
    }
  };

  const fontSizes = getFontSizeClasses();

  return (
    <div
      className={`relative overflow-hidden border-t-2 border-b-2 border-white/20 h-fit ${useFixedWidth ? "" : "w-full min-w-[120px] max-w-[300px]"} ${className}`}
      style={useFixedWidth ? { width: `${clampedWidth}px` } : {}}
    >
      {/* 背景レイヤー */}
      <div className="absolute inset-0" style={backgroundStyle} />

      {/* ロールアイコン（絶対配置） */}
      {roleIconPath && (
        <div
          className={`absolute top-1 z-20 ${isRightAligned ? "right-1" : "left-1"}`}
        >
          <img
            src={roleIconPath}
            alt={`Role: ${role}`}
            className="w-4 h-4 sm:w-5 sm:h-5"
            title={`ロール: ${role}`}
          />
        </div>
      )}

      {/* iボタン（絶対配置） */}
      {showInfoButton && (
        <button
          onClick={onInfoClick}
          className={`absolute top-1 z-20 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center transition-colors font-semibold ${
            isRightAligned ? "left-1" : "right-1"
          } ${
            teamColor === "purple"
              ? "bg-purple-600 hover:bg-purple-700 border border-purple-400"
              : teamColor === "orange"
                ? "bg-orange-600 hover:bg-orange-700 border border-orange-400"
                : "bg-gray-600 hover:bg-gray-700 border border-gray-400"
          }`}
          title="プレイヤー情報を表示"
        >
          i
        </button>
      )}

      {/* コンテンツ */}
      <div className="relative z-10 p-2 h-fit" style={{ color: textColor }}>
        {/* 上段: アイコン + 名前 + Twitter/Action ボタンエリア */}
        <div
          className={`flex items-center justify-between mb-1 ${isRightAligned ? "flex-row-reverse" : ""}`}
        >
          <div
            className={`flex items-center min-w-0 flex-1 ${isRightAligned ? "flex-row-reverse" : ""}`}
          >
            {/* アイコン */}
            <div
              className={`flex-shrink-0 ${isRightAligned ? "ml-2" : "mr-2"}`}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className={`rounded-full ${fontSizes.avatar}`}
                />
              ) : (
                <div
                  className={`rounded-full bg-white/20 flex items-center justify-center ${fontSizes.avatar}`}
                >
                  <span className={`${fontSizes.name}`}>👤</span>
                </div>
              )}
            </div>

            {/* 名前部分 */}
            <div className="min-w-0 flex-1">
              <div
                className={`font-bold truncate ${fontSizes.name} ${isRightAligned ? "text-right" : ""}`}
                title={trainerName}
              >
                {trainerName}
              </div>
              {discordUsername && (
                <div
                  className={`opacity-80 truncate ${fontSizes.username} ${isRightAligned ? "text-right" : ""}`}
                  title={discordUsername}
                >
                  {discordUsername}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 区切り線 */}
        <div
          className="border-t my-1"
          style={{ borderColor: `${textColor}30` }}
        />

        {/* 下段: レート情報 */}
        <div
          className={`flex w-full gap-2 ${isRightAligned ? "flex-row-reverse" : ""}`}
        >
          {/* Rate */}
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-1 bg-gradient-to-r from-cyan-100 to-blue-100 px-2 py-0.5 rounded-full">
              <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
              <span className={`${fontSizes.label} text-gray-700`}>Rate</span>
              <span className={`font-bold ${fontSizes.rate} text-gray-900`}>
                {Math.round(rate)}
              </span>
            </div>
          </div>

          {/* Best */}
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-1 bg-gradient-to-r from-purple-100 to-pink-100 px-2 py-0.5 rounded-full">
              <div className="w-2 h-2 bg-purple-500 animate-pulse transform rotate-45"></div>
              <span className={`${fontSizes.label} text-gray-700`}>Best</span>
              <span className={`font-bold ${fontSizes.rate} text-gray-900`}>
                {Math.round(maxRate)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NamePlate;
