import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import Layout from "./components/Layout";
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
      <div className="text-center py-8">
        <h1 className="text-[#333] mb-4 text-[2.5rem] leading-[1.1]">
          Unitemate v2へようこそ
        </h1>
        <p className="text-[#666] text-[1.2rem] mb-8">
          ポケモンユナイト向けの対戦マッチングサービスです。
        </p>

        {!isAuthenticated ? (
          <div className="bg-[#f8f9fa] rounded-xl p-8 mt-8 max-w-[600px] mx-auto">
            <h2 className="text-[#dc2626] mb-4">ゲストとして閲覧中</h2>
            <p className="text-[#4b5563] leading-[1.6]">
              ログインしてマッチング機能をご利用ください。
            </p>
          </div>
        ) : (
          <div className="bg-[#e7f3ff] rounded-xl p-8 mt-8 max-w-[600px] mx-auto">
            <h2 className="text-[#1976d2] mb-4">ログイン済み</h2>
            <p className="text-[#4b5563] leading-[1.6]">
              マッチング機能をご利用いただけます。
            </p>
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
      <Route path="/ranking" element={<div>ランキング画面（未実装）</div>} />
      <Route path="/profile" element={<div>マイページ（未実装）</div>} />
      <Route path="/settings" element={<div>設定画面（未実装）</div>} />
    </Routes>
  );
}

export default App;
