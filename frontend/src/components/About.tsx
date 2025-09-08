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
            <span className="text-2xl mr-2">📜</span>
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
        <div className="bg-gradient-to-r from-orange-50 to-pink-50 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <span className="text-2xl mr-2">🎮</span>
            現在の環境と課題
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            現在、このゲームはリリースから4年が経ち、プレイ歴の浅いプレイヤーから長いプレイヤーまで幅広く遊ばれています。
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            プレイ歴の差は環境理解やマクロ・セオリーの習熟度に大きな開きを生み出し、その開きが拡大するにつれて、他プレイヤーに対する不満や不公平感を生みやすくなっているのが実情です。
          </p>
          <p className="text-gray-700 leading-relaxed font-semibold">
            大抵の場合ベテランとビギナーは同じ環境でプレイすることを望んでいません。
          </p>
        </div>

        {/* 新たな目標 */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">🚀 新たな目標</h2>
          <p className="text-lg leading-relaxed">
            そのためユナメイトでは今後、
            <strong className="text-yellow-300">
              マスターランクの一つ上のランクを疑似的に再現すること
            </strong>
            を目標に掲げます。
          </p>
        </div>

        {/* 参加条件 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <span className="text-2xl mr-2">🎯</span>
            参加基準
          </h2>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
            <p className="text-gray-700 mb-3">
              これを実現するために、ゲーム内のランクマッチにおける
              <strong className="text-blue-600">
                レート1600で貰えるシール
              </strong>
              を所持しているかどうかを基準に、プレイヤーが相応の実力を持っているかどうかを判断して、参加基準といたします。
            </p>
            <p className="text-gray-700">
              対象のシールは
              <strong className="text-blue-600">
                直近4シーズン以内のシールのみ
              </strong>
              です。
            </p>
          </div>

          <div className="bg-gray-50 rounded p-4 mb-4">
            <h3 className="font-semibold mb-2 flex items-center">
              <span className="text-lg mr-2">📌</span>例
            </h3>
            <p className="text-gray-700">
              シーズン30では、シーズン27、28、29、30のいずれかのシールの所持が参加条件となります。
            </p>
          </div>

          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4">
            <p className="text-gray-700">
              <span className="font-semibold">⚠️ ご注意：</span>
              公式レート1600に一度も到達したことがないプレイヤーは、ユナメイトを始める前に、ランクマッチで腕を磨いてから参加してください。
            </p>
          </div>
        </div>

        {/* システムの特徴 */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <span className="text-xl mr-2">⚔️</span>
              ドラフトピック形式
            </h3>
            <p className="text-gray-600 text-sm">
              公式大会で採用されているドラフトピックルールを採用。戦略的なピック&バンが楽しめます。
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <span className="text-xl mr-2">📊</span>
              独自レーティング
            </h3>
            <p className="text-gray-600 text-sm">
              Eloレーティングシステムをベースにした独自のマッチメイキングシステムを採用。
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <span className="text-xl mr-2">🏆</span>
              競技志向
            </h3>
            <p className="text-gray-600 text-sm">
              レート1600以上のプレイヤーが集まる、競技志向の高い環境を提供。
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <span className="text-xl mr-2">🤝</span>
              有志運営
            </h3>
            <p className="text-gray-600 text-sm">
              コミュニティの有志によって運営される、プレイヤーのためのシステム。
            </p>
          </div>
        </div>

        {/* 締めのメッセージ */}
        <div className="text-center bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg p-8">
          <p className="text-xl font-bold text-gray-800 mb-4">
            今後ともユナメイトをよろしくお願いいたします。
          </p>
          <button
            onClick={() => (window.location.href = "/")}
            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-3 rounded-full font-bold hover:opacity-90 transform hover:scale-105 transition-all"
          >
            トップページへ戻る
          </button>
        </div>
      </div>
    </Layout>
  );
};

export default About;
