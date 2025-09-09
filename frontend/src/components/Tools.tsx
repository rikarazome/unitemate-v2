// BANPICKシミュレーターツール - メインアプリとは独立したツール機能
import React, { useState, useEffect, useCallback, useMemo } from "react";
import Layout from "./Layout";
import PokemonPickerPopup from "./PokemonPickerPopup";
import { useP2P } from "../hooks/useP2P";
import { usePickSimulatorApi } from "../hooks/usePickSimulatorApi"; // ツール専用API
import type { GameMessage } from "../hooks/useP2P";

interface Pokemon {
  id: string;
  name: string;
  role: string;
  tier: string;
  imageUrl?: string;
}

type Phase = "ban1" | "ban2" | "pick" | "completed";
type Team = "first" | "second"; // 先攻・後攻
type GameState = "lobby" | "draft" | "completed";

interface Room {
  id: string;
  hostName: string;
  guestName?: string;
  isHost: boolean;
}

interface P2PState {
  isConnecting: boolean;
  showConnectionModal: boolean;
}

const Tools: React.FC = () => {
  // ゲーム状態
  const [gameState, setGameState] = useState<GameState>("lobby");
  const [room, setRoom] = useState<Room | null>(null);
  const [roomId, setRoomId] = useState<string>("");
  const [firstAttack, setFirstAttack] = useState<"first" | "second">("first"); // 先攻チーム

  // ドラフト状態
  const [currentPhase, setCurrentPhase] = useState<Phase>("ban1");
  const [currentTurn, setCurrentTurn] = useState<Team>("first");
  const [stepCounter, setStepCounter] = useState<number>(0);
  const [firstTeamBans, setFirstTeamBans] = useState<Pokemon[]>([]);
  const [secondTeamBans, setSecondTeamBans] = useState<Pokemon[]>([]);
  const [firstTeamPicks, setFirstTeamPicks] = useState<Pokemon[]>([]);
  const [secondTeamPicks, setSecondTeamPicks] = useState<Pokemon[]>([]);
  const [bannedPokemon, setBannedPokemon] = useState<Set<string>>(new Set());
  const [pickedPokemon, setPickedPokemon] = useState<Set<string>>(new Set());
  const [draftHistory, setDraftHistory] = useState<
    Array<{
      step: number;
      team: Team;
      action: "BAN" | "PICK";
      pokemon: Pokemon;
    }>
  >([]);

  // UI状態
  const [showPokemonPicker, setShowPokemonPicker] = useState<boolean>(false);

  // P2P通信状態
  const [p2pState, setP2pState] = useState<P2PState>({
    isConnecting: false,
    showConnectionModal: false,
  });

  // P2P通信フック
  const p2p = useP2P(room?.id || "", room?.isHost || false);
  
  // BANPICKシミュレーター専用API
  const pickSimulatorApi = usePickSimulatorApi();

  // 正しいドラフトフロー（先攻BAN1→後攻BAN1→先攻BAN2→後攻BAN2→先攻PICK1→後攻PICK1→後攻PICK2→先攻PICK2,3→後攻PICK3,4→先攻PICK4,5→後攻PICK5）
  const draftOrder = useMemo(
    () =>
      [
        // BAN1フェーズ
        { phase: "ban1", team: "first" }, // Step 1: 先攻BAN1
        { phase: "ban1", team: "second" }, // Step 2: 後攻BAN1
        { phase: "ban2", team: "first" }, // Step 3: 先攻BAN2
        { phase: "ban2", team: "second" }, // Step 4: 後攻BAN2
        // PICKフェーズ
        { phase: "pick", team: "first" }, // Step 5: 先攻PICK1
        { phase: "pick", team: "second" }, // Step 6: 後攻PICK1
        { phase: "pick", team: "second" }, // Step 7: 後攻PICK2
        { phase: "pick", team: "first" }, // Step 8: 先攻PICK2
        { phase: "pick", team: "first" }, // Step 9: 先攻PICK3
        { phase: "pick", team: "second" }, // Step 10: 後攻PICK3
        { phase: "pick", team: "second" }, // Step 11: 後攻PICK4
        { phase: "pick", team: "first" }, // Step 12: 先攻PICK4
        { phase: "pick", team: "first" }, // Step 13: 先攻PICK5
        { phase: "pick", team: "second" }, // Step 14: 後攻PICK5
      ] as const,
    [],
  );

  // P2P通信からのポケモン選択を処理（ブロードキャストしない）
  const handlePokemonSelectFromP2P = useCallback(
    (pokemon: Pokemon) => {
      if (bannedPokemon.has(pokemon.id) || pickedPokemon.has(pokemon.id))
        return;
      if (currentPhase === "completed") return;

      const currentStep = draftOrder[stepCounter];
      if (!currentStep) return;

      if (currentStep.phase === "ban1" || currentStep.phase === "ban2") {
        // BANフェーズの処理
        const newBannedPokemon = new Set(bannedPokemon);
        newBannedPokemon.add(pokemon.id);
        setBannedPokemon(newBannedPokemon);

        if (currentStep.team === "first") {
          setFirstTeamBans([...firstTeamBans, pokemon]);
        } else {
          setSecondTeamBans([...secondTeamBans, pokemon]);
        }

        // ドラフト履歴に追加
        setDraftHistory([
          ...draftHistory,
          {
            step: stepCounter + 1,
            team: currentStep.team,
            action: "BAN",
            pokemon,
          },
        ]);
      } else if (currentStep.phase === "pick") {
        // PICKフェーズの処理
        const newPickedPokemon = new Set(pickedPokemon);
        newPickedPokemon.add(pokemon.id);
        setPickedPokemon(newPickedPokemon);

        if (currentStep.team === "first") {
          setFirstTeamPicks([...firstTeamPicks, pokemon]);
        } else {
          setSecondTeamPicks([...secondTeamPicks, pokemon]);
        }

        // ドラフト履歴に追加
        setDraftHistory([
          ...draftHistory,
          {
            step: stepCounter + 1,
            team: currentStep.team,
            action: "PICK",
            pokemon,
          },
        ]);
      }

      // 次のステップに進む
      const newStepCounter = stepCounter + 1;
      if (newStepCounter >= draftOrder.length) {
        setCurrentPhase("completed");
      } else {
        const nextStep = draftOrder[newStepCounter];
        setCurrentPhase(nextStep.phase);
        setCurrentTurn(nextStep.team);
        setStepCounter(newStepCounter);
      }
    },
    [
      bannedPokemon,
      pickedPokemon,
      currentPhase,
      stepCounter,
      firstTeamBans,
      secondTeamBans,
      firstTeamPicks,
      secondTeamPicks,
      draftHistory,
    ],
  );

  const resetDraftFromP2P = useCallback(() => {
    setCurrentPhase("ban1");
    setCurrentTurn(firstAttack); // リセット時は現在の先攻設定に基づいてターンを設定
    setStepCounter(0);
    setFirstTeamBans([]);
    setSecondTeamBans([]);
    setFirstTeamPicks([]);
    setSecondTeamPicks([]);
    setBannedPokemon(new Set());
    setPickedPokemon(new Set());
    setDraftHistory([]);
  }, [firstAttack]);

  // P2P メッセージハンドラー
  useEffect(() => {
    p2p.setMessageHandler((message: GameMessage) => {
      switch (message.type) {
        case "POKEMON_SELECT": {
          const messageData = message.data as { pokemon: Pokemon };
          handlePokemonSelectFromP2P(messageData.pokemon);
          break;
        }
        case "DRAFT_RESET":
          resetDraftFromP2P();
          break;
        case "FIRST_ATTACK_TOGGLE": {
          const messageData = message.data as {
            firstAttack: "first" | "second";
          };
          setFirstAttack(messageData.firstAttack);
          break;
        }
        case "GAME_STATE_UPDATE": {
          // 完全なゲーム状態を同期
          const state = message.data as {
            currentPhase: Phase;
            currentTurn: Team;
            stepCounter: number;
            firstTeamBans: Pokemon[];
            secondTeamBans: Pokemon[];
            firstTeamPicks: Pokemon[];
            secondTeamPicks: Pokemon[];
            bannedPokemon: string[];
            pickedPokemon: string[];
            draftHistory: Array<{
              step: number;
              team: Team;
              action: "BAN" | "PICK";
              pokemon: Pokemon;
            }>;
            firstAttack: "first" | "second";
          };
          setCurrentPhase(state.currentPhase);
          setCurrentTurn(state.currentTurn);
          setStepCounter(state.stepCounter);
          setFirstTeamBans(state.firstTeamBans);
          setSecondTeamBans(state.secondTeamBans);
          setFirstTeamPicks(state.firstTeamPicks);
          setSecondTeamPicks(state.secondTeamPicks);
          setBannedPokemon(new Set(state.bannedPokemon));
          setPickedPokemon(new Set(state.pickedPokemon));
          setDraftHistory(state.draftHistory);
          setFirstAttack(state.firstAttack);
          break;
        }
      }
    });
  }, [p2p, handlePokemonSelectFromP2P, resetDraftFromP2P]);

  // ポケモン選択ハンドラー
  const handlePokemonPickerSelect = (
    selectedRole: string,
    slotIndex: number,
    pokemonSlot: {
      id: string;
      name: string;
      type: string;
      iconUrl?: string;
    },
  ) => {
    // pokemonSlotからPokemonオブジェクトを作成
    const pokemon: Pokemon = {
      id: pokemonSlot.id,
      name: pokemonSlot.name,
      role: pokemonSlot.type,
      tier: "A", // 仮のティアー
      imageUrl: pokemonSlot.iconUrl,
    };

    handlePokemonSelect(pokemon);
  };

  // 選択済みポケモンのスロット配列（BAN/PICK済みのポケモンを除外用）
  const selectedPokemonSlots = [
    ...Array.from(bannedPokemon).map((id) => ({ id })),
    ...Array.from(pickedPokemon).map((id) => ({ id })),
  ];

  // 現在のターンかどうかの判定
  const isCurrentTurn = (team: Team) => {
    return currentTurn === team && currentPhase !== "completed";
  };

  const handlePokemonSelect = (pokemon: Pokemon) => {
    handlePokemonSelectFromP2P(pokemon);

    // P2P通信でポケモン選択を送信
    if (p2p.isConnected) {
      p2p.sendMessage({
        type: "POKEMON_SELECT",
        data: { pokemon },
        timestamp: Date.now(),
      });
    }
  };

  const resetDraft = () => {
    resetDraftFromP2P();

    // P2P通信でリセットを送信
    if (p2p.isConnected) {
      p2p.sendMessage({
        type: "DRAFT_RESET",
        data: {},
        timestamp: Date.now(),
      });
    }
  };

  const getCurrentPhaseText = () => {
    if (currentPhase === "completed") return "ドラフト完了！";

    const currentStep = draftOrder[stepCounter];
    if (!currentStep) return "エラー";

    const teamName = currentStep.team === "first" ? "先攻チーム" : "後攻チーム";
    const actionText = currentStep.phase === "pick" ? "PICK" : "BAN";
    const phaseText =
      currentStep.phase === "ban1"
        ? "BAN1フェーズ"
        : currentStep.phase === "ban2"
          ? "BAN2フェーズ"
          : "PICKフェーズ";

    return `${phaseText} - ${teamName}が${actionText} (${stepCounter + 1}/14)`;
  };

  // ルーム関連関数
  const generateRoomId = (): string => {
    return Math.random().toString(36).substr(2, 8).toUpperCase();
  };

  const createRoom = async () => {
    const newRoomId = generateRoomId();
    
    // サーバーにルームを作成
    const result = await pickSimulatorApi.createRoom(newRoomId);
    if (result.error) {
      alert(`ルーム作成エラー: ${result.error}`);
      return;
    }
    
    const newRoom: Room = {
      id: newRoomId,
      hostName: "ホスト",
      isHost: true,
    };
    setRoom(newRoom);
    // ホストは即座にドラフト画面へ（ゲスト接続を待たない）
    setGameState("draft");
    // バックグラウンドでP2P接続準備
    setTimeout(() => p2p.createOffer(), 100);
  };

  const joinRoom = async () => {
    if (!roomId.trim()) return;
    
    // サーバーでルームの存在確認
    const result = await pickSimulatorApi.checkRoom(roomId);
    if (result.error || !result.data?.exists) {
      alert("指定されたルームが見つかりません");
      return;
    }
    
    const newRoom: Room = {
      id: roomId,
      hostName: "ホスト", 
      guestName: "ゲスト",
      isHost: false,
    };
    setRoom(newRoom);
    setGameState("draft");
  };

  const toggleFirstAttack = () => {
    // ドラフト開始後は切り替え不可
    if (stepCounter > 0) return;
    
    const newFirstAttack = firstAttack === "first" ? "second" : "first";
    setFirstAttack(newFirstAttack);

    // 先攻後攻を切り替えたら、現在のターンも切り替える
    const newCurrentTurn = newFirstAttack;
    setCurrentTurn(newCurrentTurn);

    // P2P通信で先攻切替を送信
    if (p2p.isConnected) {
      p2p.sendMessage({
        type: "FIRST_ATTACK_TOGGLE",
        data: { firstAttack: newFirstAttack },
        timestamp: Date.now(),
      });
    }
  };

  // ロビー画面
  if (gameState === "lobby") {
    return (
      <Layout className="bg-gray-50">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-4">
              BANPICKシミュレーター
            </h1>
            <p className="text-gray-600">
              ポケモンユナイトのドラフトをシミュレーションしよう！
            </p>
          </div>

          {/* 使い方説明 */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold mb-3 text-gray-800">使い方</h3>
            <ul className="text-sm space-y-2 text-blue-800">
              <li>• ルームを作成するか、IDを入力してルームを探してください</li>
              <li>• 一つのルームにはホストとゲストの最大二名まで入れます</li>
              <li>
                • ルームに一人しか入っていない場合は先攻後攻両方操作できます
              </li>
              <li>
                •
                ポケモンを選択ボタンが表示されている側から、順番にポケモンを選択してください
              </li>
              <li>• 想定外の挙動があった場合はルームを作り直してください</li>
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  ルームを作成
                </h3>
                <p className="text-sm text-gray-600">
                  新しいルームを作成してシミュレーションを開始
                </p>
                <button
                  onClick={createRoom}
                  className="w-full bg-purple-500 text-white py-3 px-4 rounded-lg hover:bg-purple-600 transition-colors font-medium"
                >
                  ルーム作成
                </button>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  ルームに入室
                </h3>
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  placeholder="ルームIDを入力"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={joinRoom}
                  disabled={!roomId.trim()}
                  className="w-full bg-orange-500 text-white py-3 px-4 rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  入室
                </button>
              </div>
            </div>
          </div>
        </div>

      </Layout>
    );
  }

  // ドラフト画面
  return (
    <Layout className="bg-gray-50">
      <div className="container mx-auto px-1 sm:px-4 py-4 sm:py-8 max-w-3xl">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 sm:mb-8 gap-1 sm:gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800">
              BANPICKシミュレーター
            </h1>
            {room && (
              <div className="text-xs sm:text-sm text-gray-600 mt-1">
                <p className="break-words">
                  <span className="inline-block">ID: <span className="font-mono font-bold">{room.id}</span></span>
                  <span className="hidden sm:inline">
                    {room.guestName
                      ? ` | ${room.hostName} vs ${room.guestName}`
                      : ` | ${room.hostName}`}
                  </span>
                </p>
                <p className="flex items-center mt-1">
                  {p2p.isConnected ? (
                    <>
                      <span className="text-xs">接続:</span>
                      <span className="ml-1 px-1 sm:px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-800">
                        2人
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs">接続:</span>
                      <span className="ml-1 px-1 sm:px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                        1人
                      </span>
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-1 sm:gap-2 justify-end">
            <button
              onClick={toggleFirstAttack}
              disabled={stepCounter > 0}
              className={`px-2 sm:px-4 py-1 sm:py-2 rounded transition-colors text-xs sm:text-sm ${
                stepCounter > 0 
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed" 
                  : "bg-blue-500 text-white hover:bg-blue-600"
              }`}
            >
              先攻: {firstAttack === "first" ? "A" : "B"}
            </button>
            <button
              onClick={resetDraft}
              className="bg-red-500 text-white px-2 sm:px-4 py-1 sm:py-2 rounded hover:bg-red-600 transition-colors text-xs sm:text-sm"
            >
              リセット
            </button>
            <button
              onClick={() => setGameState("lobby")}
              className="bg-gray-500 text-white px-2 sm:px-4 py-1 sm:py-2 rounded hover:bg-gray-600 transition-colors text-xs sm:text-sm"
            >
              戻る
            </button>
          </div>
        </div>


        {/* チーム表示 */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* チームA (左側) */}
          <div className="bg-white rounded-lg shadow p-2 sm:p-4">
            <h3 className="text-lg font-semibold text-purple-600 mb-4">
              🟣 チームA {firstAttack === "first" ? "(先攻)" : "(後攻)"}
            </h3>

            <div className="mb-2 sm:mb-4">
              <h4 className="font-medium mb-1 sm:mb-2 text-sm sm:text-base">
                BAN ({firstTeamBans.length}/2)
              </h4>
              <div className="grid grid-cols-2 gap-1 sm:gap-2 min-h-[60px]">
                {Array.from({ length: 2 }).map((_, index) => (
                  <div
                    key={index}
                    className="bg-red-50 border border-red-200 rounded p-1 sm:p-2 text-center min-h-[50px] flex items-center justify-center"
                  >
                    {firstTeamBans[index] ? (
                      <div className="relative w-16 h-16 bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer mx-auto">
                        <img
                          src={firstTeamBans[index].imageUrl}
                          alt={firstTeamBans[index].name}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-80 text-white px-1 py-1 rounded-b-lg">
                          <div className="text-center">
                            <span className={`block leading-none ${
                              firstTeamBans[index].name.length <= 3
                                ? "text-[10px]"
                                : firstTeamBans[index].name.length <= 5
                                  ? "text-[9px]"
                                  : firstTeamBans[index].name.length <= 7
                                    ? "text-[8px]"
                                    : "text-[7px]"
                            }`}>
                              {firstTeamBans[index].name}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">
                        BAN{index + 1}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-1 sm:mb-2 text-sm sm:text-base">
                PICK ({firstTeamPicks.length}/5)
              </h4>
              <div className="space-y-1 sm:space-y-2 min-h-[150px]">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="bg-purple-50 border border-purple-200 rounded p-1 sm:p-3 min-h-[40px] flex items-center"
                  >
                    {firstTeamPicks[index] ? (
                      <div className="relative w-16 h-16 bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer mx-auto">
                        <img
                          src={firstTeamPicks[index].imageUrl}
                          alt={firstTeamPicks[index].name}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-80 text-white px-1 py-1 rounded-b-lg">
                          <div className="text-center">
                            <span className={`block leading-none ${
                              firstTeamPicks[index].name.length <= 3
                                ? "text-[10px]"
                                : firstTeamPicks[index].name.length <= 5
                                  ? "text-[9px]"
                                  : firstTeamPicks[index].name.length <= 7
                                    ? "text-[8px]"
                                    : "text-[7px]"
                            }`}>
                              {firstTeamPicks[index].name}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">
                        PICK{index + 1}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* チームAの選択ボタン */}
            <div className="mt-4">
              {isCurrentTurn("first") ? (
                <button
                  onClick={() => setShowPokemonPicker(true)}
                  className="w-full bg-purple-500 text-white py-2 px-4 rounded-lg hover:bg-purple-600 transition-colors"
                >
                  ポケモンを選ぶ
                </button>
              ) : currentPhase !== "completed" ? (
                <div className="w-full bg-gray-200 text-gray-500 py-2 px-4 rounded-lg text-center">
                  {currentTurn === "second"
                    ? "チームBが選択中..."
                    : "待機中..."}
                </div>
              ) : (
                <div className="w-full bg-gray-100 text-gray-400 py-2 px-4 rounded-lg text-center">
                  ドラフト完了
                </div>
              )}
            </div>
          </div>

          {/* チームB (右側) */}
          <div className="bg-white rounded-lg shadow p-2 sm:p-4">
            <h3 className="text-lg font-semibold text-orange-600 mb-4">
              🟠 チームB {firstAttack === "second" ? "(先攻)" : "(後攻)"}
            </h3>

            <div className="mb-2 sm:mb-4">
              <h4 className="font-medium mb-1 sm:mb-2 text-sm sm:text-base">
                BAN ({secondTeamBans.length}/2)
              </h4>
              <div className="grid grid-cols-2 gap-1 sm:gap-2 min-h-[60px]">
                {Array.from({ length: 2 }).map((_, index) => (
                  <div
                    key={index}
                    className="bg-red-50 border border-red-200 rounded p-1 sm:p-2 text-center min-h-[50px] flex items-center justify-center"
                  >
                    {secondTeamBans[index] ? (
                      <div className="relative w-16 h-16 bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer mx-auto">
                        <img
                          src={secondTeamBans[index].imageUrl}
                          alt={secondTeamBans[index].name}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-80 text-white px-1 py-1 rounded-b-lg">
                          <div className="text-center">
                            <span className={`block leading-none ${
                              secondTeamBans[index].name.length <= 3
                                ? "text-[10px]"
                                : secondTeamBans[index].name.length <= 5
                                  ? "text-[9px]"
                                  : secondTeamBans[index].name.length <= 7
                                    ? "text-[8px]"
                                    : "text-[7px]"
                            }`}>
                              {secondTeamBans[index].name}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">
                        BAN{index + 1}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-1 sm:mb-2 text-sm sm:text-base">
                PICK ({secondTeamPicks.length}/5)
              </h4>
              <div className="space-y-1 sm:space-y-2 min-h-[150px]">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="bg-orange-50 border border-orange-200 rounded p-1 sm:p-3 min-h-[40px] flex items-center"
                  >
                    {secondTeamPicks[index] ? (
                      <div className="relative w-16 h-16 bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer mx-auto">
                        <img
                          src={secondTeamPicks[index].imageUrl}
                          alt={secondTeamPicks[index].name}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-80 text-white px-1 py-1 rounded-b-lg">
                          <div className="text-center">
                            <span className={`block leading-none ${
                              secondTeamPicks[index].name.length <= 3
                                ? "text-[10px]"
                                : secondTeamPicks[index].name.length <= 5
                                  ? "text-[9px]"
                                  : secondTeamPicks[index].name.length <= 7
                                    ? "text-[8px]"
                                    : "text-[7px]"
                            }`}>
                              {secondTeamPicks[index].name}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">
                        PICK{index + 1}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* チームBの選択ボタン */}
            <div className="mt-4">
              {isCurrentTurn("second") ? (
                <button
                  onClick={() => setShowPokemonPicker(true)}
                  className="w-full bg-orange-500 text-white py-2 px-4 rounded-lg hover:bg-orange-600 transition-colors"
                >
                  ポケモンを選ぶ
                </button>
              ) : currentPhase !== "completed" ? (
                <div className="w-full bg-gray-200 text-gray-500 py-2 px-4 rounded-lg text-center">
                  {currentTurn === "first" ? "チームAが選択中..." : "待機中..."}
                </div>
              ) : (
                <div className="w-full bg-gray-100 text-gray-400 py-2 px-4 rounded-lg text-center">
                  ドラフト完了
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ポケモン選択ポップアップ */}
        <PokemonPickerPopup
          isOpen={showPokemonPicker}
          onClose={() => setShowPokemonPicker(false)}
          selectedRole="" // 使用しないが必須
          slotIndex={0} // 使用しないが必須
          onSelectPokemon={handlePokemonPickerSelect}
          currentRoleSlots={selectedPokemonSlots} // BAN/PICK済みのポケモンを除外するために空配列
        />

      </div>
    </Layout>
  );
};

export default Tools;
