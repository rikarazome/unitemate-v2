import React from "react";
import Layout from "./Layout";

const PrivacyPolicy: React.FC = () => {
  return (
    <Layout className="bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">
          プライバシーポリシー
        </h1>

        <div className="bg-white rounded-lg shadow p-6 space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold mb-3">
              お客様から取得する情報
            </h2>
            <p className="mb-3">当社は、お客様から以下の情報を取得します。</p>
            <ul className="list-disc list-inside space-y-1">
              <li>メールアドレス</li>
              <li>
                外部サービスでお客様が利用するID、その他外部サービスのプライバシー設定によりお客様が連携先に開示を認めた情報
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">
              お客様の情報を利用する目的
            </h2>
            <p className="mb-3">
              当社は、お客様から取得した情報を、以下の目的のために利用します。
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                当社サービスに関する登録の受付、お客様の本人確認、認証のため
              </li>
              <li>お客様の当社サービスの利用履歴を管理するため</li>
              <li>
                当社サービスにおけるお客様の行動履歴を分析し、当社サービスの維持改善に役立てるため
              </li>
              <li>当社のサービスに関するご案内をするため</li>
              <li>お客様からのお問い合わせに対応するため</li>
              <li>当社の規約や法令に違反する行為に対応するため</li>
              <li>
                当社サービスの変更、提供中止、終了、契約解除をご連絡するため
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">第三者提供</h2>
            <p className="leading-relaxed">
              当社は、お客様から取得した情報を、お客様の同意がある場合や法律に基づく場合を除いて、第三者に提供することはありません。
              （ただし、法律によって合法的に第三者提供が許されている場合を除きます。）
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">
              プライバシーポリシーの変更
            </h2>
            <p className="leading-relaxed">
              当社は、必要に応じて、このプライバシーポリシーの内容を変更します。
              この場合、変更後のプライバシーポリシーの施行時期と内容を適切な方法により周知または通知します。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">お問い合わせ</h2>
            <p className="mb-4 leading-relaxed">
              お客様の情報の開示、情報の訂正、利用停止、削除をご希望の場合は、以下のアカウントのDMまでご連絡ください。
            </p>
            <div className="bg-blue-50 rounded p-4 mb-4">
              <a
                href="https://twitter.com/rikarazome"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                twitter.com/rikarazome
              </a>
            </div>
            <p className="leading-relaxed">
              この場合、必ず、運転免許証のご提示等当社が指定する方法により、ご本人からのご請求であることの確認をさせていただきます。
              なお、情報の開示請求については、開示の有無に関わらず、ご申請時に一件あたり1,000円の事務手数料を申し受けます。
            </p>
          </section>

          <div className="mt-8 pt-6 border-t text-sm text-gray-500">
            <p>2023年09月04日 制定</p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default PrivacyPolicy;
