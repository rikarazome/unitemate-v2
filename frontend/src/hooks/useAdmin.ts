import { useMemo } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useUser } from "./useUser";
// import { useDummyAuth } from './useDummyAuth'; // セキュリティ上の理由で未使用

/**
 * 管理者権限チェックのフック
 */
export const useAdmin = () => {
  const { userData, loading: userLoading } = useUser();
  const { isLoading: auth0Loading, isAuthenticated } = useAuth0();
  // const dummyAuth = useDummyAuth(); // セキュリティ上の理由で未使用

  // 管理者かどうかの判定
  const isAdmin = useMemo(() => {
    // Auth0認証のユーザーデータのisAdminフィールドでのみ判定
    // セキュリティ上、ダミーAuthでは管理者権限を付与しない
    return userData?.is_admin || false;
  }, [userData?.is_admin]);

  // ログイン状態の確認
  const isLoggedIn = useMemo(() => {
    // Auth0認証のみを管理者判定に使用
    return !!userData;
  }, [userData]);

  // 全体的なローディング状態
  const isLoading = useMemo(() => {
    // Auth0のローディング中、またはユーザーデータのローディング中
    // さらに、Auth0認証済みなのにuserDataがまだない場合もローディング中とみなす
    const isWaitingForUserData =
      isAuthenticated && !auth0Loading && !userData && !userLoading;

    return auth0Loading || userLoading || isWaitingForUserData;
  }, [auth0Loading, userLoading, userData, isAuthenticated]);

  return {
    isAdmin,
    isLoggedIn,
    currentUserId: userData?.user_id,
    isLoading,
  };
};
