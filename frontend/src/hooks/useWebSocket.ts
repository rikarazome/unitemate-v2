import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useDummyAuth } from "./useDummyAuth";

// WebSocket接続の状態
export const WebSocketReadyState = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
} as const;

// 動的データの型定義
interface MatchDynamicData {
  lobby_id?: string;
  host_user_id?: string;
  report_count: number;
  status?: "matched" | "done";
}

interface WebSocketMessage {
  action: 'updateQueue' | 'updateQueueInfo' | 'updateStatus' | 'match_found' | 'match_cancelled' | 'user_update' | 'pong';
  type?: 'subscribeMatchSuccess' | 'subscribeMatchError' | 'unsubscribeMatchSuccess' | 'matchUpdate';
  matchId?: string;
  dynamicData?: MatchDynamicData;
  updateType?: 'lobby_id_updated' | 'host_changed' | 'match_reported' | 'match_completed';
  error?: string;
  data?: unknown;
  body?: string;
  timestamp?: number;
}

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onQueueUpdate?: (queueData: unknown) => void;
  onQueueInfoUpdate?: (queueInfoData: unknown) => void;
  onStatusUpdate?: (statusData: unknown) => void;
  onMatchFound?: (matchData: unknown) => void;
  onMatchUpdate?: (dynamicData: MatchDynamicData, updateType?: string) => void;
  onMatchSubscribed?: (dynamicData: MatchDynamicData) => void;
  onMatchError?: (error: string) => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const {
    onMessage,
    onQueueUpdate,
    onQueueInfoUpdate,
    onStatusUpdate,
    onMatchFound,
    onMatchUpdate,
    onMatchSubscribed,
    onMatchError,
    reconnectAttempts = 5,
    reconnectInterval = 3000,
  } = options;

  const { user, isAuthenticated } = useAuth0();
  const dummyAuth = useDummyAuth();
  const [readyState, setReadyState] = useState<
    (typeof WebSocketReadyState)[keyof typeof WebSocketReadyState]
  >(WebSocketReadyState.CLOSED);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subscribedMatchId, setSubscribedMatchId] = useState<string | null>(null);
  const [matchDynamicData, setMatchDynamicData] = useState<MatchDynamicData | null>(null);

  const ws = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const reconnectTimeoutId = useRef<number | null>(null);
  const isConnecting = useRef(false); // 接続中フラグ追加
  const shouldReconnect = useRef(true); // 再接続を制御するフラグ
  const pingInterval = useRef<number | null>(null); // ping用インターバル
  const askQueueInterval = useRef<number | null>(null); // キュー情報問い合わせ用インターバル

  // WebSocket URL - 環境変数から取得、未設定の場合はWebSocketを無効化
  const wsUrl = import.meta.env.VITE_WEBSOCKET_URL || "";

  // ユーザーIDを取得（Legacyと同じ方式）
  const getUserId = useCallback(() => {
    if (dummyAuth.isAuthenticated && dummyAuth.user?.original_user_id) {
      return dummyAuth.user.original_user_id;
    }
    if (isAuthenticated && user?.sub) {
      // Discord IDを抽出 (oauth2|discord|123456789 → 123456789)
      const match = user.sub.match(/^oauth2\|discord\|(.+)$/);
      return match ? match[1] : user.sub;
    }
    return null;
  }, [isAuthenticated, dummyAuth.isAuthenticated, user?.sub, dummyAuth.user?.original_user_id]);

  const connect = useCallback(async () => {
    // WebSocket URLが設定されていない場合はスキップ
    if (!wsUrl) {
      console.log("[WebSocket] WebSocket URL not configured, skipping connection");
      return;
    }

    const userId = getUserId();
    if (!userId) {
      return;
    }

    // 既に接続中または接続済みの場合はスキップ
    if (isConnecting.current || 
        ws.current?.readyState === WebSocket.OPEN || 
        ws.current?.readyState === WebSocket.CONNECTING) {
      console.log("[WebSocket] Connection already exists, skipping connection attempt");
      return;
    }

    try {
      isConnecting.current = true;
      setError(null);

      // Legacyと同じ方式：user_idをクエリパラメータで送信
      const websocketUrl = `${wsUrl}?user_id=${userId}`;
      console.log("[WebSocket] Attempting connection to:", websocketUrl);
      const websocket = new WebSocket(websocketUrl);
      ws.current = websocket;

      websocket.onopen = () => {
        console.log("[WebSocket] Connected", { userId });
        setReadyState(WebSocketReadyState.OPEN);
        reconnectCount.current = 0;
        shouldReconnect.current = true;
        isConnecting.current = false;

        // 接続直後に即座に askQueueInfo を送信（Legacyと同様）
        if (websocket.readyState === WebSocket.OPEN) {
          websocket.send(JSON.stringify({ action: "askQueueInfo" }));
          console.log("[WebSocket] Immediate askQueueInfo sent");
        }

        // 再接続時に以前のsubscriptionを復元
        if (subscribedMatchId) {
          console.log("[WebSocket] Restoring match subscription after reconnection:", subscribedMatchId);
          websocket.send(JSON.stringify({
            action: "subscribeMatch",
            matchId: subscribedMatchId
          }));
        }

        // Ping メッセージを送信（60秒ごと）
        pingInterval.current = setInterval(() => {
          if (websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify({ action: "ping" }));
            console.log("[WebSocket] Ping sent");
          }
        }, 60000) as unknown as number;

        // 5秒ごとにキュー情報問い合わせを送信（Legacyと同様）
        askQueueInterval.current = setInterval(() => {
          if (websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify({ action: "askQueueInfo" }));
            console.log("[WebSocket] askQueueInfo sent");
          }
        }, 5000) as unknown as number;
      };

      websocket.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);

          // カスタムハンドラーを呼び出し
          onMessage?.(message);

          // 試合購読メッセージの処理
          if (message.type) {
            switch (message.type) {
              case "subscribeMatchSuccess":
                console.log("[WebSocket] Match subscription successful:", message.matchId);
                if (message.dynamicData) {
                  setMatchDynamicData(message.dynamicData);
                  onMatchSubscribed?.(message.dynamicData);
                }
                break;
              case "subscribeMatchError":
                console.log("[WebSocket] Match subscription error:", message.error);
                onMatchError?.(message.error || "Subscription failed");
                break;
              case "unsubscribeMatchSuccess":
                console.log("[WebSocket] Match unsubscription successful:", message.matchId);
                if (message.matchId === subscribedMatchId) {
                  setMatchDynamicData(null);
                  setSubscribedMatchId(null);
                }
                break;
              case "matchUpdate":
                console.log("[WebSocket] Match dynamic update received:", message.matchId, message.updateType);
                if (message.dynamicData) {
                  setMatchDynamicData(message.dynamicData);
                  onMatchUpdate?.(message.dynamicData, message.updateType);
                }
                break;
            }
          }

          // Legacyと同じアクション処理
          switch (message.action) {
            case "updateQueue":
              console.log("[WebSocket] Queue update received");
              onQueueUpdate?.(message.data);
              break;
            case "updateQueueInfo":
              console.log("[WebSocket] updateQueueInfo received:", message.body);
              try {
                if (message.body) {
                  const data = JSON.parse(message.body);
                  onQueueInfoUpdate?.(data);
                }
              } catch (err) {
                console.error("[WebSocket] Error parsing updateQueueInfo body:", err);
              }
              break;
            case "updateStatus":
              console.log("[WebSocket] Status update received");
              onStatusUpdate?.(message.data);
              break;
            case "match_found":
              console.log("[WebSocket] Match found:", message.data);
              onMatchFound?.(message.data);
              break;
            case "pong":
              console.log("[WebSocket] Pong received");
              break;
            default:
              console.log("[WebSocket] Unknown action:", message.action);
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      websocket.onclose = (event) => {
        console.log("WebSocket disconnected:", event.code, event.reason);
        setReadyState(WebSocketReadyState.CLOSED);
        ws.current = null;
        isConnecting.current = false;

        // タイマーをクリア（Legacyと同様）
        if (pingInterval.current) {
          clearInterval(pingInterval.current);
          pingInterval.current = null;
        }
        if (askQueueInterval.current) {
          clearInterval(askQueueInterval.current);
          askQueueInterval.current = null;
        }

        // 自動再接続（最大試行回数まで）
        if (reconnectCount.current < reconnectAttempts && !event.wasClean && shouldReconnect.current) {
          reconnectCount.current++;
          console.log(
            `Attempting to reconnect... (${reconnectCount.current}/${reconnectAttempts})`,
          );

          // 既存のタイムアウトをクリア
          if (reconnectTimeoutId.current) {
            clearTimeout(reconnectTimeoutId.current);
          }

          reconnectTimeoutId.current = setTimeout(() => {
            if (getUserId() && shouldReconnect.current) { // ユーザーIDが存在し、再接続が許可されている場合のみ再接続
              connect();
            }
          }, reconnectInterval) as unknown as number;
        } else if (reconnectCount.current >= reconnectAttempts) {
          console.log("[WebSocket] Max reconnection attempts reached");
          shouldReconnect.current = false; // 再接続を停止
          setError("WebSocket connection failed after maximum attempts");
        }
      };

      websocket.onerror = (event) => {
        console.error("WebSocket error:", event);
        setError("WebSocket connection error");
        // onerrorの後は必ずoncloseが呼ばれるので、ここでは再接続処理をしない
      };

      setReadyState(WebSocketReadyState.CONNECTING);
    } catch (err) {
      console.error("Failed to connect WebSocket:", err);
      setError(err instanceof Error ? err.message : "Failed to connect");
      isConnecting.current = false;
    }
  }, [
    wsUrl,
    reconnectAttempts,
    reconnectInterval,
  ]);

  const disconnect = useCallback(() => {
    shouldReconnect.current = false; // 再接続を停止
    
    // すべてのタイマーをクリア
    if (reconnectTimeoutId.current) {
      clearTimeout(reconnectTimeoutId.current);
      reconnectTimeoutId.current = null;
    }
    if (pingInterval.current) {
      clearInterval(pingInterval.current);
      pingInterval.current = null;
    }
    if (askQueueInterval.current) {
      clearInterval(askQueueInterval.current);
      askQueueInterval.current = null;
    }

    if (ws.current) {
      ws.current.close(1000, "Disconnect requested");
      ws.current = null;
    }
    setReadyState(WebSocketReadyState.CLOSED);
  }, []);

  const sendMessage = useCallback(
    (message: WebSocketMessage) => {
      if (ws.current && readyState === WebSocketReadyState.OPEN) {
        ws.current.send(JSON.stringify(message));
        return true;
      }
      return false;
    },
    [readyState],
  );

  // 試合購読を開始
  const subscribeMatch = useCallback(
    (matchId: string) => {
      // 既に同じ試合を購読している場合はスキップ
      if (subscribedMatchId === matchId) {
        console.log("[WebSocket] Already subscribed to match:", matchId);
        return true;
      }

      if (!ws.current || readyState !== WebSocketReadyState.OPEN) {
        console.warn("[WebSocket] Cannot subscribe to match: WebSocket not connected. Setting pending subscription.");
        // 接続していない場合は購読IDを記録し、接続時に自動的に購読
        setSubscribedMatchId(matchId);
        return false;
      }

      console.log("[WebSocket] Subscribing to match:", matchId);
      ws.current.send(JSON.stringify({
        action: "subscribeMatch",
        matchId
      }));
      setSubscribedMatchId(matchId);
      return true;
    },
    [readyState, subscribedMatchId]
  );

  // 試合購読を解除
  const unsubscribeMatch = useCallback(() => {
    const currentMatchId = subscribedMatchId;
    
    if (!currentMatchId) {
      console.log("[WebSocket] No subscription to unsubscribe from");
      return false;
    }

    // 購読IDをクリア（WebSocketが切断されていても状態をクリア）
    setSubscribedMatchId(null);
    setMatchDynamicData(null);

    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      console.log("[WebSocket] Unsubscribing from match:", currentMatchId);
      ws.current.send(JSON.stringify({
        action: "unsubscribeMatch",
        matchId: currentMatchId
      }));
    } else {
      console.log("[WebSocket] WebSocket not connected, but cleared subscription state for match:", currentMatchId);
    }
    
    return true;
  }, [subscribedMatchId]);

  // 自動接続・切断
  useEffect(() => {
    const userId = getUserId();
    if (userId && wsUrl) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [isAuthenticated, dummyAuth.isAuthenticated, wsUrl, connect, disconnect]);

  return {
    readyState,
    lastMessage,
    error,
    sendMessage,
    connect,
    disconnect,
    subscribeMatch,
    unsubscribeMatch,
    subscribedMatchId,
    matchDynamicData,
    isConnected: readyState === WebSocketReadyState.OPEN,
  };
};

// キュー更新専用のフック
export const useQueueWebSocket = () => {
  const [queueData, setQueueData] = useState<unknown>(null);
  const [queueInfoData, setQueueInfoData] = useState<unknown>(null);
  const [statusData, setStatusData] = useState<unknown>(null);
  const [matchData, setMatchData] = useState<unknown>(null);

  const websocket = useWebSocket({
    onQueueUpdate: (data) => {
      setQueueData(data);
    },
    onQueueInfoUpdate: (data) => {
      setQueueInfoData(data);
    },
    onStatusUpdate: (data) => {
      setStatusData(data);
    },
    onMatchFound: (data) => {
      setMatchData(data);
    },
  });

  return {
    ...websocket,
    queueData,
    queueInfoData,
    statusData,
    matchData,
    clearMatchData: () => setMatchData(null),
  };
};
