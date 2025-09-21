import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { useDummyAuth } from "../hooks/useDummyAuth";
import { useProfileStore } from "../hooks/useProfileStore";
import { useUnitemateApi } from "../hooks/useUnitemateApi";
import { usePublicMasterData } from "../hooks/useUnitemateApi";
import Layout from "./Layout";
import NamePlate from "./NamePlate";

interface Badge {
  id: string;
  condition: string;
  display: string;
  start_color: string | null;
  end_color: string | null;
  char_color: string | null;
  image_card: string | null;
  banner_image: string | null;
  type: "gradient" | "image" | "basic";
  price: number;
  max_sales: number;
  current_sales: number;
}

interface ShopBadge extends Badge {
  available: boolean;
  is_sold_out: boolean;
}

const Shop: React.FC = () => {
  const { isAuthenticated, user } = useAuth0();
  const dummyAuth = useDummyAuth();
  const { completeUserData: userInfo } = useProfileStore();
  const { unitemateApi } = useUnitemateApi();
  // ショップページではAPIから直接バッジデータを取得（セキュリティ対策）
  const { masterData, loading: badgesLoading, error: badgesError } = usePublicMasterData();
  const [badges, setBadges] = useState<ShopBadge[]>([]);
  const [selectedType, setSelectedType] = useState<
    "all" | "gradient" | "image"
  >("all");
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<ShopBadge | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    // APIから取得したマスターデータを使用
    if (!badgesLoading && masterData?.badges) {
      const loadBadges = () => {
        try {
          // APIから取得したバッジデータを型変換
          const apieBadges: Badge[] = (masterData.badges || []).map((item: any) => ({
            id: item.id,
            condition: item.condition || "",
            display: item.display || "",
            start_color: item.start_color || null,
            end_color: item.end_color || null,
            char_color: item.char_color || null,
            image_card: item.image_card || null,
            banner_image: item.banner_image || null,
            type: item.type || "basic",
            price: item.price || 0,
            max_sales: item.max_sales || 0,
            current_sales: item.current_sales || 0,
          }));

          // 購入可能な勲章のみをフィルタリング
          const shopBadges: ShopBadge[] = apieBadges
            .filter((badge) => badge.condition === "支援ページから購入可能")
            .map((badge) => ({
              ...badge,
              available: true,
              is_sold_out: badge.max_sales > 0 && badge.current_sales >= badge.max_sales,
            }));

          setBadges(shopBadges);
        } catch (error) {
          console.error("Failed to load badges from API:", error);
          setBadges([]);
        }
      };

      loadBadges();
    }
  }, [masterData, badgesLoading]);


  const filteredBadges = badges.filter(
    (badge) => selectedType === "all" || badge.type === selectedType,
  );

  const getBadgePreview = (badge: ShopBadge) => {
    if (badge.type === "image" && badge.image_card) {
      return (
        <img
          src={badge.image_card}
          alt={badge.display}
          className="w-32 h-12 object-cover rounded-lg"
        />
      );
    } else if (
      badge.type === "gradient" &&
      badge.start_color &&
      badge.end_color
    ) {
      return (
        <div
          className="w-32 h-12 rounded-lg flex items-center justify-center text-white font-bold text-xs px-3 whitespace-nowrap overflow-hidden"
          style={{
            background: `linear-gradient(45deg, ${badge.start_color}, ${badge.end_color})`,
          }}
        >
          {badge.display}
        </div>
      );
    } else {
      return (
        <div className="w-32 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
          🏅
        </div>
      );
    }
  };

  const handlePurchase = (badge: ShopBadge) => {
    if (!isAuthenticated && !dummyAuth.isAuthenticated) {
      alert("購入するにはログインが必要です");
      return;
    }
    setSelectedBadge(badge);
    setShowPurchaseModal(true);
  };

  const handleStripePayment = async (badge: ShopBadge) => {
    if (!badge) return;

    setIsProcessingPayment(true);

    try {
      // ユーザー情報の取得を待つ
      let userId =
        userInfo?.user_id ||
        (dummyAuth.isAuthenticated ? dummyAuth.user?.user_id : null);
      
      // ユーザーIDが取得できていない場合は少し待つ
      if (!userId && (isAuthenticated || dummyAuth.isAuthenticated)) {
        console.log("Waiting for user info to load...");
        await new Promise(resolve => setTimeout(resolve, 1000));
        userId =
          userInfo?.user_id ||
          (dummyAuth.isAuthenticated ? dummyAuth.user?.user_id : "anonymous");
      } else if (!userId) {
        userId = "anonymous";
      }
      
      console.log("Debug - userInfo:", userInfo);
      console.log("Debug - dummyAuth:", dummyAuth);
      console.log("Debug - Final userId for checkout:", userId);
      
      if (userId === "anonymous") {
        throw new Error("ユーザー情報の取得に失敗しました。ページを再読み込みして再度お試しください。");
      }
      
      // 統一APIクライアントを使用（セキュリティ強化版）
      const responseData = await unitemateApi.createCheckoutSession({
        badgeId: badge.id,
        badgeName: badge.display,
        price: badge.price,
        userId: userId,
      });

      const { url, session_id } = responseData;

      if (!url) {
        throw new Error("No checkout URL received from server");
      }

      // セキュリティ: URLの基本検証（Stripe以外のURLにリダイレクトしないため）
      if (!url.startsWith("https://checkout.stripe.com/")) {
        throw new Error("Invalid checkout URL received");
      }

      console.log(`Redirecting to Stripe Checkout: ${session_id}`);

      // Stripe Checkoutページにリダイレクト
      window.location.href = url;
    } catch (error) {
      console.error("Payment error:", error);
      console.error("Full error object:", JSON.stringify(error, null, 2));
      
      let errorMessage = "決済処理でエラーが発生しました。";
      
      if (error instanceof Error) {
        errorMessage = error.message;
        // APIエラーの場合、追加情報を表示
        if (error.message.includes("500")) {
          errorMessage += "\n\nサーバーエラーが発生しました。開発者に連絡してください。";
          errorMessage += "\nError details: " + JSON.stringify(error);
        }
      }

      alert(`${errorMessage}\nしばらくしてからもう一度お試しください。`);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const confirmPurchase = () => {
    if (!selectedBadge) return;

    setShowPurchaseModal(false);
    handleStripePayment(selectedBadge);
  };

  return (
    <Layout className="bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* ページタイトル */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            🏅 勲章ショップ
          </h1>
          <p className="text-gray-600">
            特別な勲章を購入してプロフィールを彩ろう！
          </p>
        </div>

        {/* 注意書き */}
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-amber-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-amber-800 font-medium">
                ご購入前にお読みください
              </p>
              <p className="text-xs text-amber-700 mt-1">
                ※ 勲章付与の反映には時間がかかる場合があります。しばらく経っても反映されない場合は運営にお問い合わせください。
              </p>
            </div>
          </div>
        </div>

        {/* ユーザー情報バー（ネームプレート） */}
        {(isAuthenticated || dummyAuth.isAuthenticated) && userInfo && (
          <div className="bg-white rounded-lg shadow p-6 mb-6 flex justify-center">
            <NamePlate
              trainerName={
                userInfo.trainer_name ||
                dummyAuth.user?.trainer_name ||
                "トレーナー名未設定"
              }
              discordUsername={
                dummyAuth.user?.discord_username || user?.nickname
              }
              twitterId={userInfo.twitter_id || undefined}
              rate={userInfo.rate || dummyAuth.user?.rate || 1500}
              maxRate={userInfo.max_rate || 1500}
              avatarUrl={userInfo.discord_avatar_url || user?.picture}
              primaryBadgeId={userInfo.current_badge}
              secondaryBadgeId={userInfo.current_badge_2}
            />
          </div>
        )}

        {/* タイプフィルター */}
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex flex-wrap gap-2 sm:space-x-2 sm:gap-0">
            <button
              onClick={() => setSelectedType("all")}
              className={`px-3 py-2 sm:px-4 rounded-lg font-medium transition-colors text-xs sm:text-base flex-1 sm:flex-initial ${
                selectedType === "all"
                  ? "bg-purple-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <span className="sm:hidden">全て</span>
              <span className="hidden sm:inline">すべて</span>
            </button>
            <button
              onClick={() => setSelectedType("gradient")}
              className={`px-3 py-2 sm:px-4 rounded-lg font-medium transition-colors text-xs sm:text-base flex-1 sm:flex-initial ${
                selectedType === "gradient"
                  ? "bg-purple-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <span className="sm:hidden">🎨グラデ</span>
              <span className="hidden sm:inline">🎨 グラデーション勲章</span>
            </button>
            <button
              onClick={() => setSelectedType("image")}
              className={`px-3 py-2 sm:px-4 rounded-lg font-medium transition-colors text-xs sm:text-base flex-1 sm:flex-initial ${
                selectedType === "image"
                  ? "bg-purple-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <span className="sm:hidden">🖼️画像</span>
              <span className="hidden sm:inline">🖼️ 画像勲章</span>
            </button>
          </div>
        </div>

        {/* ローディング表示 */}
        {badgesLoading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-gray-600">勲章データを読み込み中...</p>
          </div>
        )}

        {/* エラー表示 */}
        {badgesError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            <p className="font-semibold">エラー</p>
            <p>勲章データの取得に失敗しました。ページを再読み込みしてください。</p>
          </div>
        )}

        {/* 勲章グリッド */}
        {!badgesLoading && !badgesError && (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            {filteredBadges.map((badge) => (
            <div
              key={badge.id}
              className={`bg-white rounded-lg shadow-lg overflow-hidden transition-transform hover:scale-105 ${
                !badge.available ? "opacity-60" : ""
              }`}
            >
              {/* 勲章プレビューエリア */}
              <div className="h-20 sm:h-24 md:h-32 bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center p-2 sm:p-3 md:p-4">
                <div className="scale-75 sm:scale-90 md:scale-100">
                  {getBadgePreview(badge)}
                </div>
              </div>

              {/* 勲章情報 */}
              <div className="p-2 sm:p-3 md:p-4">
                <div className="flex items-start justify-between mb-1 sm:mb-2">
                  <h3 className="font-bold text-xs sm:text-base md:text-lg leading-tight flex-1 pr-1">
                    {badge.display}
                  </h3>
                  <span className="text-[10px] sm:text-xs font-medium bg-purple-100 text-purple-600 px-1 sm:px-2 py-0.5 sm:py-1 rounded whitespace-nowrap">
                    <span className="sm:hidden">
                      {badge.type === "image" ? "画像" : "グラデ"}
                    </span>
                    <span className="hidden sm:inline">
                      {badge.type === "image" ? "画像" : "グラデーション"}
                    </span>
                  </span>
                </div>

                <p className="text-gray-600 text-[10px] sm:text-sm mb-1 sm:mb-3 leading-tight">
                  <span className="sm:hidden">特別勲章</span>
                  <span className="hidden sm:inline">
                    プロフィールに表示される特別な勲章です
                  </span>
                </p>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                  <div className="flex items-center">
                    <span className="text-sm sm:text-xl md:text-2xl font-bold text-purple-600">
                      ¥{badge.price.toLocaleString()}
                    </span>
                  </div>

                  <button
                    onClick={() => handlePurchase(badge)}
                    disabled={!badge.available || isProcessingPayment}
                    className={`px-2 py-1 sm:px-4 sm:py-2 rounded-lg font-medium transition-colors text-xs sm:text-base ${
                      badge.available && !isProcessingPayment
                        ? "bg-purple-500 text-white hover:bg-purple-600"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    <span className="sm:hidden">
                      {isProcessingPayment
                        ? "処理中"
                        : badge.available
                          ? "購入"
                          : "在庫切れ"}
                    </span>
                    <span className="hidden sm:inline">
                      {isProcessingPayment
                        ? "処理中..."
                        : badge.available
                          ? "購入"
                          : "在庫切れ"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ))}
          </div>
        )}

        {/* 購入確認モーダル */}
        {showPurchaseModal && selectedBadge && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full mx-2 sm:mx-4 max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg sm:text-xl font-bold mb-4">
                勲章購入確認
              </h2>

              <div className="mb-4">
                {/* 購入後のネームプレートプレビュー */}
                <div className="mb-4 p-3 sm:p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-3 text-center">
                    装備後のプレビュー
                  </h4>
                  <div className="flex justify-center">
                    <NamePlate
                      trainerName={
                        userInfo?.trainer_name ||
                        dummyAuth.user?.trainer_name ||
                        "トレーナー名未設定"
                      }
                      discordUsername={
                        dummyAuth.user?.discord_username || user?.nickname
                      }
                      twitterId={userInfo?.twitter_id || undefined}
                      rate={userInfo?.rate || dummyAuth.user?.rate || 1500}
                      maxRate={userInfo?.max_rate || 1500}
                      avatarUrl={
                        userInfo?.discord_avatar_url || user?.picture
                      }
                      primaryBadgeId={selectedBadge.id} // 購入予定の勲章をプライマリに設定
                      secondaryBadgeId={selectedBadge.id} // グラデーション表示のためセカンダリにも同じ勲章を設定
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-3 mb-3">
                  <div className="flex-shrink-0">
                    {getBadgePreview(selectedBadge)}
                  </div>
                  <div>
                    <h3 className="font-bold">{selectedBadge.display}</h3>
                    <p className="text-sm text-gray-600">
                      プロフィールに表示される特別な勲章
                    </p>
                    <p className="text-xs text-purple-600 mt-1">
                      {selectedBadge.type === "image"
                        ? "画像勲章"
                        : "グラデーション勲章"}
                    </p>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">価格</span>
                    <span className="text-xl font-bold text-purple-600">
                      ¥{selectedBadge.price.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                      💳 Stripeによる安全なクレジットカード決済
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowPurchaseModal(false)}
                  disabled={isProcessingPayment}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={confirmPurchase}
                  disabled={isProcessingPayment}
                  className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
                >
                  {isProcessingPayment ? "処理中..." : "Stripeで購入"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 空の状態 */}
        {filteredBadges.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              現在販売中の勲章がありません
            </p>
          </div>
        )}

        {/* フッター */}
        <div className="mt-12 pt-8 border-t border-gray-200 text-center">
          <Link
            to="/commercial"
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors underline"
          >
            特定商取引法に基づく表記
          </Link>
        </div>
      </div>
    </Layout>
  );
};

export default Shop;
