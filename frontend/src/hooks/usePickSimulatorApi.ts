// BANPICKシミュレーター専用APIフック
// ※このファイルはツール専用です - メインアプリの機能とは完全に独立※

import { useCallback } from "react";

interface PickSimulatorRoom {
  room_id: string;
  host_offer: string;
  guest_answer: string;
  created_at: number;
  ttl: number;
  tool_type: string;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

export const usePickSimulatorApi = () => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

  const callApi = useCallback(
    async <T>(
      endpoint: string,
      config: {
        method?: string;
        headers?: Record<string, string>;
        body?: unknown;
      } = {}
    ): Promise<ApiResponse<T>> => {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...config.headers,
        };

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
          method: config.method || "GET",
          headers,
          body: config.body ? JSON.stringify(config.body) : undefined,
        });

        const data = await response.json();

        return {
          data: data,
          error: response.ok ? undefined : data.error || "Unknown error",
          status: response.status,
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "Network error",
          status: 0,
        };
      }
    },
    [API_BASE_URL]
  );

  // BANPICKシミュレーター用ルーム作成
  const createRoom = useCallback(
    async (roomId: string, hostOffer?: string): Promise<ApiResponse<{ room_id: string; message: string }>> => {
      return callApi("/api/tools/banpick/rooms", {
        method: "POST",
        body: {
          room_id: roomId,
          host_offer: hostOffer || ""
        }
      });
    },
    [callApi]
  );

  // BANPICKシミュレーター用ルーム存在確認
  const checkRoom = useCallback(
    async (roomId: string): Promise<ApiResponse<{ exists: boolean; room?: PickSimulatorRoom }>> => {
      return callApi(`/api/tools/banpick/rooms/${roomId}/check`);
    },
    [callApi]
  );

  // BANPICKシミュレーター用ルームデータ取得
  const getRoomData = useCallback(
    async (roomId: string): Promise<ApiResponse<PickSimulatorRoom>> => {
      return callApi(`/api/tools/banpick/rooms/${roomId}`);
    },
    [callApi]
  );

  // BANPICKシミュレーター用ホストオファー更新
  const updateRoomOffer = useCallback(
    async (roomId: string, hostOffer: string): Promise<ApiResponse<{ message: string }>> => {
      return callApi(`/api/tools/banpick/rooms/${roomId}/offer`, {
        method: "PUT",
        body: { host_offer: hostOffer }
      });
    },
    [callApi]
  );

  // BANPICKシミュレーター用ゲストアンサー更新
  const updateRoomAnswer = useCallback(
    async (roomId: string, guestAnswer: string): Promise<ApiResponse<{ message: string }>> => {
      return callApi(`/api/tools/banpick/rooms/${roomId}/answer`, {
        method: "PUT",
        body: { guest_answer: guestAnswer }
      });
    },
    [callApi]
  );

  return {
    createRoom,
    checkRoom,
    getRoomData,
    updateRoomOffer,
    updateRoomAnswer,
  };
};