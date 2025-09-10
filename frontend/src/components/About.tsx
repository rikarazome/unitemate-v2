import React from "react";
import Layout from "./Layout";

const About: React.FC = () => {
  return (
    <Layout className="bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold text-gray-800 mb-8 text-center">
          ユナメイトとは
        </h1>

        {/* メインメッセージ */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <p className="text-lg text-gray-700 leading-relaxed mb-4">
            ユナメイトは、有志によって制作、運営されている、ポケモンユナイトのドラフトピック形式のランクマッチシステムです。
          </p>
        </div>

        {/* 歴史と背景 */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <span className="text-lg mr-2">📜</span>
            ユナメイトの歴史
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            ユナメイトは設立当初、公式大会で使われるドラフトピックルールを遊べる場所が限られていたため、初心者もふくめ誰でも歓迎を謳っていました。
          </p>
          <p className="text-gray-700 leading-relaxed">
            それから二年ほど経ち、ランクマッチのシステムや環境が改善傾向にある今、ユナメイトが新たに目指すべきところは
            <strong className="text-blue-600">
              ベテランとビギナーの棲み分け
            </strong>
            です。
          </p>
        </div>

        {/* 現状の課題 */}
        <div className="bg-gray-50 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <span className="text-lg mr-2">🎮</span>
            現在の環境と課題
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            現在、このゲームはリリースから4年が経ち、初心者からプロプレイヤーまで幅広いプレイヤー層に遊ばれています。
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            プレイ歴や熟練度の差は当然勝敗に大きく影響し、その差が拡大するにつれて、他プレイヤーに対する不満や不公平感を生みやすくなっているのが実情です。
          </p>
          <p className="text-gray-700 leading-relaxed font-semibold">
            大抵の場合、ベテランとビギナーは同じ環境でプレイすることを望んでいません。
          </p>
        </div>

        {/* 新たな目標 */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">新たな目標</h2>
          <p className="text-gray-700 leading-relaxed">
            そのためユナメイトでは今後、
            <strong className="text-gray-800">
              マスターランクの一つ上のランクを疑似的に再現すること
            </strong>
            を目標に掲げます。
          </p>
        </div>

        {/* 参加条件 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <span className="text-lg mr-2">🎯</span>
            参加基準
          </h2>

          <p className="text-gray-700 mb-4">
            これを実現するために、ゲーム内のランクマッチにおける
            <strong className="text-gray-800">レート1600で貰えるシール</strong>
            を所持しているかどうかを基準に、プレイヤーが相応の実力を持っているかどうかを判断して、参加基準といたします。
          </p>
          <p className="text-gray-700 mb-4">
            対象のシールは
            <strong className="text-gray-800">
              直近4シーズン以内のシールのみ
            </strong>
            です。
          </p>

          <p className="text-gray-700 mb-4">
            <strong>例：</strong>{" "}
            シーズン30では、シーズン27、28、29、30のいずれかのシールの所持が参加条件となります。
          </p>

          <p className="text-gray-700">
            公式レート1600に一度も到達したことがないプレイヤーは、ユナメイトを始める前に、ランクマッチで腕を磨いてから参加してください。
          </p>
        </div>

        {/* システムの特徴 */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <span className="text-base mr-2">⚔️</span>
              公式大会準拠のルール
            </h3>
            <p className="text-gray-600 text-sm">
              公式大会で採用されているルールを採用。戦略的なピック&バンが楽しめます。
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <span className="text-base mr-2">📊</span>
              独自レーティング
            </h3>
            <p className="text-gray-600 text-sm">
              Eloレーティングシステムをベースにした独自のマッチメイキングシステムを採用。
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <span className="text-base mr-2">🏆</span>
              競技志向
            </h3>
            <p className="text-gray-600 text-sm">
              レート1600以上のプレイヤーが集まる、競技志向の高い環境を提供。
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <span className="text-base mr-2">🤝</span>
              コミュニケーション
            </h3>
            <p className="text-gray-600 text-sm">
              Discordを用いたコミュニティの活性化や、VCでチーム連携のとれる試合を提供。
            </p>
          </div>
        </div>

        {/* 締めのメッセージ */}
        <div className="text-center bg-gray-50 rounded-lg p-6">
          <p className="text-lg text-gray-700 mb-4">
            今後ともユナメイトをよろしくお願いいたします。
          </p>
          <button
            onClick={() => (window.location.href = "/")}
            className="bg-blue-600 text-white px-6 py-2 rounded font-medium hover:bg-blue-700 transition-colors"
          >
            トップページへ戻る
          </button>
        </div>
      </div>
    </Layout>
  );
};

export default About;
