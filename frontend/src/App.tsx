import { useAuth0 } from "@auth0/auth0-react";
import Layout from "./components/Layout";
import { useUser } from "./hooks/useUser";

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
      <div className="text-center py-8">
        <h1 className="text-[#333] mb-4 text-[2.5rem] leading-[1.1]">
          Unitemate v2へようこそ
        </h1>
        <p className="text-[#666] text-[1.2rem] mb-8">
          ポケモンユナイト向けの対戦マッチングサービスです。
        </p>

        {userDataError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 max-w-2xl mx-auto">
            <p className="text-red-700">
              ユーザー情報の取得に失敗しました: {userDataError}
            </p>
          </div>
        )}

        {user ? (
          <div className="bg-[#f8f9fa] rounded-xl p-8 mt-8 max-w-[600px] mx-auto">
            <h2 className="text-[#2563eb] mb-4">
              ようこそ、{user.username}さん！
            </h2>
            {userData && (
              <div className="space-y-2 mb-4">
                <p className="text-[#4b5563] leading-[1.6]">
                  レート: {userData.rate ?? 0}
                </p>
                <p className="text-[#4b5563] leading-[1.6]">
                  試合数: {userData.match_count ?? 0}
                </p>
                <p className="text-[#4b5563] leading-[1.6]">
                  勝利数: {userData.win_count ?? 0}
                </p>
                <p className="text-[#4b5563] leading-[1.6]">
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
            <p className="text-[#4b5563] leading-[1.6]">
              マッチングを開始して、あなたにぴったりの対戦相手を見つけましょう。
            </p>
          </div>
        ) : (
          <div className="bg-[#f8f9fa] rounded-xl p-8 mt-8 max-w-[600px] mx-auto">
            <h2 className="text-[#dc2626] mb-4">ゲストとして閲覧中</h2>
            <p className="text-[#4b5563] leading-[1.6]">
              ログインしてマッチング機能をご利用ください。
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default App;
