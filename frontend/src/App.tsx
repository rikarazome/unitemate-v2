import { useAuth0 } from "@auth0/auth0-react";
import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import MyPage from "./components/MyPage";
import RankingPage from "./components/RankingPage";
import UserCreationForm from "./components/UserCreationForm";
import { useUser } from "./hooks/useUser";
import type { Auth0UserProfile } from "./types/user";

function HomePage() {
  const { loginWithRedirect, logout, isAuthenticated, isLoading } = useAuth0();
  const {
    userData: appUser,
    shouldShowUserCreation,
    loading: isUserLoading,
  } = useUser();
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);

  const handleLogin = () => {
    loginWithRedirect();
  };

  const handleLogout = () => {
    logout({ logoutParams: { returnTo: window.location.origin } });
  };

  // If user needs to be created, redirect to user creation form
  if (
    isAuthenticated &&
    !isLoading &&
    !isUserLoading &&
    shouldShowUserCreation
  ) {
    return <Navigate to="/create-user" replace />;
  }

  // AppのUserをLayoutのUser形式に変換
  const layoutUser = appUser
    ? {
        id: appUser.user_id,
        username: appUser.discord_username,
        avatar: appUser.discord_avatar_url,
      }
    : undefined;

  return (
    <Layout user={layoutUser} onLogin={handleLogin} onLogout={handleLogout}>
      <div className="relative">
        {/* メイン画像セクション */}
        <div className="relative">
          <img
            src="/pokemon-battle.png"
            alt="ポケモンバトル"
            className="w-full h-[600px] object-cover"
          />

          {/* オーバーレイ */}
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <div className="text-center text-white">
              <h1 className="text-5xl font-bold mb-6 drop-shadow-lg">
                ユナメイト
              </h1>
              <p className="text-xl mb-8 drop-shadow-lg">
                ポケモンユナイト向けの対戦マッチングサービス
              </p>

              {/* ボタン */}
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => setShowAboutModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-lg"
                >
                  ユナメイトとは
                </button>
                <button
                  onClick={() => setShowRulesModal(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-lg"
                >
                  ユナメイトのルール
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 「ユナメイトとは」モーダル */}
        {showAboutModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">
                ユナメイトとは
              </h2>
              <div className="text-gray-600 space-y-4 text-sm leading-relaxed">
                <p>
                  ユナメイトは、有志によって制作、運営されている、ポケモンユナイトのドラフトピック形式のランクマッチシステムです。
                </p>
                <p>
                  ユナメイト設立当初は、公式大会で使われるドラフトピックルールを遊べる場所が限られていたため、ユナメイトは初心者もふくめ誰でも歓迎を謡っていました。
                  それから二年ほど経ち、ランクマッチのシステムや環境が改善傾向にある今、ユナメイトが今新たに目指すべきところはベテランとビギナーの棲み分けです。
                </p>
                <p>
                  現在、このゲームはリリースから三年半が経ち、歴の浅いプレイヤーから長いプレイヤーまで様々な人が遊んでいます。
                  プレイ歴の差は環境理解、マクロやセオリーの知識など、ベテランとビギナーの間に大きな差を生み、その差はチーム内で軋轢を生んでしまうものとなっているのが現状です。
                  ベテランとビギナーは大抵の場合、双方とも互いにマッチすることを望んでいません。
                </p>
                <p>
                  そのためユナメイトでは今後、マスターランクの一つ上のランクを疑似的に再現すること目標に掲げます。
                </p>
                <p>
                  これを実現するために、公式のレート1600で貰えるシールを持っているかどうかを基準に、プレイヤーが相応の実力を持っているかどうかを判断して、参加基準といたします。
                  さらに今後、公式ランクマッチのシーズン27以降においては、直近4シーズン以内のシールがあることを条件とし、更にベテランプレイヤーのみが参加を許される形に制限する予定です。
                </p>
                <p>
                  公式レート1600に一度も到達したことがないプレイヤーは、ユナメイトを始める前に、ランクマッチで腕を磨いてから参加してください。
                </p>
                <p className="font-semibold">
                  今後ともユナメイトをよろしくお願いいたします。
                </p>
              </div>
              <button
                onClick={() => setShowAboutModal(false)}
                className="mt-6 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        )}

        {/* 「ユナメイトのルール」モーダル */}
        {showRulesModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">
                ユナメイトのルール
              </h2>
              <div className="text-gray-600 space-y-4">
                <p>
                  現在のシーズン6はVC有りルールのため、全員Discordサーバーへの参加が必要です。
                </p>
                <p>
                  サーバー内のルールチャンネルに最新版のルールを記載しているので、そちらをご確認ください。
                </p>
              </div>
              <button
                onClick={() => setShowRulesModal(false)}
                className="mt-6 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

function CreateUserPage() {
  const { user, isAuthenticated, isLoading } = useAuth0();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        読み込み中...
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/" replace />;
  }

  const auth0Profile: Auth0UserProfile = {
    sub: user.sub || "",
    nickname: user.nickname || "",
    name: user.name || "",
    picture: user.picture || "",
    updated_at: user.updated_at || "",
  };

  return <UserCreationForm auth0Profile={auth0Profile} />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/create-user" element={<CreateUserPage />} />
      <Route path="/match" element={<div>マッチング画面（未実装）</div>} />
      <Route path="/ranking" element={<RankingPage />} />
      <Route path="/profile" element={<MyPage />} />
    </Routes>
  );
}

export default App;
