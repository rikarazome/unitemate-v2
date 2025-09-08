import React, { useState, useEffect, useCallback } from "react";
import { useApi } from "../hooks/useApi";

interface BadgeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBadges: string[];
  onSave: (badges: string[]) => void;
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

const BadgeSelectionModal: React.FC<BadgeSelectionModalProps> = ({
  isOpen,
  onClose,
  selectedBadges,
  onSave,
}) => {
  const { callApi } = useApi();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internalSelectedBadges, setInternalSelectedBadges] = useState<
    string[]
  >([]);
  const [searchQuery, setSearchQuery] = useState("");

  // バッジデータを取得
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

  // モーダルが開かれた時に選択状態を初期化とバッジデータを取得
  useEffect(() => {
    if (isOpen) {
      setInternalSelectedBadges([...selectedBadges]);
      setSearchQuery("");
      fetchBadges();
    }
  }, [isOpen, selectedBadges, fetchBadges]);

  // 検索フィルタリング
  const filteredBadges = (badges || []).filter((badge) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      badge.display.toLowerCase().includes(query) ||
      badge.condition.toLowerCase().includes(query) ||
      badge.id.toLowerCase().includes(query)
    );
  });

  // チェックボックスの状態変更
  const handleBadgeToggle = (badgeId: string) => {
    setInternalSelectedBadges((prev) => {
      if (prev.includes(badgeId)) {
        return prev.filter((id) => id !== badgeId);
      } else {
        return [...prev, badgeId];
      }
    });
  };

  // 全選択/全解除
  const handleSelectAll = () => {
    if (internalSelectedBadges.length === filteredBadges.length) {
      // 全解除
      setInternalSelectedBadges([]);
    } else {
      // 全選択
      setInternalSelectedBadges(filteredBadges.map((badge) => badge.id));
    }
  };

  // 保存
  const handleSave = () => {
    onSave(internalSelectedBadges);
    onClose();
  };

  // バッジのスタイルを生成
  const getBadgeStyle = (badge: Badge) => {
    if (badge.start_color && badge.end_color) {
      return {
        background: `linear-gradient(135deg, ${badge.start_color}, ${badge.end_color})`,
        color: badge.char_color || "#ffffff",
      };
    }
    return {
      background: "#6b7280",
      color: "#ffffff",
    };
  };

  // モーダルが閉じている場合は早期リターン（全てのフック実行後）
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">勲章選択</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              ×
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            選択中: {internalSelectedBadges.length}個 / 全{badges?.length || 0}
            個
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
              onClick={handleSelectAll}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              {internalSelectedBadges.length === filteredBadges.length
                ? "全解除"
                : "全選択"}
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
          ) : filteredBadges.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">
                {searchQuery
                  ? "検索条件に一致する勲章がありません"
                  : "勲章データがありません"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {filteredBadges.map((badge) => {
                const isSelected = internalSelectedBadges.includes(badge.id);
                return (
                  <div
                    key={badge.id}
                    className={`border rounded-lg p-2 cursor-pointer transition-all ${
                      isSelected
                        ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                    onClick={() => handleBadgeToggle(badge.id)}
                  >
                    <div className="flex flex-col gap-2">
                      {/* チェックボックス */}
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleBadgeToggle(badge.id)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0"
                        />

                        {/* バッジ表示 */}
                        <div
                          className="px-2 py-1 rounded text-xs font-medium flex-1 text-center"
                          style={getBadgeStyle(badge)}
                        >
                          {badge.display}
                        </div>
                        {!badge.is_active && (
                          <span className="px-1 py-0.5 bg-red-100 text-red-600 text-xs rounded flex-shrink-0">
                            無効
                          </span>
                        )}
                      </div>

                      {/* バッジ情報 */}
                      <div className="min-w-0">
                        <p
                          className="text-xs text-gray-700 mb-1 line-clamp-2"
                          title={badge.condition}
                        >
                          {badge.condition}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {badge.id}
                        </p>
                      </div>
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
              {internalSelectedBadges.length > 0 && (
                <span>選択済み: {internalSelectedBadges.length}個</span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BadgeSelectionModal;
