import { useState, useRef, useCallback } from "react";

export interface GameMessage {
  type:
    | "GAME_STATE_UPDATE"
    | "POKEMON_SELECT"
    | "DRAFT_RESET"
    | "FIRST_ATTACK_TOGGLE";
  data: unknown;
  timestamp: number;
}

interface P2PConnection {
  peer: RTCPeerConnection;
  channel: RTCDataChannel | null;
  isHost: boolean;
}

export const useP2P = (_roomId: string, isHost: boolean) => {
  const [connection, setConnection] = useState<P2PConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [localOffer, setLocalOffer] = useState<string>("");
  const [localAnswer, setLocalAnswer] = useState<string>("");
  const messageHandlerRef = useRef<((message: GameMessage) => void) | null>(
    null,
  );

  const createPeerConnection = useCallback(() => {
    const servers = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    };
    const peerConnection = new RTCPeerConnection(servers);
    let dataChannel: RTCDataChannel | null = null;

    if (isHost) {
      // ホストが最初にデータチャンネルを作成
      dataChannel = peerConnection.createDataChannel("gameData", {
        ordered: true,
      });

      dataChannel.onopen = () => {
        console.log("Data channel opened (Host)");
        setIsConnected(true);
      };

      dataChannel.onmessage = (event) => {
        try {
          const message: GameMessage = JSON.parse(event.data);
          if (messageHandlerRef.current) {
            messageHandlerRef.current(message);
          }
        } catch (error) {
          console.error("Failed to parse P2P message:", error);
        }
      };

      dataChannel.onclose = () => {
        console.log("Data channel closed (Host)");
        setIsConnected(false);
      };
    } else {
      // ゲストはデータチャンネルを受信する
      peerConnection.ondatachannel = (event) => {
        dataChannel = event.channel;

        dataChannel.onopen = () => {
          console.log("Data channel opened (Guest)");
          setIsConnected(true);
        };

        dataChannel.onmessage = (event) => {
          try {
            const message: GameMessage = JSON.parse(event.data);
            if (messageHandlerRef.current) {
              messageHandlerRef.current(message);
            }
          } catch (error) {
            console.error("Failed to parse P2P message:", error);
          }
        };

        dataChannel.onclose = () => {
          console.log("Data channel closed (Guest)");
          setIsConnected(false);
        };

        setConnection((prev) =>
          prev ? { ...prev, channel: dataChannel } : null,
        );
      };
    }

    peerConnection.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", peerConnection.iceConnectionState);
      if (
        peerConnection.iceConnectionState === "disconnected" ||
        peerConnection.iceConnectionState === "failed"
      ) {
        setIsConnected(false);
      }
    };

    return { peer: peerConnection, channel: dataChannel };
  }, [isHost]);

  // ホスト: オファーを作成
  const createOffer = useCallback(async () => {
    if (!isHost) return;

    try {
      const { peer, channel } = createPeerConnection();
      setConnection({ peer, channel, isHost: true });

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      setLocalOffer(JSON.stringify(offer));
    } catch (error) {
      console.error("Failed to create offer:", error);
    }
  }, [isHost, createPeerConnection]);

  // ゲスト: オファーに対してアンサーを作成
  const createAnswer = useCallback(
    async (offerJson: string) => {
      if (isHost) return;

      try {
        const { peer, channel } = createPeerConnection();
        setConnection({ peer, channel, isHost: false });

        const offer = JSON.parse(offerJson);
        await peer.setRemoteDescription(offer);

        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        setLocalAnswer(JSON.stringify(answer));
      } catch (error) {
        console.error("Failed to create answer:", error);
      }
    },
    [isHost, createPeerConnection],
  );

  // ホスト: アンサーを受け取って接続を確立
  const handleAnswer = useCallback(
    async (answerJson: string) => {
      if (!isHost || !connection) return;

      try {
        const answer = JSON.parse(answerJson);
        await connection.peer.setRemoteDescription(answer);
      } catch (error) {
        console.error("Failed to handle answer:", error);
      }
    },
    [isHost, connection],
  );

  // メッセージ送信
  const sendMessage = useCallback(
    (message: GameMessage) => {
      if (connection?.channel && connection.channel.readyState === "open") {
        connection.channel.send(JSON.stringify(message));
        return true;
      }
      return false;
    },
    [connection],
  );

  // メッセージハンドラーの登録
  const setMessageHandler = useCallback(
    (handler: (message: GameMessage) => void) => {
      messageHandlerRef.current = handler;
    },
    [],
  );

  // 接続終了
  const disconnect = useCallback(() => {
    if (connection) {
      if (connection.channel) {
        connection.channel.close();
      }
      connection.peer.close();
      setConnection(null);
      setIsConnected(false);
    }
  }, [connection]);

  return {
    isConnected,
    localOffer,
    localAnswer,
    createOffer,
    createAnswer,
    handleAnswer,
    sendMessage,
    setMessageHandler,
    disconnect,
  };
};
