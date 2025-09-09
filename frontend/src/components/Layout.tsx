import React from "react";
import { Header } from "./Header";
import { useUser } from "../hooks/useUser";
import { useDummyAuth } from "../hooks/useDummyAuth";
import { useAuth0 } from "@auth0/auth0-react";

interface LayoutProps {
  children: React.ReactNode;
  className?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, className = "" }) => {
  // 認証状態
  const { userData } = useUser();
  const dummyAuth = useDummyAuth();
  const {
    loginWithRedirect,
    logout,
    isAuthenticated,
    user: auth0User,
  } = useAuth0();

  // 統合されたユーザー情報
  const currentUser = dummyAuth.isAuthenticated
    ? {
        id: dummyAuth.user?.user_id || "",
        username: dummyAuth.user?.trainer_name || "Unknown",
        avatar: undefined,
      }
    : userData
      ? {
          id: userData.user_id,
          username:
            userData.trainer_name || userData.discord_username || "Unknown",
          avatar: auth0User?.picture,
        }
      : null;

  const handleLogin = () => {
    if (!isAuthenticated) {
      loginWithRedirect({
        authorizationParams: {
          connection: "discord",
        },
      });
    }
  };

  const handleLogout = () => {
    if (dummyAuth.isAuthenticated) {
      dummyAuth.logout();
    } else if (isAuthenticated) {
      logout({ logoutParams: { returnTo: window.location.origin } });
    }
  };

  return (
    <div className={`min-h-screen ${className}`}>
      <Header
        user={currentUser || undefined}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />
      <div className="flex-1">{children}</div>
    </div>
  );
};

export default Layout;
