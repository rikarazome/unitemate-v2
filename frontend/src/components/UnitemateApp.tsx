import React, { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useUser } from '../hooks/useUser';
import { 
  useUserInfo, 
  useUserRecords, 
  useQueueInfo, 
  useRanking, 
  useMatchQueue,
  useMasterData
} from '../hooks/useUnitemateApi';
import UserCreationForm from './UserCreationForm';
import ProfileEditModal from './ProfileEditModal';
import SeasonDataModal from './SeasonDataModal';
import type { Auth0UserProfile } from '../types/user';

// タブの定義
type TabId = 'rules' | 'mypage' | 'match' | 'ranking';

interface Tab {
  id: TabId;
  label: string;
  icon?: string;
}

const tabs: Tab[] = [
  { id: 'rules', label: 'ルール', icon: '📋' },
  { id: 'mypage', label: 'マイページ', icon: '👤' },
  { id: 'match', label: 'マッチング', icon: '⚔️' },
  { id: 'ranking', label: 'ランキング', icon: '🏆' },
];

// 各タブコンポーネント
const RulesTab: React.FC = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-xl lg:text-2xl font-bold text-gray-800 mb-4 lg:mb-6">ルール・お知らせ</h2>
      
      {/* 現在のシーズン情報 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <span className="text-2xl mr-3">📢</span>
          <h3 className="text-lg font-semibold text-blue-800">シーズン2 開催中！</h3>
        </div>
        <p className="text-blue-700 mb-2">
          <strong>期間:</strong> 2024年4月1日 〜 2024年6月30日
        </p>
        <p className="text-blue-700">
          新シーズンが開始されました。新しいポケモンやルール変更がありますので、下記をご確認ください。
        </p>
      </div>

      {/* 基本ルール */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className="text-xl mr-2">📋</span>
          基本ルール
        </h3>
        <ul className="space-y-3 text-gray-700">
          <li className="flex items-start">
            <span className="text-green-500 mr-2 mt-1">✓</span>
            <span>1試合は最大10分間です</span>
          </li>
          <li className="flex items-start">
            <span className="text-green-500 mr-2 mt-1">✓</span>
            <span>チームは5vs5で構成されます</span>
          </li>
          <li className="flex items-start">
            <span className="text-green-500 mr-2 mt-1">✓</span>
            <span>同じポケモンの重複選択はできません</span>
          </li>
          <li className="flex items-start">
            <span className="text-green-500 mr-2 mt-1">✓</span>
            <span>試合開始後の途中離脱はペナルティが科されます</span>
          </li>
        </ul>
      </div>

      {/* マッチングルール */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className="text-xl mr-2">⚔️</span>
          マッチングルール
        </h3>
        <ul className="space-y-3 text-gray-700">
          <li className="flex items-start">
            <span className="text-blue-500 mr-2 mt-1">•</span>
            <span>レート差±200以内でマッチングを行います</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-2 mt-1">•</span>
            <span>待機時間が長い場合、レート差は徐々に拡大されます</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-2 mt-1">•</span>
            <span>希望ロールを設定することで、バランスの取れたチーム編成を目指します</span>
          </li>
        </ul>
      </div>

      {/* レーティングシステム */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className="text-xl mr-2">📊</span>
          レーティングシステム
        </h3>
        <div className="space-y-3 text-gray-700">
          <p>
            <strong>初期レート:</strong> 1500
          </p>
          <p>
            <strong>レート変動:</strong> 試合結果により±10〜50ポイント変動
          </p>
          <p>
            <strong>ランキング:</strong> 最高レートを基準に順位が決定されます
          </p>
        </div>
      </div>

      {/* 重要なお知らせ */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center text-yellow-800">
          <span className="text-xl mr-2">⚠️</span>
          重要なお知らせ
        </h3>
        <div className="space-y-2 text-yellow-700">
          <p className="font-medium">2024年5月15日更新</p>
          <ul className="space-y-1 ml-4">
            <li>• 新ポケモン「ミュウツー」が追加されました</li>
            <li>• 一部ポケモンのバランス調整を実施しました</li>
            <li>• マッチング待機時間の短縮を行いました</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

const MyPageTab: React.FC = () => {
  const { isAuthenticated, user, loginWithRedirect, logout } = useAuth0();
  const { userInfo, loading: userInfoLoading } = useUserInfo(user?.sub);
  const { records, loading: recordsLoading } = useUserRecords(user?.sub);
  const { masterData } = useMasterData();
  
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [isSeasonDataOpen, setIsSeasonDataOpen] = useState(false);

  const handleLogin = () => {
    loginWithRedirect({
      authorizationParams: {
        connection: 'discord'
      }
    });
  };

  const handleLogout = () => {
    logout({ logoutParams: { returnTo: window.location.origin } });
  };
  
  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl lg:text-2xl font-bold text-gray-800 mb-4 lg:mb-6">マイページ</h2>
        
        <div className="text-center">
          <div className="bg-gradient-to-br from-purple-100 to-orange-100 rounded-xl p-8 border border-purple-200/50 shadow-lg">
            <div className="mb-6">
              <span className="text-6xl">🎮</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              ログインしてマイページを表示
            </h3>
            <p className="text-gray-600 mb-6">
              Discordアカウントでログインして、プロフィールや試合履歴を確認しましょう
            </p>
            <button
              onClick={handleLogin}
              className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-8 py-3 rounded-lg font-medium hover:from-purple-600 hover:to-purple-700 transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:scale-105"
            >
              🎮 Discordでログイン
            </button>
          </div>
        </div>
      </div>
    );
  }

  // マスターデータから現在の勲章名を取得
  const currentBadge = masterData?.badges?.find(b => b.id === userInfo?.current_badge);
  
  // 得意ポケモン名を取得
  const favoritePokemonNames = userInfo?.favorite_pokemon?.map(pokemonId => 
    masterData?.pokemon?.find(p => p.id === pokemonId)?.name
  ).filter(Boolean) || [];
  
  // 希望ロール名を取得
  const preferredRoleNames = userInfo?.preferred_roles?.map(roleId => 
    masterData?.roles?.find(r => r.id === roleId)?.name
  ).filter(Boolean) || [];

  return (
    <div className="space-y-6">
      <h2 className="text-xl lg:text-2xl font-bold text-gray-800 mb-4 lg:mb-6">マイページ</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        {/* プロフィール情報 */}
        <div className="bg-gradient-to-br from-purple-50 to-orange-50 rounded-xl shadow-lg p-6 border border-purple-200/50">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">プロフィール</h3>
            <button
              onClick={handleLogout}
              className="text-red-600 hover:text-red-800 text-sm font-medium"
            >
              ログアウト
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {user?.picture && (
                  <img
                    src={user.picture}
                    alt="Avatar"
                    className="w-12 h-12 rounded-full mr-3"
                  />
                )}
                <div>
                  <p className="font-medium">{userInfo?.trainer_name || user?.nickname || user?.name}</p>
                  <p className="text-sm text-gray-500">Discord連携済み</p>
                </div>
              </div>
              <button
                onClick={() => setIsProfileEditOpen(true)}
                className="bg-gradient-to-r from-orange-400 to-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:from-orange-500 hover:to-orange-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                編集
              </button>
            </div>
            
            {userInfo?.twitter_id && (
              <div>
                <span className="text-sm text-gray-600">Twitter: </span>
                <a 
                  href={`https://twitter.com/${userInfo.twitter_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  @{userInfo.twitter_id}
                </a>
              </div>
            )}
            
            {preferredRoleNames.length > 0 && (
              <div>
                <span className="text-sm text-gray-600">希望ロール: </span>
                <span className="text-sm">{preferredRoleNames.join(', ')}</span>
              </div>
            )}
            
            {favoritePokemonNames.length > 0 && (
              <div>
                <span className="text-sm text-gray-600">得意ポケモン: </span>
                <span className="text-sm">{favoritePokemonNames.join(', ')}</span>
              </div>
            )}
            
            {currentBadge && (
              <div>
                <span className="text-sm text-gray-600">勲章: </span>
                <span className="text-sm font-medium">{currentBadge.name}</span>
              </div>
            )}
            
            {userInfo?.bio && (
              <div>
                <span className="text-sm text-gray-600">一言: </span>
                <p className="text-sm mt-1">{userInfo.bio}</p>
              </div>
            )}
          </div>
        </div>
        
        {/* ステータス情報 */}
        <div className="bg-gradient-to-br from-orange-50 to-purple-50 rounded-xl shadow-lg p-6 border border-orange-200/50">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">ステータス</h3>
            <button
              onClick={() => setIsSeasonDataOpen(true)}
              className="text-purple-600 hover:text-purple-800 text-sm font-medium"
            >
              過去データ
            </button>
          </div>
          {userInfoLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500 mx-auto"></div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">現在のレート:</span>
                <span className="font-semibold">{userInfo?.rate || 1500}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">最高レート:</span>
                <span className="font-semibold">{userInfo?.unitemate_max_rate || 1500}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">総試合数:</span>
                <span className="font-semibold">{userInfo?.unitemate_num_record || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">勝利数:</span>
                <span className="font-semibold">{userInfo?.unitemate_num_win || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">勝率:</span>
                <span className="font-semibold">{userInfo?.unitemate_winrate || 0}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">ペナルティ:</span>
                <span className={`font-semibold ${
                  (userInfo?.penalty_count || 0) > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {userInfo?.penalty_count || 0}
                </span>
              </div>
              {currentBadge && (
                <div className="flex justify-between">
                  <span className="text-gray-600">現在の勲章:</span>
                  <span className="font-semibold">{currentBadge.name}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* 最近の試合履歴 */}
      <div className="bg-gradient-to-br from-white to-purple-50/30 rounded-xl shadow-lg p-6 border border-purple-100">
        <h3 className="text-lg font-semibold mb-4">最近の試合履歴</h3>
        {recordsLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            試合履歴がありません
          </div>
        ) : (
          <div className="space-y-2">
            {records.slice(0, 10).map((record) => (
              <div
                key={record.match_id}
                className={`p-3 rounded-lg border ${
                  record.winlose ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-1 rounded text-sm font-medium ${
                      record.winlose ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {record.winlose ? '勝利' : '敗北'}
                    </span>
                    <span className="text-sm text-gray-600">
                      {record.pokemon || 'ポケモン未選択'}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className={`font-semibold ${
                      record.rate_delta >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {record.rate_delta >= 0 ? '+' : ''}{record.rate_delta}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(record.started_date * 1000).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* モーダル */}
      <ProfileEditModal
        isOpen={isProfileEditOpen}
        onClose={() => setIsProfileEditOpen(false)}
        user={userInfo}
        onSuccess={() => {
          // ユーザー情報を再取得する場合はここで実装
          window.location.reload(); // 簡易的な実装
        }}
      />
      
      <SeasonDataModal
        isOpen={isSeasonDataOpen}
        onClose={() => setIsSeasonDataOpen(false)}
        user={userInfo}
      />
    </div>
  );
};

const MatchTab: React.FC = () => {
  const { isAuthenticated } = useAuth0();
  const { queueInfo, loading: queueLoading } = useQueueInfo();
  const { 
    isInQueue, 
    loading: matchLoading, 
    error: matchError,
    joinQueue, 
    leaveQueue 
  } = useMatchQueue();
  
  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">ログインが必要です</p>
      </div>
    );
  }

  const handleToggleQueue = async () => {
    if (isInQueue) {
      await leaveQueue();
    } else {
      await joinQueue();
    }
  };

  const waitingPlayers = queueInfo?.rate_list?.length || 0;
  const ongoingMatches = queueInfo?.ongoing || 0;

  return (
    <div className="space-y-6">
      <h2 className="text-xl lg:text-2xl font-bold text-gray-800 mb-4 lg:mb-6">マッチング</h2>
      
      {matchError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">エラー: {matchError}</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* マッチング操作パネル */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">マッチング操作</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium">
                  {isInQueue ? 'マッチング待機中...' : 'マッチング待機'}
                </p>
                <p className="text-sm text-gray-500">
                  {isInQueue ? '対戦相手を探しています' : 'クリックして待機開始'}
                </p>
              </div>
              
              <button
                onClick={handleToggleQueue}
                disabled={matchLoading}
                className={`px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                  isInQueue
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-green-500 text-white hover:bg-green-600'
                }`}
              >
                {matchLoading ? '処理中...' : (isInQueue ? '待機停止' : '待機開始')}
              </button>
            </div>
            
            {isInQueue && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">
                  マッチングが成立するまでお待ちください。
                  通常、数分でマッチングが完了します。
                </p>
              </div>
            )}
          </div>
        </div>
        
        {/* キュー情報 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">キュー情報</h3>
          
          {queueLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500 mx-auto"></div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">待機中のプレイヤー:</span>
                <span className="font-semibold">{waitingPlayers}人</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">進行中の試合:</span>
                <span className="font-semibold">{ongoingMatches}試合</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">予想待機時間:</span>
                <span className="font-semibold">
                  {waitingPlayers < 10 ? `${Math.max(1, 10 - waitingPlayers)} 分` : '1 分'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* レート分布グラフ（簡易版） */}
      {queueInfo?.rate_list && queueInfo.rate_list.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">待機中プレイヤーのレート分布</h3>
          <div className="space-y-2">
            {queueInfo.rate_list.map((rate, index) => (
              <div key={index} className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm text-gray-600">レート: {rate}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const RankingTab: React.FC = () => {
  const { rankings, loading: rankingLoading } = useRanking();

  return (
    <div className="space-y-6">
      <h2 className="text-xl lg:text-2xl font-bold text-gray-800 mb-4 lg:mb-6">ランキング</h2>
      
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">レートランキング</h3>
          <p className="text-sm text-gray-500">上位100位まで表示</p>
        </div>
        
        <div className="p-6">
          {rankingLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500">ランキングデータを読み込み中...</p>
            </div>
          ) : rankings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              ランキングデータがありません
            </div>
          ) : (
            <div className="space-y-2">
              {rankings.map((entry, index) => (
                <div
                  key={entry.user_id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    index < 3 
                      ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200' 
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 
                        ? 'bg-yellow-400 text-yellow-900' 
                        : index === 1 
                        ? 'bg-gray-300 text-gray-700'
                        : index === 2
                        ? 'bg-amber-600 text-amber-100'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {index < 3 ? ['🥇', '🥈', '🥉'][index] : index + 1}
                    </div>
                    
                    <div>
                      <p className="font-medium text-gray-900">
                        {entry.user_id}
                      </p>
                      <p className="text-sm text-gray-500">
                        勝率: {entry.unitemate_winrate}%
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">
                      {entry.rate}
                    </div>
                    <div className="text-sm text-gray-500">
                      レート
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const UnitemateApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('rules');
  const { isAuthenticated, isLoading, user } = useAuth0();
  const { shouldShowUserCreation, loading: isUserLoading } = useUser();

  // ユーザー作成が必要な場合はユーザー作成フォームを表示
  if (isAuthenticated && !isLoading && !isUserLoading && shouldShowUserCreation) {
    const auth0Profile: Auth0UserProfile = {
      sub: user?.sub || "",
      nickname: user?.nickname || "",
      name: user?.name || "",
      picture: user?.picture || "",
      updated_at: user?.updated_at || "",
    };
    
    return <UserCreationForm auth0Profile={auth0Profile} />;
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'rules':
        return <RulesTab />;
      case 'mypage':
        return <MyPageTab />;
      case 'match':
        return <MatchTab />;
      case 'ranking':
        return <RankingTab />;
      default:
        return <RulesTab />;
    }
  };

  if (isLoading || isUserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-200 via-purple-100 to-orange-200">
      {/* ヘッダー */}
      <header className="bg-gradient-to-r from-purple-600 to-purple-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-white">
                <span className="text-orange-400">Unite</span>mate v2
              </h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 lg:py-8">
        {/* スマホ用タブ（横並び） */}
        <div className="lg:hidden mb-4">
          <nav className="flex justify-center space-x-1 bg-white/80 backdrop-blur-md rounded-xl p-1.5 shadow-xl">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center px-3 py-4 rounded-lg transition-all duration-200 min-h-[64px] ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-orange-400 to-orange-500 text-white shadow-lg transform scale-105'
                    : 'text-purple-700 hover:text-purple-900 hover:bg-purple-100'
                }`}
              >
                <span className="text-xl mb-1">{tab.icon}</span>
                <span className="text-xs font-medium leading-tight">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* PC用サイドバー（タブ） */}
          <div className="hidden lg:block lg:col-span-1">
            <nav className="space-y-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-orange-400 to-orange-500 text-white shadow-xl border-l-4 border-orange-300'
                      : 'text-purple-700 hover:bg-white/30 hover:text-purple-900'
                  }`}
                >
                  <span className="mr-3 text-lg">{tab.icon}</span>
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* メインコンテンツ */}
          <div className="lg:col-span-3">
            <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl min-h-[600px] p-4 lg:p-6 border border-white/30">
              {renderTabContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnitemateApp;