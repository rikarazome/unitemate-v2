/**
 * ProfileStoreの初期化・クリーンアップロジック
 * UnitemateAppから呼び出して、ストアのライフサイクルを管理
 */

import { useEffect, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useDummyAuth } from './useDummyAuth';
import { useApi } from './useApi';
import { useProfileStore } from './useProfileStore';

export const useProfileStoreInit = () => {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const dummyAuth = useDummyAuth();
  const { callApi } = useApi();

  const fetchUserData = useProfileStore((state) => state.fetchUserData);
  const clearStore = useProfileStore((state) => state.clearStore);
  const initializeAttempted = useProfileStore((state) => state.initializeAttempted);
  const setInitializeAttempted = useProfileStore((state) => state.setInitializeAttempted);

  const isAuthenticatedRef = useRef(false);

  // 認証状態の初期化
  useEffect(() => {
    const authenticated = isAuthenticated || dummyAuth.isAuthenticated;

    if (authenticated && !initializeAttempted) {
      setInitializeAttempted(true);
      isAuthenticatedRef.current = true;

      // トークン取得関数を準備
      const getToken = async () => {
        if (dummyAuth.isAuthenticated && dummyAuth.accessToken) {
          return dummyAuth.accessToken;
        }
        return await getAccessTokenSilently();
      };

      // 初回データ取得
      fetchUserData(false, getToken, callApi);
    }

    // ログアウト時のクリーンアップ
    if (!authenticated && isAuthenticatedRef.current) {
      clearStore();
      isAuthenticatedRef.current = false;
      setInitializeAttempted(false);
    }
  }, [
    isAuthenticated,
    dummyAuth.isAuthenticated,
    dummyAuth.accessToken,
    initializeAttempted,
    fetchUserData,
    clearStore,
    setInitializeAttempted,
    getAccessTokenSilently,
    callApi,
  ]);
};
