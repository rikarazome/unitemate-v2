import { useState, useEffect } from "react";

interface DummyUser {
  user_id: string;
  trainer_name: string;
  discord_username: string;
  rate: number;
  preferred_role: string;
  is_dummy: boolean;
}

interface DummyAuthState {
  isAuthenticated: boolean;
  user: DummyUser | null;
  accessToken: string | null;
  login: (accessToken: string, userInfo: DummyUser) => void;
  loginAsUser: (userId: string) => void;
  logout: () => void;
}

const DUMMY_TOKEN_KEY = "dummy_access_token";
const DUMMY_USER_KEY = "dummy_user_info";

export const useDummyAuth = (): DummyAuthState => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<DummyUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // 初期化時にローカルストレージからダミー認証情報を復元
  useEffect(() => {
    const storedToken = localStorage.getItem(DUMMY_TOKEN_KEY);
    const storedUser = localStorage.getItem(DUMMY_USER_KEY);

    console.log("useDummyAuth.init - storedToken exists:", !!storedToken);
    console.log("useDummyAuth.init - storedUser exists:", !!storedUser);

    if (storedToken && storedUser) {
      try {
        const userData = JSON.parse(storedUser);

        // JWTの有効期限をチェック（簡易版）
        const payload = JSON.parse(atob(storedToken.split(".")[1]));
        const now = Math.floor(Date.now() / 1000);

        console.log(
          "useDummyAuth.init - token exp:",
          payload.exp,
          "now:",
          now,
          "valid:",
          payload.exp > now,
        );

        if (payload.exp > now) {
          console.log(
            "useDummyAuth.init - Restoring dummy auth with token:",
            storedToken.substring(0, 50) + "...",
          );
          setAccessToken(storedToken);
          setUser(userData);
          setIsAuthenticated(true);
        } else {
          // トークンが期限切れの場合はクリア
          console.log("useDummyAuth.init - Token expired, clearing");
          localStorage.removeItem(DUMMY_TOKEN_KEY);
          localStorage.removeItem(DUMMY_USER_KEY);
        }
      } catch (error) {
        console.error("Failed to restore dummy auth state:", error);
        localStorage.removeItem(DUMMY_TOKEN_KEY);
        localStorage.removeItem(DUMMY_USER_KEY);
      }
    }
  }, []);

  const login = (token: string, userInfo: DummyUser) => {
    console.log("useDummyAuth.login - token:", token.substring(0, 50) + "...");
    console.log("useDummyAuth.login - userInfo:", userInfo);

    setAccessToken(token);
    setUser(userInfo);
    setIsAuthenticated(true);

    // ローカルストレージに保存
    localStorage.setItem(DUMMY_TOKEN_KEY, token);
    localStorage.setItem(DUMMY_USER_KEY, JSON.stringify(userInfo));
  };

  const logout = () => {
    setAccessToken(null);
    setUser(null);
    setIsAuthenticated(false);

    // ローカルストレージからクリア
    localStorage.removeItem(DUMMY_TOKEN_KEY);
    localStorage.removeItem(DUMMY_USER_KEY);
  };

  const loginAsUser = (userId: string) => {
    // ダミーユーザー用のJWTトークンを生成
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 24 * 60 * 60; // 24時間後に期限切れ

    const header = { alg: "HS256", typ: "JWT" };
    const payload = {
      sub: `dummy|discord|${userId}`,
      user_id: `dummy|discord|${userId}`,
      aud: "unitemate-v2-api",
      iss: "dummy-auth-for-testing",
      iat: now,
      exp: exp,
      discord_id: userId,
      is_dummy: true,
    };

    // 簡易的なJWT生成（開発用）
    const dummyToken =
      btoa(JSON.stringify(header)) +
      "." +
      btoa(JSON.stringify(payload)) +
      "." +
      "dummy-signature";

    // ダミーユーザー情報
    const dummyUserData: DummyUser = {
      user_id: userId,
      trainer_name: userId,
      discord_username: userId,
      rate: userId === "rikarazome" ? 1800 : 1500,
      preferred_role: "ALL_ROUNDER",
      is_dummy: true,
    };

    console.log(
      "loginAsUser - userId:",
      userId,
      "token:",
      dummyToken.substring(0, 50) + "...",
    );

    login(dummyToken, dummyUserData);
  };

  return {
    isAuthenticated,
    user,
    accessToken,
    login,
    loginAsUser,
    logout,
  };
};
