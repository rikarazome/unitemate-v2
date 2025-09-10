# CLAUDE.md

## はじめに

同ディレクトリの README.md をはじめに参照し、内容を理解してください。
また、docs ディレクト内に仕様書や設計書がまとまっています。

## コード規約

### Python (バックエンド)

- パッケージ管理: `uv`
- Linter/Formatter: `ruff`
- TypeChecker: `mypy`
- 型ヒント必須
- Python 3.12 対応

### TypeScript/React (フロントエンド)

- Linter: ESLint
- Formatter: Prettier
- React 19 + TypeScript
- Vite を使用したビルド

### 開発ルール

- backend ディレクトリ配下を改修した場合、backend ディレクトリ配下にて、 `make check` を実行して、コード品質を確認してください。
- frontend ディレクトリ配下を改修した場合、frontend ディレクトリ配下にて、 `make check` を実行して、コード品質を確認してください。

## システム設計情報

**重要**: システムの詳細設計仕様は `SYSTEM_DESIGN.md` に記載されています。実装前に必ずこのファイルを参照してください。

- 勲章（バッジ）システムの仕様
- マッチメイキングシステムの仕様  
- DynamoDBテーブル構成
- その他システム設計に関する全ての情報

## 重要な注意事項

### 🚨 最重要事項 - 環境名の統一

- **Production環境の略称は必ず `prod` を使用する**
- `prd` は絶対に使用しない
- ファイル名、環境変数、ブランチ名、ドキュメント等すべてで `prod` に統一
- 例: `.env.production`, `--stage prod`, `build:prod`

### Serverless Framework / Python ランタイム

- **このプロジェクトは Python 3.12 を使用する**
- Serverless IDE の診断エラーで python3.12 が対応していないと表示されることがあるが、**無視すること**
- Serverless IDE のサポートが止まっており、Python 3.12 対応に追従していないだけ
- AWS Lambda は実際には Python 3.12 をサポートしている
- `runtime: python3.12`を`python3.11`に変更してはいけない
