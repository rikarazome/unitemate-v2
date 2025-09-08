import React from "react";
import Layout from "./Layout";

const Terms: React.FC = () => {
  return (
    <Layout className="bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">利用規約</h1>

        <div className="bg-white rounded-lg shadow p-6 space-y-6 text-gray-700">
          <section>
            <p className="leading-relaxed mb-4">
              本規約は、退紅りか（以下「当社」といいます。）が提供する「ユナメイト」（以下「本サービス」といいます。）を利用される際に適用されます。ご利用にあたっては、本規約をお読みいただき、内容をご承諾の上でご利用ください。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">規約の適用</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>
                本規約は、当社が本サービスを提供する上で、利用者が本サービスの提供を受けるにあたっての諸条件を定めたものです。
              </li>
              <li>
                当社は、本サービスの提供に関して、本規約のほか、本サービスの利用に関する個別規約その他のガイドライン等を定めることがあります。この場合、当該個別規約その他のガイドライン等は、本規約の一部として利用者による本サービスの利用に優先して適用されるものとします。
              </li>
              <li>
                利用者が本サービスを利用された場合、利用者が本規約に同意したものとみなします。
              </li>
              <li>
                利用者が利用登録を行った場合、当社はID及びパスワードを発行します。
              </li>
              <li>
                利用者は、ID及びパスワードを厳重に管理し、保管するものとし、これを第三者に貸与、譲渡、売買その他の方法をもって利用させてはならないものとします。ID又はパスワードの管理が不十分なことにより、利用者が損害又は不利益を被ったとしても、当社は責任を負わないものとします。
              </li>
              <li>
                ID又はパスワードを紛失又は忘失した場合、又はこれらが第三者に使用されていることが判明した場合、利用者は、直ちにその旨を当社に通知するものとします。
              </li>
              <li>
                当社は、利用者に発行したID及びパスワードによる本サービスの利用の一切につき、利用者による真正な利用か否かにかかわらず、利用者本人の行為とみなすものとし、利用者は当該行為の結果生じる一切の責任を負担するものとします。
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">利用者投稿情報</h2>
            <p className="mb-3">
              不特定多数の利用者からアクセス及び閲覧されることを十分に理解の上、本サービスをご利用ください。利用者投稿情報については、これを行った利用者が一切の責任を負うものとします。
            </p>
            <p className="mb-2">
              利用者は以下の情報の投稿を行うことはできません。
            </p>
            <ul className="list-disc list-inside space-y-1 mb-3">
              <li>真実ではないもの</li>
              <li>わいせつな表現又はヌード等のわいせつ画像を含むもの</li>
              <li>他人の名誉又は信用を傷つけるもの</li>
              <li>
                第三者のプライバシー権、肖像権、著作権その他の権利を侵害するもの
              </li>
              <li>コンピュータウィルスを含むもの</li>
              <li>当社の認めるウェブサイト以外のウェブサイトへのリンクやURL</li>
              <li>その他当社が不適当と判断するもの</li>
            </ul>
            <p className="mb-3">
              利用者は、当社が利用者投稿情報を無償で使用することを許諾するものとします。
            </p>
            <p className="mb-3">
              当社は、利用者投稿情報の削除及び投稿の制限の理由につき、利用者に対し返答する義務を負うものではなく、削除及び制限につき、利用者に発生した損害又は不利益につき、責任を負いません。また、当社は、利用者投稿情報の削除義務を負うものではありません。
            </p>
            <p>
              利用者は、本条に係る利用者投稿情報の監視、削除及び投稿の制限について、あらかじめ同意するものとします。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">
              サービスの内容の変更、追加、停止
            </h2>
            <p className="leading-relaxed">
              当社は、利用者に事前の通知をすることなく、本サービスの内容の全部又は一部を変更、追加又は停止する場合があり、利用者はこれをあらかじめ承諾するものとします。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">個人情報</h2>
            <p className="leading-relaxed">
              当社は、利用者による本サービスの利用によって取得する個人情報を、当社のプライバシーポリシーに従い、適切に取り扱います。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">反社会的勢力の排除</h2>
            <p className="mb-2">利用者は、当社に対し、次の事項を確約します。</p>
            <ol className="list-decimal list-inside space-y-2">
              <li>
                自らが、暴力団、暴力団関係企業、総会屋若しくはこれらに準ずる者又はその構成員（以下総称して「反社会的勢力」といいます。）ではないこと。
              </li>
              <li>
                自らの役員（業務を執行する社員、取締役、執行役又はこれらに準ずる者をいいます。）が反社会的勢力ではないこと。
              </li>
              <li>
                反社会的勢力に自己の名義を利用させ、本契約を締結するものでないこと。
              </li>
              <li>
                自ら又は第三者を利用して、次の行為をしないこと。
                <ul className="list-disc list-inside ml-4 mt-2">
                  <li>相手方に対する脅迫的な言動又は暴力を用いる行為</li>
                  <li>法的な責任を超えた不当な要求行為</li>
                  <li>
                    偽計又は威力を用いて相手方の業務を妨害し、又は信用を毀損する行為
                  </li>
                </ul>
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">免責事項</h2>
            <p className="leading-relaxed mb-3">
              天災地変、戦争、テロ行為、暴動、労働争議、伝染病、法令・規則の制定・改廃、その他の不可抗力によって、本サービスの履行遅延又は履行不能が生じた場合、当社はその責任を負わないものとします。
            </p>
            <p className="mb-2">
              当社は、本サービスについて、以下の事項を保証しません。
            </p>
            <ul className="list-disc list-inside space-y-1 mb-3">
              <li>
                商品性、完全性、正確性、有用性、適法性、特定目的への適合性
              </li>
              <li>
                本サービスで提供される情報が第三者の権利を侵害しないものであること
              </li>
              <li>本サービスが将来にわたって存続し続けること</li>
            </ul>
            <p className="leading-relaxed mb-3">
              当社は、理由の如何を問わず、データ等の全部又は一部が滅失、毀損、又は改ざんされた場合に、これを復元する義務を負わないものとし、当該滅失、毀損、又は改ざんによりお客さま又は第三者に生じた損害等について一切の責任を負わないものとします。
            </p>
            <p className="leading-relaxed">
              当社は、利用者による本サービスの利用に関連して、利用者に対して責任を負う場合には、該当の商品等の価額を超えて賠償する責任を負わないものとし、また、付随的損害、間接損害、特別損害、将来の損害および逸失利益にかかる損害については、賠償する責任を負わないものとします。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">第三者との紛争</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>
                本サービスに関連して利用者と第三者間で発生した紛争については、利用者は自らの費用と責任で解決するものとし、当社は一切の責任を負わないものとします。
              </li>
              <li>
                前項に関し、当社が損害（弁護士費用を含みます。）を被った場合、利用者は当該損害を賠償するものとします。
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">権利義務の譲渡禁止</h2>
            <p className="leading-relaxed">
              利用者は、本規約に基づく契約上の地位又は本規約に基づく権利若しくは義務を第三者に譲渡又は移転することはできません。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">規約の変更</h2>
            <p className="mb-2">
              当社は、以下の事項を明示した上で、本規約を変更することができます。
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>本規約を変更する旨</li>
              <li>変更後の本規約の内容</li>
              <li>効力発生日</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">準拠法、裁判管轄</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>本規約は、日本法に準拠して解釈されます。</li>
              <li>
                当社及び利用者は、本サービスに関し、当社と利用者との間で生じた紛争の解決について、東京地方裁判所を第一審の専属的合意管轄裁判所とすることにあらかじめ合意します。
              </li>
            </ol>
          </section>
        </div>
      </div>
    </Layout>
  );
};

export default Terms;
