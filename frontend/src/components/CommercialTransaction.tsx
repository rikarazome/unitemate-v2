import React from "react";
import Layout from "./Layout";

const CommercialTransaction: React.FC = () => {
  return (
    <Layout className="bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">
          特定商取引法に基づく表記
        </h1>

        <div className="bg-white rounded-lg shadow p-6 space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold mb-3">事業者の名称</h2>
            <p className="leading-relaxed">ユナメイト</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">
              代表者又は通信販売に関する業務の責任者の氏名
            </h2>
            <p className="leading-relaxed">長谷川力丸</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">住所</h2>
            <p className="leading-relaxed">
              467-0828 愛知県名古屋市瑞穂区田光町1‐24
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">電話番号</h2>
            <p className="leading-relaxed">09077360725</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">メールアドレス</h2>
            <div className="bg-blue-50 rounded p-4">
              <a
                href="mailto:rikimarh@gmail.com"
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                rikimarh@gmail.com
              </a>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">
              商品の販売価格・サービスの対価
            </h2>
            <p className="leading-relaxed">
              各商品・サービスのご購入ページにて表示する価格
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">
              対価以外に必要となる費用
            </h2>
            <p className="leading-relaxed">なし</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">支払方法</h2>
            <p className="leading-relaxed">クレジットカード</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">代金の支払時期</h2>
            <p className="leading-relaxed">
              クレジットカード：ご注文時にお支払いが確定いたします。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">
              商品引き渡し又はサービスの提供の時機
            </h2>
            <div>
              <h3 className="font-medium mb-2">【役務・サービスについて】</h3>
              <p className="leading-relaxed">
                所定の手続き終了後、直ちにご利用いただけます。
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">
              返品・キャンセルに関する特約
            </h2>
            <p className="leading-relaxed mb-3">
              本サービスで販売する商品・サービスについては、当社が別途定める場合を除き、購入手続き完了後の返品又はキャンセルをお受けいたしません。
              なお、商品・サービスに欠陥・不良がある場合は、利用規約の定めに従って対応します。
            </p>
            <p className="leading-relaxed mb-3">
              商品がソフトウェアの場合、動作環境及びスペックはご購入ページで表示いたします。
            </p>
            <p className="leading-relaxed">
              特別な販売条件又は提供条件がある商品又はサービスについては、各商品又はサービスの購入ページにおいて条件を表示します。
            </p>
          </section>
        </div>
      </div>
    </Layout>
  );
};

export default CommercialTransaction;
