import React, { useState, useEffect } from 'react';
import { useMasterData, useUpdateProfile, type UserInfo } from '../hooks/useUnitemateApi';
import type { UpdateProfileRequest } from '../types/common';

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserInfo | null;
  onSuccess: () => void;
}

const ProfileEditModal: React.FC<ProfileEditModalProps> = ({ 
  isOpen, 
  onClose, 
  user, 
  onSuccess 
}) => {
  const { masterData, loading: masterLoading } = useMasterData();
  const { updateProfile, loading: updateLoading } = useUpdateProfile();

  const [formData, setFormData] = useState<UpdateProfileRequest>({
    trainer_name: user?.trainer_name || '',
    twitter_id: user?.twitter_id || '',
    preferred_roles: user?.preferred_roles || [],
    favorite_pokemon: user?.favorite_pokemon || [],
    current_badge: user?.current_badge || '',
    bio: user?.bio || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && user) {
      setFormData({
        trainer_name: user.trainer_name || '',
        twitter_id: user.twitter_id || '',
        preferred_roles: user.preferred_roles || [],
        favorite_pokemon: user.favorite_pokemon || [],
        current_badge: user.current_badge || '',
        bio: user.bio || '',
      });
      setErrors({});
    }
  }, [isOpen, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // バリデーション
    const newErrors: Record<string, string> = {};
    if (!formData.trainer_name?.trim()) {
      newErrors.trainer_name = 'トレーナー名は必須です';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      await updateProfile(formData);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Profile update failed:', error);
    }
  };

  const handleRoleToggle = (roleId: string) => {
    const currentRoles = formData.preferred_roles || [];
    const newRoles = currentRoles.includes(roleId)
      ? currentRoles.filter(r => r !== roleId)
      : [...currentRoles, roleId];
    
    setFormData({ ...formData, preferred_roles: newRoles });
  };

  const handlePokemonToggle = (pokemonId: string) => {
    const currentPokemon = formData.favorite_pokemon || [];
    const newPokemon = currentPokemon.includes(pokemonId)
      ? currentPokemon.filter(p => p !== pokemonId)
      : [...currentPokemon, pokemonId];
    
    setFormData({ ...formData, favorite_pokemon: newPokemon });
  };

  if (!isOpen) return null;

  // ユーザーデータが存在しない場合の表示
  if (!user) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">プロフィール編集</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="text-center py-8 text-gray-500">
              ユーザー情報の読み込み中です...
            </div>
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
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800">プロフィール編集</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* トレーナー名 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                トレーナー名 *
              </label>
              <input
                type="text"
                value={formData.trainer_name || ''}
                onChange={(e) => setFormData({ ...formData, trainer_name: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.trainer_name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="トレーナー名を入力してください"
              />
              {errors.trainer_name && (
                <p className="text-red-500 text-sm mt-1">{errors.trainer_name}</p>
              )}
            </div>

            {/* Twitter ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Twitter ID
              </label>
              <div className="flex items-center">
                <span className="text-gray-500 mr-2">@</span>
                <input
                  type="text"
                  value={formData.twitter_id || ''}
                  onChange={(e) => setFormData({ ...formData, twitter_id: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="twitter_username"
                />
              </div>
            </div>

            {/* 希望ロール */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                希望ロール
              </label>
              {masterLoading ? (
                <div className="text-gray-500">読み込み中...</div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {masterData?.roles?.map((role) => (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => handleRoleToggle(role.id)}
                      className={`p-3 rounded-lg border text-sm transition-colors ${
                        formData.preferred_roles?.includes(role.id)
                          ? 'bg-blue-100 border-blue-500 text-blue-700'
                          : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {role.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 得意ポケモン */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                得意ポケモン（最大3匹）
              </label>
              {masterLoading ? (
                <div className="text-gray-500">読み込み中...</div>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                  {masterData?.pokemon?.filter(p => p.is_active).map((pokemon) => (
                    <button
                      key={pokemon.id}
                      type="button"
                      onClick={() => handlePokemonToggle(pokemon.id)}
                      disabled={(formData.favorite_pokemon?.length || 0) >= 3 && 
                                !formData.favorite_pokemon?.includes(pokemon.id)}
                      className={`p-2 rounded-lg border text-xs transition-colors disabled:opacity-50 ${
                        formData.favorite_pokemon?.includes(pokemon.id)
                          ? 'bg-green-100 border-green-500 text-green-700'
                          : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {pokemon.name}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">
                選択済み: {formData.favorite_pokemon?.length || 0}/3
              </p>
            </div>

            {/* 現在の勲章 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                表示する勲章
              </label>
              {masterLoading ? (
                <div className="text-gray-500">読み込み中...</div>
              ) : (
                <select
                  value={formData.current_badge || ''}
                  onChange={(e) => setFormData({ ...formData, current_badge: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">勲章を選択してください</option>
                  {masterData?.badges?.filter(b => b.is_active).map((badge) => (
                    <option key={badge.id} value={badge.id}>
                      {badge.name} - {badge.description}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* 一言 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                一言
              </label>
              <textarea
                value={formData.bio || ''}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                maxLength={200}
                placeholder="自己紹介や意気込みなど..."
              />
              <p className="text-xs text-gray-500 mt-1">
                {(formData.bio || '').length}/200
              </p>
            </div>

            {/* ボタン */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={updateLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {updateLoading ? '保存中...' : '保存'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfileEditModal;