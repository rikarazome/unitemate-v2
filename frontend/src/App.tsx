import { useState } from "react";
import Layout from "./components/Layout";
import "./App.css";

interface User {
  id: string;
  username: string;
  avatar?: string;
}

function App() {
  const [user, setUser] = useState<User | undefined>();

  const handleLogin = () => {
    setUser({
      id: "demo-user",
      username: "デモユーザー",
      avatar: "/demo-avatar.png"
    });
  };

  const handleLogout = () => {
    setUser(undefined);
  };

  return (
    <Layout user={user} onLogin={handleLogin} onLogout={handleLogout}>
      <div className="welcome-section">
        <h1>Unitemate v2へようこそ</h1>
        <p>ポケモンユナイト向けの対戦マッチングサービスです。</p>
        
        {user ? (
          <div className="user-welcome">
            <h2>ようこそ、{user.username}さん！</h2>
            <p>マッチングを開始して、あなたにぴったりの対戦相手を見つけましょう。</p>
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
