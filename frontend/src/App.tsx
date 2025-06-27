import { useAuth0 } from "@auth0/auth0-react";
import Layout from "./components/Layout";
import { useUser } from "./hooks/useUser";
import "./App.css";

interface User {
  id: string;
  username: string;
  avatar?: string;
}

function App() {
  const {
    user: auth0User,
    isAuthenticated,
    loginWithRedirect,
    logout,
    isLoading,
  } = useAuth0();
  const {
    userData,
    loading: userDataLoading,
    error: userDataError,
  } = useUser();

  if (isLoading || userDataLoading) {
    return <div>Loading...</div>;
  }

  const user: User | undefined =
    isAuthenticated && auth0User
      ? {
          id: userData?.user_id || auth0User.sub || "",
          username:
            userData?.discord_username ||
            auth0User.nickname ||
            auth0User.name ||
            "Unknown User",
          avatar: userData?.discord_avatar_url || auth0User.picture,
        }
      : undefined;

  const handleLogin = () => {
    loginWithRedirect({
      authorizationParams: {
        connection: "discord",
      },
    });
  };

  const handleLogout = () => {
    logout({ logoutParams: { returnTo: window.location.origin } });
  };

  return (
    <Layout user={user} onLogin={handleLogin} onLogout={handleLogout}>
      <div className="welcome-section">
        <h1>Unitemate v2へようこそ</h1>
        <p>ポケモンユナイト向けの対戦マッチングサービスです。</p>

        {userDataError && (
          <div className="error-message">
            <p>ユーザー情報の取得に失敗しました: {userDataError}</p>
          </div>
        )}

        {user ? (
          <div className="user-welcome">
            <h2>ようこそ、{user.username}さん！</h2>
            {userData && (
              <div className="user-stats">
                <p>レート: {userData.rate ?? 0}</p>
                <p>試合数: {userData.match_count ?? 0}</p>
                <p>勝利数: {userData.win_count ?? 0}</p>
                <p>
                  勝率:{" "}
                  {typeof userData.match_count === "number" &&
                  typeof userData.win_count === "number" &&
                  userData.match_count > 0
                    ? Math.round(
                        (userData.win_count / userData.match_count) * 100,
                      )
                    : 0}
                  %
                </p>
              </div>
            )}
            <p>
              マッチングを開始して、あなたにぴったりの対戦相手を見つけましょう。
            </p>
          </div>
        ) : (
          <div className="guest-welcome">
            <h2>ゲストとして閲覧中</h2>
            <p>ログインしてマッチング機能をご利用ください。</p>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default App;
