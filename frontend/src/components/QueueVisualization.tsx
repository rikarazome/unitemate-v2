import React, { useRef, useEffect, useCallback, useMemo } from "react";
import { LFG_ROLES, LFG_ROLE_LABELS } from "../types/lfg";
import type { LfgRole } from "../types/lfg";

// 旧RoleDataインターフェースは不要になりました

interface QueueVisualizationProps {
  role_counts?: {
    [key: string]: number;
  };
  total_waiting?: number; // バックエンドから送られる正確な待機人数
  ongoingMatches: number;
  isUserInQueue?: boolean;
  userSelectedRoles?: string[]; // ユーザーが選択したロール
  previousMatchedTime?: number; // 前回マッチ時刻（Unix timestamp）
  previousUserCount?: number; // 前回マッチ時のキュー人数
}

export const QueueVisualization: React.FC<QueueVisualizationProps> = ({
  role_counts = {},
  total_waiting = 0,
  ongoingMatches,
  isUserInQueue = false,
  userSelectedRoles = [],
  previousMatchedTime,
  previousUserCount,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const animationTime = useRef<number>(0);
  
  // 画像をプリロードして再利用するためのref
  const preloadedImages = useRef<{ [key: string]: HTMLImageElement }>({});
  interface RadarSlice {
    angle: number;
    role: LfgRole;
    count: number;
    startAngle: number;
    endAngle: number;
    color: string;
  }

  const radarRings = useRef<
    Array<{ startTime: number; radius: number; slices: RadarSlice[] }>
  >([]);
  const lastRadarTime = useRef<number>(0);

  // ロール順序定義
  const ROLE_ORDER: LfgRole[] = useMemo(
    () => [
      LFG_ROLES.TOP_LANE,
      LFG_ROLES.SUPPORT,
      LFG_ROLES.MIDDLE,
      LFG_ROLES.BOTTOM_LANE,
      LFG_ROLES.TANK,
    ],
    [],
  );

  // ロール別の色定義（サイバーパンクカラー）
  const getRoleColor = useCallback((role: LfgRole): string => {
    const colors = {
      [LFG_ROLES.TOP_LANE]: "#9d4edd", // electric purple
      [LFG_ROLES.SUPPORT]: "#ffd60a", // electric yellow
      [LFG_ROLES.MIDDLE]: "#00f5ff", // electric cyan
      [LFG_ROLES.BOTTOM_LANE]: "#ff073a", // electric red
      [LFG_ROLES.TANK]: "#39ff14", // electric green
    };
    return colors[role] || "#999999";
  }, []);

  // ロール別のアイコン取得
  const getRoleIcon = (role: LfgRole): string => {
    const icons = {
      [LFG_ROLES.TOP_LANE]: "/role_icons/role_top.png",
      [LFG_ROLES.SUPPORT]: "/role_icons/role_support.png",
      [LFG_ROLES.MIDDLE]: "/role_icons/role_mid.png",
      [LFG_ROLES.BOTTOM_LANE]: "/role_icons/role_bottom.png",
      [LFG_ROLES.TANK]: "/role_icons/role_tank.png",
    };
    return icons[role] || "";
  };

  // 画像をプリロードする関数
  const preloadImage = useCallback((src: string): HTMLImageElement | null => {
    if (preloadedImages.current[src]) {
      return preloadedImages.current[src];
    }

    const img = new Image();
    img.src = src;
    preloadedImages.current[src] = img;
    return img;
  }, []);

  // 円グラフデータの計算
  const calculatePieData = useCallback(() => {
    const roleEntries = ROLE_ORDER.map((role) => {
      return {
        role,
        count: role_counts[role] || 0,
        color: getRoleColor(role),
        label: LFG_ROLE_LABELS[role],
      };
    });

    const totalEntries = roleEntries.reduce(
      (sum, entry) => sum + entry.count,
      0,
    );
    const uniquePlayerCount = total_waiting; // バックエンドから送られる正確なユニークプレイヤー数

    // 各ロールの角度を計算
    let currentAngle = -Math.PI / 2;
    const pieSlices = roleEntries.map((entry) => {
      const percentage = totalEntries > 0 ? entry.count / totalEntries : 0;
      const angle = percentage * 2 * Math.PI;
      const slice = {
        ...entry,
        percentage,
        startAngle: currentAngle,
        endAngle: currentAngle + angle,
        angle,
      };
      currentAngle += angle;
      return slice;
    });

    return { pieSlices, totalEntries, uniquePlayerCount };
  }, [role_counts, getRoleColor, ROLE_ORDER]);

  // グリッドパターンの描画
  const drawGrid = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) => {
    const gridSize = 30;
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 1;

    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  };

  // レーダーリングの更新
  const updateRadarRings = (
    currentTime: number,
    pieRadius: number,
    pieSlices: Array<{
      role: LfgRole;
      count: number;
      color: string;
      label: string;
      percentage: number;
      startAngle: number;
      endAngle: number;
      angle: number;
    }>,
  ) => {
    // 3秒間隔でレーダーリングを生成（鼓動をイメージ）
    if (currentTime - lastRadarTime.current > 3000) {
      const activeSlices = pieSlices.filter((slice) => slice.count > 0);
      if (activeSlices.length > 0) {
        // 円グラフと同じ比率のスライスデータをコピー
        radarRings.current.push({
          startTime: currentTime,
          radius: pieRadius, // 円グラフの外側から開始
          slices: activeSlices.map((slice) => ({ ...slice })),
        });
        lastRadarTime.current = currentTime;
      }
    }

    // 既存のリングを更新し、画面外に出たものを削除（スピードアップ）
    radarRings.current = radarRings.current.filter((ring) => {
      const elapsed = currentTime - ring.startTime;
      ring.radius = pieRadius + (elapsed / 1000) * 120; // 1秒で120px拡大（より速く）
      return ring.radius <= pieRadius + 200;
    });
  };

  // 凡例の描画
  const drawLegend = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      pieSlices: Array<{
        role: LfgRole;
        count: number;
        color: string;
        label: string;
        percentage: number;
        startAngle: number;
        endAngle: number;
        angle: number;
      }>,
      ongoingMatches: number,
    ) => {
      // 画面幅に応じてボックスサイズを調整
      const isVeryNarrow = width < 400;
      const boxWidth = isVeryNarrow ? 90 : 120;
      const boxHeight = isVeryNarrow ? 38 : 45;
      const padding = isVeryNarrow ? 4 : 8;

      // オリンピック配置: 上段3個、下段2個
      const topRowCols = 3;
      const bottomRowCols = 2;
      
      const topRowWidth = topRowCols * boxWidth + (topRowCols - 1) * padding;
      const bottomRowWidth = bottomRowCols * boxWidth + (bottomRowCols - 1) * padding;
      
      // 320px幅でも収まるように最大幅制限
      const maxAllowedWidth = width - 20; // 左右10pxずつマージン
      let actualBoxWidth = boxWidth;
      let actualPadding = padding;
      
      if (topRowWidth > maxAllowedWidth) {
        // 上段が収まらない場合、ボックス幅とパディングを調整
        actualBoxWidth = Math.floor((maxAllowedWidth - (topRowCols - 1) * 2) / topRowCols);
        actualPadding = 2;
      }
      
      const actualTopRowWidth = topRowCols * actualBoxWidth + (topRowCols - 1) * actualPadding;
      const actualBottomRowWidth = bottomRowCols * actualBoxWidth + (bottomRowCols - 1) * actualPadding;
      
      const totalHeight = 2 * boxHeight + actualPadding;
      
      const topRowStartX = (width - actualTopRowWidth) / 2;
      const bottomRowStartX = (width - actualBottomRowWidth) / 2;
      const startY = height - totalHeight - 20;

      // 5つのロールのみ（進行中試合数は上部に移動）
      const items = [
        ...ROLE_ORDER.map((role) => {
          const slice = pieSlices.find((s) => s.role === role);
          return {
            type: "role",
            role,
            count: slice?.count || 0,
            color: getRoleColor(role),
            label: LFG_ROLE_LABELS[role],
            icon: getRoleIcon(role),
          };
        }),
      ];

      items.forEach((item, index) => {
        let x, y;
        
        if (index < 3) {
          // 上段 (0, 1, 2)
          const col = index;
          x = topRowStartX + col * (actualBoxWidth + actualPadding);
          y = startY;
        } else {
          // 下段 (3, 4)
          const col = index - 3;
          x = bottomRowStartX + col * (actualBoxWidth + actualPadding);
          y = startY + boxHeight + actualPadding;
        }

        // ユーザーが選択したロールかチェック
        const isSelectedRole = userSelectedRoles.includes(item.role || "");

        // ボックスの背景
        ctx.fillStyle = item.count > 0 ? "rgba(0, 0, 0, 0.8)" : "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(x, y, actualBoxWidth, boxHeight);

        // ボーダー（選択ロールは太くして光らせる）
        if (isSelectedRole) {
          // 外側のグロー効果
          ctx.save();
          ctx.shadowColor = item.color;
          ctx.shadowBlur = 8;
          ctx.strokeStyle = item.color;
          ctx.lineWidth = 3;
          ctx.strokeRect(x, y, actualBoxWidth, boxHeight);
          ctx.restore();

          // 内側の明るいボーダー
          const gradient = ctx.createLinearGradient(
            x,
            y,
            x + actualBoxWidth,
            y + boxHeight,
          );
          gradient.addColorStop(0, item.color);
          gradient.addColorStop(0.5, `${item.color}88`);
          gradient.addColorStop(1, item.color);
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, y + 1, actualBoxWidth - 2, boxHeight - 2);
        } else {
          ctx.strokeStyle = item.color;
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, actualBoxWidth, boxHeight);
        }

        // 背景パターン（アクティブな場合）
        if (item.count > 0) {
          ctx.save();
          ctx.globalAlpha = 0.1;
          const gradient = ctx.createLinearGradient(
            x,
            y,
            x + actualBoxWidth,
            y + boxHeight,
          );
          gradient.addColorStop(0, item.color);
          gradient.addColorStop(1, "transparent");
          ctx.fillStyle = gradient;
          ctx.fillRect(x, y, actualBoxWidth, boxHeight);
          ctx.restore();
        }

        // ロールアイコン（サイズと位置を画面幅に応じて調整）
        const iconSize = isVeryNarrow ? 14 : 18;
        const iconOffset = 4;
        if (item.icon) {
          const iconImg = preloadImage(item.icon);
          if (iconImg && iconImg.complete) {
            ctx.drawImage(iconImg, x + iconOffset, y + iconOffset, iconSize, iconSize);
          }
        }

        // ヘキサゴンインジケーター
        const hexX = x + (isVeryNarrow ? 22 : 30);
        const hexY = y + (isVeryNarrow ? 12 : 15);
        const hexSize = isVeryNarrow ? 4 : 5;

        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          const pointX = hexX + hexSize * Math.cos(angle);
          const pointY = hexY + hexSize * Math.sin(angle);
          if (i === 0) ctx.moveTo(pointX, pointY);
          else ctx.lineTo(pointX, pointY);
        }
        ctx.closePath();
        ctx.fillStyle = item.color;
        ctx.fill();

        // ラベル（フォントサイズと位置を調整）
        const fontSize = isVeryNarrow ? 8 : 10;
        const labelX = x + (isVeryNarrow ? 28 : 38);
        const labelY = y + (isVeryNarrow ? 14 : 18);
        ctx.font = `bold ${fontSize}px 'Courier New', monospace`;
        ctx.fillStyle = item.color;
        ctx.textAlign = "left";
        ctx.fillText(item.label, labelX, labelY);

        // カウント
        const countFontSize = isVeryNarrow ? 7 : 9;
        const countY = y + (isVeryNarrow ? 26 : 30);
        ctx.font = `${countFontSize}px 'Courier New', monospace`;
        ctx.fillStyle = "#888888";
        ctx.fillText(`${item.count}人`, labelX, countY);
      });
    },
    [ROLE_ORDER, getRoleColor, userSelectedRoles],
  );

  // 時刻フォーマット関数
  const formatTime = useCallback((unixTime: number | undefined | null) => {
    // undefinedやnullの場合は「なし」を返す
    if (unixTime === undefined || unixTime === null) return "なし";
    
    // 0も含めて、数値の場合は日時を表示
    const date = new Date(unixTime * 1000);
    
    // 月日と時刻を正確に表示
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${month}月${day}日 ${hours}:${minutes}`;
  }, []);

  // 円グラフの描画
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const displayWidth = canvas.offsetWidth;
    const displayHeight = 600; // 高さを増やして凡例スペース確保
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    animationTime.current += 0.02;
    const currentTime = performance.now();

    // 背景（真っ黒）
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // グリッドパターン
    drawGrid(ctx, canvas.width, canvas.height);

    // 前回マッチ情報の描画（グラフ上部）- 常に表示
    ctx.save();
    
    // 背景ボックス（幅を画面サイズに応じて動的調整）
    const maxBoxWidth = Math.min(400, canvas.width - 40); // 最大400px、左右20pxずつマージン
    const minBoxWidth = 280;
    const boxWidth = Math.max(minBoxWidth, maxBoxWidth);
    const boxHeight = 80;
    const boxX = (canvas.width - boxWidth) / 2;
    const boxY = 30;
    
    // 半透明の黒背景
    ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    
    // ボーダー
    ctx.strokeStyle = "#00f5ff";
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
    
    // テキスト設定
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    // 前回マッチ時刻
    ctx.font = "13px 'Courier New', monospace";
    ctx.fillStyle = "#00f5ff";
    const matchTimeText = formatTime(previousMatchedTime);
    ctx.fillText(`前回マッチ時刻: ${matchTimeText}`, canvas.width / 2, boxY + 18);
    
    // 前回参加人数
    ctx.font = "11px 'Courier New', monospace";
    ctx.fillStyle = "#ffd60a";
    const userCountText = previousUserCount !== undefined && previousUserCount !== null 
      ? `${previousUserCount}人` 
      : "0人";
    ctx.fillText(`前回参加人数: ${userCountText}`, canvas.width / 2, boxY + 38);
    
    // 進行中試合数
    ctx.font = "11px 'Courier New', monospace";
    ctx.fillStyle = "#ff8c00";
    ctx.fillText(`進行中試合数: ${ongoingMatches}試合`, canvas.width / 2, boxY + 58);
    
    ctx.restore();

    const { pieSlices, uniquePlayerCount } = calculatePieData();

    if (uniquePlayerCount === 0) {
      // データがない場合も凡例は表示
      drawLegend(ctx, canvas.width, canvas.height, pieSlices, ongoingMatches);
      return;
    }

    // 円グラフの中心と動的半径
    const centerX = canvas.width / 2;
    
    // 凡例の位置を計算して、その中間に円グラフを配置
    const legendBoxHeight = canvas.width < 400 ? 38 : 45;
    const legendPadding = canvas.width < 400 ? 4 : 8;
    const totalLegendHeight = 2 * legendBoxHeight + legendPadding;
    const legendStartY = canvas.height - totalLegendHeight - 20;
    const legendCenterY = legendStartY + totalLegendHeight / 2;
    
    // 上部情報ボックスの下端
    const topBoxBottom = 30 + 80; // boxY + boxHeight
    
    // 上部ボックスの下端と凡例の上端の間に円グラフを配置
    const centerY = (topBoxBottom + legendStartY) / 2;

    const minRadius = 30;
    const maxBaseRadius = Math.min(centerX, centerY - 50) * 0.8;
    const targetRadius =
      uniquePlayerCount <= 15
        ? minRadius +
          ((maxBaseRadius - minRadius) * (uniquePlayerCount - 1)) / 14
        : maxBaseRadius + (uniquePlayerCount - 15) * 20;

    const radius = Math.max(minRadius, targetRadius);

    // レーダーリングの更新と描画（円の外側から）
    updateRadarRings(currentTime, radius, pieSlices);

    radarRings.current.forEach((ring) => {
      if (ring.radius > radius) {
        const alpha = Math.max(0, 1 - (ring.radius - radius) / 100);

        // 各スライスを個別に描画
        ring.slices.forEach((slice) => {
          ctx.beginPath();
          ctx.arc(
            centerX,
            centerY,
            ring.radius,
            slice.startAngle,
            slice.endAngle,
          );
          // 広がるにつれて薄くなる効果を強化
          const fadeAlpha = alpha * 0.5; // もう少し濃く

          // 広がるほどぼやけるブラー効果
          const blurAmount = Math.pow(1 - alpha, 2) * 6; // より遅くぼやける、最大6pxのブラー
          ctx.save();
          ctx.filter = `blur(${blurAmount}px)`;

          // 16進数カラーをrgbaに変換
          const hexColor = slice.color;
          const r = parseInt(hexColor.slice(1, 3), 16);
          const g = parseInt(hexColor.slice(3, 5), 16);
          const b = parseInt(hexColor.slice(5, 7), 16);

          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${fadeAlpha})`;
          ctx.lineWidth = Math.max(1, 3 - (1 - alpha) * 2); // 線の太さも外側に行くほど細く
          ctx.stroke();

          ctx.restore();
        });
      }
    });

    // メイン円グラフの描画
    pieSlices.forEach((slice) => {
      if (slice.count > 0) {
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, slice.startAngle, slice.endAngle);
        ctx.closePath();

        const gradient = ctx.createRadialGradient(
          centerX,
          centerY,
          0,
          centerX,
          centerY,
          radius,
        );
        gradient.addColorStop(0, slice.color + "40");
        gradient.addColorStop(0.7, slice.color + "AA");
        gradient.addColorStop(1, slice.color);

        ctx.fillStyle = gradient;
        ctx.fill();

        // 境界線
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, slice.startAngle, slice.endAngle);
        ctx.closePath();
        ctx.strokeStyle = slice.color;
        ctx.lineWidth = 3;
        ctx.stroke();

        // 外側のリング
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + 5, slice.startAngle, slice.endAngle);
        ctx.strokeStyle = slice.color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // 中央のサークル（六角形から変更）
    const innerRadius = Math.min(radius * 0.3, 60);

    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
    ctx.fillStyle = "#000000";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 待機人数表示（白色）
    ctx.font = "bold 28px 'Courier New', monospace";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${uniquePlayerCount}`, centerX, centerY - 5);

    // マッチング状態表示
    ctx.font = "12px 'Courier New', monospace";
    if (isUserInQueue) {
      const glowIntensity = (Math.sin(animationTime.current * 3) + 1) / 2;
      ctx.save();
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 10 + glowIntensity * 5;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.7 + glowIntensity * 0.3})`;
      ctx.fillText("MATCHING", centerX, centerY + 15);
      ctx.restore();
    } else {
      ctx.fillStyle = "#888888";
      ctx.fillText("WAITING", centerX, centerY + 15);
    }

    // 凡例の描画
    drawLegend(ctx, canvas.width, canvas.height, pieSlices, ongoingMatches);
  }, [calculatePieData, ongoingMatches, isUserInQueue, drawLegend, previousMatchedTime, previousUserCount, formatTime]);

  // メインループ
  const loop = useCallback(() => {
    render();
    animationFrameRef.current = requestAnimationFrame(loop);
  }, [render]);

  // コンポーネントマウント時にアニメーション開始
  useEffect(() => {
    loop();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [loop]);

  return (
    <div className="w-full -mx-2 sm:mx-0">
      <canvas
        ref={canvasRef}
        className="w-full max-w-4xl min-w-[300px] block mx-auto rounded-lg"
        style={{
          height: "600px",
          backgroundColor: "#000000",
        }}
      />
    </div>
  );
};
