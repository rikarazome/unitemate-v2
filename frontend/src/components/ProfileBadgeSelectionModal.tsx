import React, { useState, useEffect, useCallback } from "react";
import { useApi } from "../hooks/useApi";
import { getBadgeSync } from "../hooks/useBadges";

interface ProfileBadgeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBadgeId?: string;
  excludeBadgeId?: string;
  ownedBadgeIds: string[];
  onSelect: (badgeId: string) => void;
  title: string;
}

interface Badge {
  id: string;
  condition: string;
  display: string;
  start_color: string | null;
  end_color: string | null;
  char_color: string | null;
  image_card: string | null;
  banner_image: string | null;
  type: "gradient" | "image" | "basic";
  price: number;
  max_sales: number;
  current_sales: number;
  is_active: boolean;
}

const ProfileBadgeSelectionModal: React.FC<ProfileBadgeSelectionModalProps> = ({
  isOpen,
  onClose,
  currentBadgeId,
  excludeBadgeId,
  ownedBadgeIds,
  onSelect,
  title,
}) => {
  const { callApi } = useApi();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchBadges = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await callApi<{ badges: Badge[] }>("/api/master", {
        method: "GET",
      });

      if (response.data) {
        setBadges(response.data.badges || []);
      } else {
        setBadges([]);
      }
    } catch (err) {
      console.error("Failed to fetch badges:", err);
      setError("バッジデータの取得に失敗しました");
      setBadges([]);
    } finally {
      setIsLoading(false);
    }
  }, [callApi]);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      fetchBadges();
    }
  }, [isOpen, fetchBadges]);

  // 所持している勲章のみフィルタリング + 検索フィルタリング
  const filteredBadges = (badges || [])
    .filter((badge) => ownedBadgeIds.includes(badge.id))
    .filter((badge) => {
      if (excludeBadgeId && badge.id === excludeBadgeId) return false;
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        badge.display.toLowerCase().includes(query) ||
        badge.condition.toLowerCase().includes(query) ||
        badge.id.toLowerCase().includes(query)
      );
    });

  const handleBadgeSelect = (badgeId: string) => {
    onSelect(badgeId);
    onClose();
  };

  const handleRemoveBadge = () => {
    onSelect("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              ×
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            所持勲章: {ownedBadgeIds.length}個 / 表示中: {filteredBadges.length}個
          </p>
        </div>

        {/* 検索バー */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="text"
                placeholder="勲章名、条件、IDで検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleRemoveBadge}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              勲章を外す
            </button>
          </div>
          {searchQuery && (
            <p className="text-sm text-gray-500 mt-2">
              検索結果: {filteredBadges.length}件
            </p>
          )}
        </div>

        {/* バッジリスト */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-gray-600 mt-2">勲章データを読み込み中...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600">勲章データの読み込みに失敗しました</p>
              <p className="text-sm text-gray-500 mt-1">{error}</p>
            </div>
          ) : ownedBadgeIds.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">所持している勲章がありません</p>
              <p className="text-sm text-gray-400 mt-1">
                ショップで勲章を購入するか、条件を達成して勲章を獲得してください
              </p>
            </div>
          ) : filteredBadges.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">
                {searchQuery
                  ? "検索条件に一致する勲章がありません"
                  : "表示できる勲章がありません"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {filteredBadges.map((badge) => {
                const isSelected = currentBadgeId === badge.id;
                return (
                  <div
                    key={badge.id}
                    className={`border rounded-lg p-2 cursor-pointer transition-all ${
                      isSelected
                        ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                    onClick={() => handleBadgeSelect(badge.id)}
                  >
                    <div className="flex flex-col gap-3">
                      {/* バッジ表示 - 大きく目立つように */}
                      <div
                        className="px-4 py-6 rounded-lg text-sm font-bold text-center min-h-[80px] flex items-center justify-center"
                        style={{
                          ...(badge.image_card
                            ? {
                                backgroundImage: `url(${badge.image_card.startsWith("//") ? `https:${badge.image_card}` : badge.image_card})`,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                                backgroundRepeat: "no-repeat",
                              }
                            : badge.start_color && badge.end_color
                              ? {
                                  background: `linear-gradient(135deg, ${badge.start_color}, ${badge.end_color})`,
                                }
                              : {
                                  background: "#6b7280",
                                }),
                          color: badge.image_card
                            ? badge.char_color || "#ffffff"
                            : badge.char_color || "#ffffff",
                          textShadow: badge.image_card
                            ? "1px 1px 2px rgba(0,0,0,0.7)"
                            : "none",
                        }}
                      >
                        {badge.display}
                      </div>

                      {/* バッジ情報 */}
                      <div className="min-w-0">
                        <p
                          className="text-xs text-gray-700 mb-1 line-clamp-2 text-center"
                          title={badge.condition}
                        >
                          {badge.condition}
                        </p>
                      </div>

                      {/* 無効状態表示 */}
                      {!badge.is_active && (
                        <div className="text-center">
                          <span className="px-2 py-1 bg-red-100 text-red-600 text-xs font-medium rounded">
                            無効
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {currentBadgeId && (
                <span>
                  現在選択中: {getBadgeSync(currentBadgeId)?.display || currentBadgeId}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileBadgeSelectionModal;