import React, { useState, useEffect } from "react";
import badgesData from "../data/badges/badges.json";

interface Badge {
  id: string;
  display: string;
  condition: string;
  type: string;
}

interface BadgeMapping {
  rank_1st?: string;
  rank_2nd?: string;
  rank_3rd?: string;
  rank_top10?: string;
  rank_top100?: string;
  battle_100?: string;
  battle_200?: string;
  battle_300?: string;
  battle_400?: string;
  battle_500?: string;
  battle_600?: string;
  battle_700?: string;
  battle_800?: string;
  battle_900?: string;
  battle_1000?: string;
  gold_license?: string;
}

interface SeasonResetModalProps {
  seasonId: string;
  seasonName: string;
  isOpen: boolean;
  onClose: () => void;
  onGrantBadges: (seasonId: string, badgeMapping: BadgeMapping) => Promise<boolean>;
  onResetRates: (seasonId: string) => void;
  loading: boolean;
}

const SeasonResetModal: React.FC<SeasonResetModalProps> = ({
  seasonId,
  seasonName,
  isOpen,
  onClose,
  onGrantBadges,
  onResetRates,
  loading,
}) => {
  const [badgeMapping, setBadgeMapping] = useState<BadgeMapping>({});
  const [badgesGranted, setBadgesGranted] = useState(false); // 勲章付与済みフラグ
  const badges = badgesData as Badge[];

  // モーダルが開かれたときにマッピングと状態をリセット
  useEffect(() => {
    if (isOpen) {
      setBadgeMapping({});
      setBadgesGranted(false);
    }
  }, [isOpen]);

  const handleBadgeSelect = (category: keyof BadgeMapping, badgeId: string) => {
    setBadgeMapping((prev) => ({
      ...prev,
      [category]: badgeId,
    }));
  };

  const handleGrantBadges = async () => {
    if (!confirm(`シーズン「${seasonName}」の勲章を付与しますか？\n\nこの操作により:\n- ランキングと試合数に応じて勲章が付与されます\n- 過去シーズンデータとして記録されます\n\nこの操作は取り消せません。`)) {
      return;
    }
    const success = await onGrantBadges(seasonId, badgeMapping);
    if (success) {
      setBadgesGranted(true);
    }
  };

  const handleResetRates = () => {
    if (!badgesGranted) {
      alert("先に勲章を付与してください。");
      return;
    }

    if (!confirm(`⚠️ 警告: 全ユーザーのレートと試合記録をリセットしますか？\n\nこの操作により:\n- 全ユーザーのレート・最高レート・試合数・勝利数がリセットされます\n- 全ての試合記録が削除されます\n- この操作は取り消せません\n\n本当に実行しますか？`)) {
      return;
    }

    if (!confirm("最終確認: 本当にレートリセットを実行しますか？")) {
      return;
    }

    onResetRates(seasonId);
  };

  if (!isOpen) return null;

  const categoryLabels: Record<keyof BadgeMapping, string> = {
    rank_1st: "1位",
    rank_2nd: "2位",
    rank_3rd: "3位",
    rank_top10: "TOP10",
    rank_top100: "TOP100",
    battle_100: "100戦",
    battle_200: "200戦",
    battle_300: "300戦",
    battle_400: "400戦",
    battle_500: "500戦",
    battle_600: "600戦",
    battle_700: "700戦",
    battle_800: "800戦",
    battle_900: "900戦",
    battle_1000: "1000戦",
    gold_license: "ゴールド免許",
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* ヘッダー */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            シーズンリセット - バッジ設定
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            シーズン: <span className="font-semibold">{seasonName}</span>
          </p>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              ⚠️ <strong>重要:</strong> 各カテゴリに付与するバッジを選択してください。
              <br />
              未選択のカテゴリはバッジが付与されません。
              <br />
              この操作は取り消せません。慎重に設定してください。
            </p>
          </div>

          <div className="space-y-6">
            {/* 順位バッジセクション */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                🏆 順位バッジ
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(["rank_1st", "rank_2nd", "rank_3rd", "rank_top10", "rank_top100"] as const).map(
                  (category) => (
                    <div key={category} className="border border-gray-200 rounded-lg p-3">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {categoryLabels[category]}
                      </label>
                      <select
                        value={badgeMapping[category] || ""}
                        onChange={(e) => handleBadgeSelect(category, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                      >
                        <option value="">バッジを選択...</option>
                        {badges.map((badge) => (
                          <option key={badge.id} value={badge.id}>
                            {badge.display} ({badge.id})
                          </option>
                        ))}
                      </select>
                      {badgeMapping[category] && (
                        <div className="mt-2 text-xs text-gray-600">
                          選択中: {badges.find((b) => b.id === badgeMapping[category])?.display}
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>

            {/* 試合数バッジセクション */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                ⚔️ 試合数バッジ
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(["battle_100", "battle_200", "battle_300", "battle_400", "battle_500",
                   "battle_600", "battle_700", "battle_800", "battle_900", "battle_1000"] as const).map(
                  (category) => (
                    <div key={category} className="border border-gray-200 rounded-lg p-3">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {categoryLabels[category]}
                      </label>
                      <select
                        value={badgeMapping[category] || ""}
                        onChange={(e) => handleBadgeSelect(category, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                      >
                        <option value="">バッジを選択...</option>
                        {badges.map((badge) => (
                          <option key={badge.id} value={badge.id}>
                            {badge.display} ({badge.id})
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* 特別バッジセクション */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                🎖️ 特別バッジ
              </h3>
              <div className="border border-gray-200 rounded-lg p-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {categoryLabels.gold_license}（ペナルティ0で50戦以上）
                </label>
                <select
                  value={badgeMapping.gold_license || ""}
                  onChange={(e) => handleBadgeSelect("gold_license", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                >
                  <option value="">バッジを選択...</option>
                  {badges.map((badge) => (
                    <option key={badge.id} value={badge.id}>
                      {badge.display} ({badge.id})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex flex-col gap-4">
            <div className="text-sm text-gray-600">
              設定済み: {Object.keys(badgeMapping).filter((k) => badgeMapping[k as keyof BadgeMapping]).length} / {Object.keys(categoryLabels).length}
            </div>

            {/* ステップ1: 勲章付与 */}
            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex-1">
                <div className="font-semibold text-blue-900">ステップ1: 勲章付与</div>
                <div className="text-sm text-blue-700">
                  {badgesGranted
                    ? "✅ 勲章付与完了 - 過去シーズンデータ記録済み"
                    : "ランキングと試合数に応じて勲章を付与し、過去シーズンデータを記録します"}
                </div>
              </div>
              <button
                onClick={handleGrantBadges}
                disabled={loading || badgesGranted}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold whitespace-nowrap"
              >
                {badgesGranted ? "付与済み" : "勲章を付与"}
              </button>
            </div>

            {/* ステップ2: レートリセット */}
            <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex-1">
                <div className="font-semibold text-red-900">ステップ2: レートリセット</div>
                <div className="text-sm text-red-700">
                  全ユーザーのレート・試合数をリセットし、全試合記録を削除します
                  {!badgesGranted && <span className="block mt-1 font-semibold">⚠️ 先にステップ1を完了してください</span>}
                </div>
              </div>
              <button
                onClick={handleResetRates}
                disabled={loading || !badgesGranted}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold whitespace-nowrap"
              >
                レートをリセット
              </button>
            </div>

            {/* 閉じるボタン */}
            <div className="flex justify-end">
              <button
                onClick={onClose}
                disabled={loading}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeasonResetModal;
