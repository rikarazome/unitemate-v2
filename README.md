# Unitemate v2

ポケモンユナイト向けの対戦マッチングサービスです。レーティングシステムを用いてプレイヤーの強さを評価し、適切な対戦相手をマッチングします。

## システム構成

![システム構成図](docs/mvp/img/unitemate-v2.drawio.png)

### アーキテクチャ概要

- **フロントエンド**: React + TypeScript + Vite
- **バックエンド**: Serverless Framework (Python)

## 機能

- マッチング機能と試合結果報告
- レート計算システム
- ランキング表示
- ユーザー管理（Discord 認証）
- 管理者機能（試合結果修正）

## ローカル開発環境のセットアップ

### 前提条件

- Node.js (推奨: v18 以上)
- Python 3.12
- uv (Python パッケージ管理)

### クイックスタート

1. リポジトリをクローン

   ```bash
   git clone <repository-url>
   cd unitemate-v2
   ```

2. 開発環境をセットアップ

   ```bash
   make setup
   ```

3. 開発サーバーを起動

   ```bash
   make dev
   ```

4. ブラウザでアクセス
   - フロントエンド: `http://localhost:5173`
   - バックエンド API: `http://localhost:3000`

### 個別セットアップ

フロントエンドまたはバックエンドのみをセットアップしたい場合：

```bash
# フロントエンドのみ
make setup-frontend

# バックエンドのみ
make setup-backend
```

### 開発コマンド

```bash
# 開発環境セットアップ
make setup

# 開発サーバー起動（フロントエンド + バックエンド）
make dev

# コード品質チェック
make lint      # 全体のLintチェック
make format    # 全体のフォーマットチェック

# 個別のフロントエンド開発
cd frontend
npm run dev    # 開発サーバー
npm run build  # ビルド
npm run lint   # Lintチェック

# 個別のバックエンド開発
cd backend
npm run dev           # 開発サーバー
uv run ruff check .   # Lintチェック
uv run ruff format .  # フォーマット
npx sls deploy        # AWS Lambda デプロイ
```

## プロジェクト構造

```
unitemate-v2/
├── frontend/          # React + TypeScript フロントエンド
│   ├── src/
│   └── package.json
├── backend/           # AWS Lambda + Serverless Framework
│   ├── src/
│   │   └── handlers/
│   ├── serverless.yml
│   └── pyproject.toml
└── docs/             # ドキュメント
    └── mvp/
```

## 開発規約

### Python (バックエンド)

- パッケージ管理: `uv`
- Linter/Formatter: `ruff`
- TypeChecker: `mypy`
- 型ヒント必須

### TypeScript/React (フロントエンド)

- Linter: ESLint
- Formatter: Prettier
- React 19 + TypeScript 使用
