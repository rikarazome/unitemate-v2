import React, { useState } from 'react';
import type { UserInfo } from '../hooks/useUnitemateApi';

interface SeasonDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserInfo | null;
}

const SeasonDataModal: React.FC<SeasonDataModalProps> = ({ 
  isOpen, 
  onClose, 
  user 
}) => {
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');

  const seasonData = user?.season_data || [];
  const selectedSeason = seasonData.find(s => s.season_id === selectedSeasonId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800">過去シーズンデータ</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          {seasonData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              過去シーズンのデータがありません
            </div>
          ) : (
            <div className="space-y-6">
              {/* シーズン選択 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  シーズンを選択
                </label>
                <select
                  value={selectedSeasonId}
                  onChange={(e) => setSelectedSeasonId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">シーズンを選択してください</option>
                  {seasonData.map((season) => (
                    <option key={season.season_id} value={season.season_id}>
                      {season.season_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 選択されたシーズンのデータ */}
              {selectedSeason && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    {selectedSeason.season_name} の結果
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg p-3">
                      <div className="text-sm text-gray-600">最終レート</div>
                      <div className="text-xl font-bold text-gray-900">
                        {selectedSeason.final_rate}
                      </div>
                    </div>
                    
                    <div className="bg-white rounded-lg p-3">
                      <div className="text-sm text-gray-600">最高レート</div>
                      <div className="text-xl font-bold text-gray-900">
                        {selectedSeason.max_rate}
                      </div>
                    </div>
                    
                    <div className="bg-white rounded-lg p-3">
                      <div className="text-sm text-gray-600">勝率</div>
                      <div className="text-xl font-bold text-gray-900">
                        {selectedSeason.win_rate}%
                      </div>
                    </div>
                    
                    <div className="bg-white rounded-lg p-3">
                      <div className="text-sm text-gray-600">最終順位</div>
                      <div className="text-xl font-bold text-gray-900">
                        {selectedSeason.final_rank}位
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg p-3">
                      <div className="text-sm text-gray-600">総試合数</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {selectedSeason.total_matches}試合
                      </div>
                    </div>
                    
                    <div className="bg-white rounded-lg p-3">
                      <div className="text-sm text-gray-600">勝利数</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {selectedSeason.wins}勝
                      </div>
                    </div>
                  </div>

                  {/* レートの変化を可視化 */}
                  <div className="mt-4 bg-white rounded-lg p-3">
                    <div className="text-sm text-gray-600 mb-2">レート推移</div>
                    <div className="flex items-center justify-between">
                      <div className="text-center">
                        <div className="text-xs text-gray-500">開始時</div>
                        <div className="text-sm font-medium">1500</div>
                      </div>
                      <div className="flex-1 mx-2 h-2 bg-gray-200 rounded-full relative">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-400 to-green-400 rounded-full"
                          style={{ 
                            width: `${Math.min((selectedSeason.max_rate / 2000) * 100, 100)}%` 
                          }}
                        />
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500">最終</div>
                        <div className="text-sm font-medium">{selectedSeason.final_rate}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 閉じるボタン */}
          <div className="flex justify-end mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeasonDataModal;