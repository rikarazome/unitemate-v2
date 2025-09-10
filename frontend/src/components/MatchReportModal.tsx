/**
 * 試合結果報告モーダル
 * Legacy設計に準拠した報告フロー：
 * 1. BANポケモン選択
 * 2. 使用ポケモン選択
 * 3. 技選択（2つ）
 * 4. 勝敗選択
 * 5. 通報（オプション）
 */

import React, { useState, useEffect } from "react";
import { useUnitemateApi } from "../hooks/useUnitemateApi";
import { POKEMON_TYPES } from "../data/pokemon/types";
import { getAllPokemon } from "../data/pokemon";
import type { MatchPlayer } from "./MatchScreen";

interface MatchReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string;
  matchPlayers: MatchPlayer[]; // 試合参加プレイヤー一覧
  currentUserTeam: "A" | "B" | null; // 現在のユーザーのチーム
  onReportComplete: () => void;
  isTestMode?: boolean;
}

interface ReportData {
  result: "win" | "lose" | "invalid";
  banned_pokemon: string;
  picked_pokemon: string;
  pokemon_move1: string;
  pokemon_move2: string;
  violation_report: string;
}

// Legacy APIに送信する形式
interface LegacyReportData {
  result: "A-win" | "B-win" | "invalid";
  banned_pokemon: string;
  picked_pokemon: string;
  pokemon_move1: string;
  pokemon_move2: string;
  violation_report: string;
}

interface PokemonData {
  display: string;
  jp_name: string;
  index_number: string;
  type: string;
  _1a: string;
  _1b: string;
  _2a: string;
  _2b: string;
  icon: string;
}

export const MatchReportModal: React.FC<MatchReportModalProps> = ({
  isOpen,
  onClose,
  matchId,
  matchPlayers,
  currentUserTeam,
  onReportComplete,
  isTestMode = false,
}) => {
  const { unitemateApi } = useUnitemateApi();
  const [step, setStep] = useState<
    "banned" | "invalid_player" | "picked" | "moves" | "result" | "violation"
  >("banned");
  const [reportData, setReportData] = useState<ReportData>({
    result: "win",
    banned_pokemon: "",
    picked_pokemon: "",
    pokemon_move1: "",
    pokemon_move2: "",
    violation_report: "",
  });
  const [pokemonData, setPokemonData] = useState<PokemonData[]>([]);
  const [selectedPokemon, setSelectedPokemon] = useState<PokemonData | null>(
    null
  );
  const [selectedTypeForBan, setSelectedTypeForBan] = useState<string | null>(
    null
  );
  const [selectedTypeForPick, setSelectedTypeForPick] = useState<string | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pokemon データを読み込み
  useEffect(() => {
    try {
      // pokemon/index.tsから直接データを取得
      const data = getAllPokemon();
      // 古い形式に変換（既存のコードとの互換性のため）
      const convertedData = data.map((pokemon) => ({
        display: pokemon.pokemon_id.toLowerCase(),
        jp_name: pokemon.name_ja,
        index_number: pokemon.index_number.toString(),
        type: pokemon.type,
        _1a: pokemon.moves.move_1a,
        _1b: pokemon.moves.move_1b,
        _2a: pokemon.moves.move_2a,
        _2b: pokemon.moves.move_2b,
        icon: pokemon.icon_url || "",
      }));
      setPokemonData(convertedData);
    } catch (error) {
      console.error("Failed to load Pokemon data:", error);
    }
  }, []);

  if (!isOpen) return null;

  const handleNext = () => {
    setError(null);

    switch (step) {
      case "banned":
        // BAN選択はアイコンクリックで自動進行するため、ここは使われない
        break;
      case "invalid_player":
        if (!reportData.violation_report) {
          setError("無効試合の原因プレイヤーを選択してください");
          return;
        }
        handleSubmit();
        break;
      case "picked":
        if (!reportData.picked_pokemon) {
          setError("使用したポケモンを選択してください");
          return;
        }
        if (reportData.picked_pokemon === reportData.banned_pokemon) {
          setError("BANしたポケモンと同じポケモンは選択できません");
          return;
        }
        setStep("moves");
        break;
      case "moves":
        // 技選択は両方選んだら自動進行するため、ここは使われない
        break;
      case "result":
        setStep("violation");
        break;
      case "violation":
        handleSubmit();
        break;
    }
  };

  const handleBack = () => {
    switch (step) {
      case "invalid_player":
        setStep("banned");
        break;
      case "picked":
        setStep("banned");
        break;
      case "moves":
        setStep("picked");
        break;
      case "result":
        setStep("moves");
        break;
      case "violation":
        setStep("result");
        break;
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Legacy形式のデータを準備

      const legacyReportData: LegacyReportData = {
        result: convertToTeamResult(reportData.result),
        banned_pokemon: reportData.banned_pokemon,
        picked_pokemon: reportData.picked_pokemon,
        pokemon_move1: reportData.pokemon_move1,
        pokemon_move2: reportData.pokemon_move2,
        violation_report: reportData.violation_report,
      };
      console.log(
        "MatchReportModal - Sending violation_report:",
        reportData.violation_report
      );
      console.log(
        "MatchReportModal - Full legacyReportData:",
        legacyReportData
      );

      if (isTestMode) {
        // テストモード：APIを呼ばずに成功をシミュレート
        console.log("テストモード - 報告データ:", reportData);
        console.log("テストモード - Legacy形式:", legacyReportData);
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 1秒待機をシミュレート
        alert(
          "テストモード：報告が完了しました！\n\n" +
            "ユーザー選択: " +
            JSON.stringify(reportData, null, 2) +
            "\n\n" +
            "API送信データ: " +
            JSON.stringify(legacyReportData, null, 2)
        );
      } else {
        // 実際のAPI呼び出し
        await unitemateApi.reportMatchResult(matchId, legacyReportData);
      }

      onReportComplete();
      onClose();
      // リセット
      setReportData({
        result: "win",
        banned_pokemon: "",
        picked_pokemon: "",
        pokemon_move1: "",
        pokemon_move2: "",
        violation_report: "",
      });
      setStep("banned");
    } catch (err) {
      setError(err instanceof Error ? err.message : "報告に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case "banned":
        return "自分がBANしたポケモンを選択";
      case "invalid_player":
        return "無効試合の原因プレイヤーを選択";
      case "picked":
        return "使用したポケモンを選択";
      case "moves":
        return "使用した技を選択";
      case "result":
        return "試合結果を選択";
      case "violation":
        return "通報プレイヤーを選択";
    }
  };

  // ポケモン選択時の処理（アイコンクリックで自動進行）
  const handlePokemonSelect = (
    pokemon: PokemonData,
    field: "banned_pokemon" | "picked_pokemon"
  ) => {
    setReportData((prev) => ({ ...prev, [field]: pokemon.display }));
    if (field === "banned_pokemon") {
      setSelectedPokemon(pokemon);
      // 次のステップに自動進行
      setStep("picked");
    } else if (field === "picked_pokemon") {
      setSelectedPokemon(pokemon);
      // 次のステップに自動進行
      setStep("moves");
    }
  };

  // 無効試合を選択した場合の処理
  const handleInvalidMatch = () => {
    setReportData((prev) => ({ ...prev, result: "invalid" }));
    setStep("invalid_player");
  };

  // 技選択時の処理（両方選んだら自動進行）
  const handleMoveSelect = (moveKey: string, moveIndex: "1" | "2") => {
    const updateKey = `pokemon_move${moveIndex}` as keyof ReportData;
    setReportData((prev) => {
      const updated = { ...prev, [updateKey]: moveKey };
      // 両方の技が選択されたら自動進行
      if (updated.pokemon_move1 && updated.pokemon_move2) {
        setTimeout(() => setStep("result"), 100);
      }
      return updated;
    });
  };

  // 勝敗選択時の処理（選択したら自動進行）
  const handleResultSelect = (result: "win" | "lose") => {
    setReportData((prev) => ({ ...prev, result }));
    setTimeout(() => setStep("violation"), 100);
  };

  // win/loseをA-win/B-winに変換する関数
  const convertToTeamResult = (
    result: "win" | "lose" | "invalid"
  ): "A-win" | "B-win" | "invalid" => {
    if (result === "invalid") return "invalid";
    if (!currentUserTeam)
      throw new Error("ユーザーのチーム情報が取得できません");

    if (result === "win") {
      return currentUserTeam === "A" ? "A-win" : "B-win";
    } else {
      return currentUserTeam === "A" ? "B-win" : "A-win";
    }
  };

  // タイプ別の色定義（得意ポケモンスロットと同じ）
  const getTypeColor = (typeKey: string) => {
    switch (typeKey) {
      case "ATTACKER":
        return "bg-red-600 text-white border-red-600 hover:bg-red-700";
      case "ALL_ROUNDER":
        return "bg-purple-600 text-white border-purple-600 hover:bg-purple-700";
      case "SPEEDSTER":
        return "bg-blue-600 text-white border-blue-600 hover:bg-blue-700";
      case "DEFENDER":
        return "bg-green-600 text-white border-green-600 hover:bg-green-700";
      case "SUPPORTER":
        return "bg-yellow-500 text-white border-yellow-500 hover:bg-yellow-600";
      default:
        return "bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400";
    }
  };

  // タイプでフィルタリングされたポケモンを取得
  const getFilteredPokemon = (selectedType: string | null) => {
    if (!selectedType) return [];
    const typeValue = POKEMON_TYPES[selectedType as keyof typeof POKEMON_TYPES];
    return pokemonData.filter((pokemon) => pokemon.type === typeValue);
  };

  const renderStep = () => {
    switch (step) {
      case "banned": {
        const filteredPokemonForBan = getFilteredPokemon(selectedTypeForBan);
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              BANされたポケモンを選択してください
              <br />
              レート順3番目の人が1匹目、4番目が2匹目、5番目が3匹目を報告してください
            </p>

            {/* タイプフィルター行 */}
            <div className="mb-6 max-[500px]:mb-1">
              <div className="grid grid-cols-5 gap-2 max-[500px]:gap-0">
                {Object.entries(POKEMON_TYPES).map(([typeKey, typeName]) => (
                  <button
                    key={typeKey}
                    onClick={() =>
                      setSelectedTypeForBan(
                        selectedTypeForBan === typeKey ? null : typeKey
                      )
                    }
                    className={`px-1 py-2 sm:px-3 sm:py-3 max-[500px]:px-0.5 max-[500px]:py-1 rounded-lg border text-xs sm:text-sm max-[500px]:text-[10px] max-[320px]:text-[8px] font-medium transition-all duration-200 whitespace-nowrap text-center flex items-center justify-center ${
                      selectedTypeForBan === typeKey
                        ? `${getTypeColor(typeKey)} shadow-lg scale-105`
                        : getTypeColor(typeKey).replace("hover:", "") +
                          " opacity-70 hover:opacity-100"
                    }`}
                  >
                    {typeName}
                  </button>
                ))}
              </div>
            </div>

            {/* ポケモン選択エリア */}
            {!selectedTypeForBan ? (
              <div className="text-center py-12 text-gray-500">
                <svg
                  className="w-12 h-12 mx-auto mb-4 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p>タイプを選択してポケモンを表示してください</p>
              </div>
            ) : filteredPokemonForBan.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>該当するポケモンが見つかりません</p>
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-3 max-[500px]:gap-0 max-h-64 overflow-y-auto">
                {/* 未選択オプション */}
                <button
                  onClick={() => {
                    setReportData((prev) => ({ ...prev, banned_pokemon: "" }));
                    setTimeout(() => setStep("picked"), 100);
                  }}
                  className={`
                    relative aspect-square rounded-lg border-2 transition-all duration-200 overflow-hidden group
                    ${
                      reportData.banned_pokemon === ""
                        ? "border-gray-500 bg-gray-100 shadow-lg scale-105"
                        : "border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400 hover:scale-105 active:scale-95"
                    }
                  `}
                >
                  <div className="relative w-full h-full flex items-center justify-center pb-6 pt-1">
                    <div className="text-5xl text-gray-400">❌</div>
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-80 text-white px-1 py-1 max-[500px]:px-0.5 max-[500px]:py-0.5 rounded-b-lg">
                      <div className="text-center">
                        <span className="block leading-none text-[10px] max-[500px]:text-[8px]">
                          未選択
                        </span>
                      </div>
                    </div>
                  </div>
                </button>

                {filteredPokemonForBan
                  .sort(
                    (a, b) =>
                      parseInt(a.index_number) - parseInt(b.index_number)
                  )
                  .map((pokemon) => (
                    <button
                      key={pokemon.display}
                      onClick={() =>
                        handlePokemonSelect(pokemon, "banned_pokemon")
                      }
                      className={`
                      relative aspect-square rounded-lg border-2 transition-all duration-200 overflow-hidden group
                      ${
                        reportData.banned_pokemon === pokemon.display
                          ? "border-red-500 bg-red-50 shadow-lg scale-105"
                          : "border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400 hover:scale-105 active:scale-95"
                      }
                    `}
                    >
                      <div className="relative w-full h-full">
                        <img
                          src={pokemon.icon}
                          alt={pokemon.jp_name}
                          className="absolute inset-0 w-full h-full object-contain"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                          }}
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-80 text-white px-1 py-1 max-[500px]:px-0.5 max-[500px]:py-0.5 rounded-b-lg">
                          <div className="text-center">
                            <span
                              className={`block leading-none ${
                                pokemon.jp_name.length <= 3
                                  ? "text-[10px] max-[500px]:text-[8px]"
                                  : pokemon.jp_name.length <= 5
                                    ? "text-[9px] max-[500px]:text-[7px]"
                                    : pokemon.jp_name.length <= 7
                                      ? "text-[8px] max-[500px]:text-[6px]"
                                      : "text-[7px] max-[500px]:text-[5px]"
                              }`}
                            >
                              {pokemon.jp_name}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            )}

            <div className="border-t pt-4 relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-white px-2 text-sm text-gray-500">
                または
              </div>
              <button
                onClick={handleInvalidMatch}
                className="w-full p-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                無効試合
              </button>
            </div>
          </div>
        );
      }

      case "invalid_player": {
        // プレイヤーをチーム別に分割
        const teamAPlayers = matchPlayers.slice(0, 5);
        const teamBPlayers = matchPlayers.slice(5, 10);

        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              無効試合の原因となったプレイヤーを選択してください
            </p>
            <div className="grid grid-cols-2 gap-4">
              {/* チームA */}
              <div>
                <h4 className="text-sm font-medium text-purple-600 mb-2 text-center">
                  チームA
                </h4>
                <div className="space-y-2">
                  {teamAPlayers.map((player) => (
                    <button
                      key={player.user_id}
                      onClick={() => {
                        console.log(
                          "MatchReportModal - Invalid match player selected:",
                          player.user_id,
                          player.trainer_name
                        );
                        setReportData((prev) => ({
                          ...prev,
                          violation_report: player.user_id,
                        }));
                      }}
                      className={`w-full p-2 rounded-lg border-2 transition-colors text-left ${
                        reportData.violation_report === player.user_id
                          ? "border-red-500 bg-red-50 text-red-700"
                          : "border-gray-200 hover:border-red-300 hover:bg-red-50"
                      }`}
                    >
                      <div className="font-medium text-xs">
                        {player.trainer_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {player.discord_username || "Discord未設定"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* チームB */}
              <div>
                <h4 className="text-sm font-medium text-orange-600 mb-2 text-center">
                  チームB
                </h4>
                <div className="space-y-2">
                  {teamBPlayers.map((player) => (
                    <button
                      key={player.user_id}
                      onClick={() => {
                        console.log(
                          "MatchReportModal - Invalid match player selected:",
                          player.user_id,
                          player.trainer_name
                        );
                        setReportData((prev) => ({
                          ...prev,
                          violation_report: player.user_id,
                        }));
                      }}
                      className={`w-full p-2 rounded-lg border-2 transition-colors text-left ${
                        reportData.violation_report === player.user_id
                          ? "border-red-500 bg-red-50 text-red-700"
                          : "border-gray-200 hover:border-red-300 hover:bg-red-50"
                      }`}
                    >
                      <div className="font-medium text-xs">
                        {player.trainer_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {player.discord_username || "Discord未設定"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      }

      case "picked": {
        const filteredPokemonForPick = getFilteredPokemon(
          selectedTypeForPick
        ).filter((p) => p.display !== reportData.banned_pokemon);
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              あなたが使用したポケモンを選択してください
            </p>

            {/* タイプフィルター行 */}
            <div className="mb-6 max-[500px]:mb-1">
              <div className="grid grid-cols-5 gap-2 max-[500px]:gap-0">
                {Object.entries(POKEMON_TYPES).map(([typeKey, typeName]) => (
                  <button
                    key={typeKey}
                    onClick={() =>
                      setSelectedTypeForPick(
                        selectedTypeForPick === typeKey ? null : typeKey
                      )
                    }
                    className={`px-1 py-2 sm:px-3 sm:py-3 max-[500px]:px-0.5 max-[500px]:py-1 rounded-lg border text-xs sm:text-sm max-[500px]:text-[10px] max-[320px]:text-[8px] font-medium transition-all duration-200 whitespace-nowrap text-center flex items-center justify-center ${
                      selectedTypeForPick === typeKey
                        ? `${getTypeColor(typeKey)} shadow-lg scale-105`
                        : getTypeColor(typeKey).replace("hover:", "") +
                          " opacity-70 hover:opacity-100"
                    }`}
                  >
                    {typeName}
                  </button>
                ))}
              </div>
            </div>

            {/* ポケモン選択エリア */}
            {!selectedTypeForPick ? (
              <div className="text-center py-12 text-gray-500">
                <svg
                  className="w-12 h-12 mx-auto mb-4 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p>タイプを選択してポケモンを表示してください</p>
              </div>
            ) : filteredPokemonForPick.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>該当するポケモンが見つかりません</p>
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-3 max-[500px]:gap-0 max-h-64 overflow-y-auto">
                {filteredPokemonForPick
                  .sort(
                    (a, b) =>
                      parseInt(a.index_number) - parseInt(b.index_number)
                  )
                  .map((pokemon) => (
                    <button
                      key={pokemon.display}
                      onClick={() =>
                        handlePokemonSelect(pokemon, "picked_pokemon")
                      }
                      className={`
                      relative aspect-square rounded-lg border-2 transition-all duration-200 overflow-hidden group
                      ${
                        reportData.picked_pokemon === pokemon.display
                          ? "border-blue-500 bg-blue-50 shadow-lg scale-105"
                          : "border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400 hover:scale-105 active:scale-95"
                      }
                    `}
                    >
                      <div className="relative w-full h-full">
                        <img
                          src={pokemon.icon}
                          alt={pokemon.jp_name}
                          className="absolute inset-0 w-full h-full object-contain"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                          }}
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-80 text-white px-1 py-1 max-[500px]:px-0.5 max-[500px]:py-0.5 rounded-b-lg">
                          <div className="text-center">
                            <span
                              className={`block leading-none ${
                                pokemon.jp_name.length <= 3
                                  ? "text-[10px] max-[500px]:text-[8px]"
                                  : pokemon.jp_name.length <= 5
                                    ? "text-[9px] max-[500px]:text-[7px]"
                                    : pokemon.jp_name.length <= 7
                                      ? "text-[8px] max-[500px]:text-[6px]"
                                      : "text-[7px] max-[500px]:text-[5px]"
                              }`}
                            >
                              {pokemon.jp_name}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </div>
        );
      }

      case "moves": {
        if (!selectedPokemon) {
          return (
            <div className="text-center text-red-500">
              ポケモンデータが見つかりません
            </div>
          );
        }
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              使用した技を選択してください
            </p>

            <div>
              <label className="block text-sm font-medium mb-2">わざ1</label>
              <div className="flex gap-2">
                <button
                  onClick={() => handleMoveSelect(selectedPokemon._1a, "1")}
                  className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                    reportData.pokemon_move1 === selectedPokemon._1a
                      ? "border-green-500 bg-green-50 text-green-700 shadow-md"
                      : "border-gray-200 hover:border-green-300 hover:bg-green-50"
                  }`}
                >
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={reportData.pokemon_move1 === selectedPokemon._1a}
                      onChange={() => {}}
                      className="sr-only"
                    />
                    <span className="font-medium text-sm max-[500px]:text-xs">
                      {selectedPokemon._1a}
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => handleMoveSelect(selectedPokemon._1b, "1")}
                  className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                    reportData.pokemon_move1 === selectedPokemon._1b
                      ? "border-green-500 bg-green-50 text-green-700 shadow-md"
                      : "border-gray-200 hover:border-green-300 hover:bg-green-50"
                  }`}
                >
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={reportData.pokemon_move1 === selectedPokemon._1b}
                      onChange={() => {}}
                      className="sr-only"
                    />
                    <span className="font-medium text-sm max-[500px]:text-xs">
                      {selectedPokemon._1b}
                    </span>
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">わざ2</label>
              <div className="flex gap-2">
                <button
                  onClick={() => handleMoveSelect(selectedPokemon._2a, "2")}
                  className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                    reportData.pokemon_move2 === selectedPokemon._2a
                      ? "border-green-500 bg-green-50 text-green-700 shadow-md"
                      : "border-gray-200 hover:border-green-300 hover:bg-green-50"
                  }`}
                >
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={reportData.pokemon_move2 === selectedPokemon._2a}
                      onChange={() => {}}
                      className="sr-only"
                    />
                    <span className="font-medium text-sm max-[500px]:text-xs">
                      {selectedPokemon._2a}
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => handleMoveSelect(selectedPokemon._2b, "2")}
                  className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                    reportData.pokemon_move2 === selectedPokemon._2b
                      ? "border-green-500 bg-green-50 text-green-700 shadow-md"
                      : "border-gray-200 hover:border-green-300 hover:bg-green-50"
                  }`}
                >
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={reportData.pokemon_move2 === selectedPokemon._2b}
                      onChange={() => {}}
                      className="sr-only"
                    />
                    <span className="font-medium text-sm max-[500px]:text-xs">
                      {selectedPokemon._2b}
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        );
      }

      case "result": {
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              試合結果を選択してください
            </p>
            <div className="space-y-3">
              <button
                onClick={() => handleResultSelect("win")}
                className={`w-full p-4 rounded-lg border-2 transition-colors ${
                  reportData.result === "win"
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-gray-200 hover:border-green-300 hover:bg-green-50"
                }`}
              >
                <div className="text-lg font-bold">勝利 🏆</div>
                <div className="text-sm">おめでとうございます！</div>
              </button>

              <button
                onClick={() => handleResultSelect("lose")}
                className={`w-full p-4 rounded-lg border-2 transition-colors ${
                  reportData.result === "lose"
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-gray-200 hover:border-red-300 hover:bg-red-50"
                }`}
              >
                <div className="text-lg font-bold">敗北 😢</div>
                <div className="text-sm">次回頑張りましょう！</div>
              </button>
            </div>
          </div>
        );
      }

      case "violation": {
        // プレイヤーをチーム別に分割
        console.log(
          "MatchReportModal - violation case - matchPlayers:",
          matchPlayers
        );
        console.log(
          "MatchReportModal - violation case - current violation_report:",
          reportData.violation_report
        );
        const teamAPlayersViolation = matchPlayers.slice(0, 5);
        const teamBPlayersViolation = matchPlayers.slice(5, 10);

        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              不適切な行為をしたプレイヤーを選択してください（任意）
            </p>

            {/* 通報しないオプション */}
            <button
              onClick={() =>
                setReportData((prev) => ({ ...prev, violation_report: "" }))
              }
              className={`w-full p-3 rounded-lg border-2 transition-colors text-center ${
                reportData.violation_report === ""
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-gray-200 hover:border-green-300 hover:bg-green-50"
              }`}
            >
              通報しない
            </button>

            <div className="grid grid-cols-2 gap-4">
              {/* チームA */}
              <div>
                <h4 className="text-sm font-medium text-purple-600 mb-2 text-center">
                  チームA
                </h4>
                <div className="space-y-2">
                  {teamAPlayersViolation.map((player) => (
                    <button
                      key={player.user_id}
                      onClick={() => {
                        console.log(
                          "MatchReportModal - TeamA Player selected for violation:",
                          player.user_id,
                          player.trainer_name
                        );
                        setReportData((prev) => ({
                          ...prev,
                          violation_report: player.user_id,
                        }));
                      }}
                      className={`w-full p-2 rounded-lg border-2 transition-colors text-left ${
                        reportData.violation_report === player.user_id
                          ? "border-red-500 bg-red-50 text-red-700"
                          : "border-gray-200 hover:border-red-300 hover:bg-red-50"
                      }`}
                    >
                      <div className="font-medium text-xs">
                        {player.trainer_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {player.discord_username || "Discord未設定"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* チームB */}
              <div>
                <h4 className="text-sm font-medium text-orange-600 mb-2 text-center">
                  チームB
                </h4>
                <div className="space-y-2">
                  {teamBPlayersViolation.map((player) => (
                    <button
                      key={player.user_id}
                      onClick={() => {
                        console.log(
                          "MatchReportModal - TeamB Player selected for violation:",
                          player.user_id,
                          player.trainer_name
                        );
                        setReportData((prev) => ({
                          ...prev,
                          violation_report: player.user_id,
                        }));
                      }}
                      className={`w-full p-2 rounded-lg border-2 transition-colors text-left ${
                        reportData.violation_report === player.user_id
                          ? "border-red-500 bg-red-50 text-red-700"
                          : "border-gray-200 hover:border-red-300 hover:bg-red-50"
                      }`}
                    >
                      <div className="font-medium text-xs">
                        {player.trainer_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {player.discord_username || "Discord未設定"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-[500px]:p-3 max-[320px]:px-2 w-full max-w-md mx-4 max-[500px]:mx-2 max-h-[90vh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">{getStepTitle()}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {/* プログレスバー */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>1. BAN</span>
            <span>2. 使用</span>
            <span>3. 技</span>
            <span>4. 結果</span>
            <span>5. 通報</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${
                  {
                    banned: 20,
                    invalid_player: 100, // 無効試合の場合は完了
                    picked: 40,
                    moves: 60,
                    result: 80,
                    violation: 100,
                  }[step]
                }%`,
              }}
            />
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* ステップコンテンツ */}
        <div className="mb-6">{renderStep()}</div>

        {/* ボタン */}
        <div className="flex justify-between">
          <button
            onClick={handleBack}
            disabled={step === "banned"}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            戻る
          </button>

          {/* 次へボタンは通報画面でのみ表示 */}
          {(step === "violation" || step === "invalid_player") && (
            <button
              onClick={handleNext}
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "送信中..." : "報告完了"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
