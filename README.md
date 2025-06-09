# Unitemate v2

ポケモンユナイト向けの対戦マッチングサービスです。レーティングシステムを用いてプレイヤーの強さを評価し、適切な対戦相手をマッチングします。

## システム構成

![システム構成図](docs/mvp/img/unitemate-v2.drawio.png)

### アーキテクチャ概要

- **フロントエンド**: React + TypeScript + Vite
- **バックエンド**: 
  - **Netlify Functions**: フロントエンドとの直接連携、Netlify Identityによる認証処理
  - **AWS Lambda**: データベースアクセス、管理者権限でのバックエンド処理

## 機能

- マッチング機能と試合結果報告
- レート計算システム  
- ランキング表示
- ユーザー管理（Discord認証）
- 管理者機能（試合結果修正）

## ローカル開発環境のセットアップ

### 前提条件

- Node.js (推奨: v18以上)
- Python 3.12
- uv (Pythonパッケージ管理)
- AWS CLI (バックエンド開発時)

### フロントエンド開発

1. フロントエンドディレクトリに移動
   ```bash
   cd frontend
   ```

2. 依存関係をインストール
   ```bash
   npm install
   ```

3. 開発サーバーを起動
   ```bash
   npm run dev
   ```

4. ブラウザで `http://localhost:5173` にアクセス

#### フロントエンド開発コマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# Lint
npm run lint

# フォーマット
npm run format

# プレビュー
npm run preview
```

### バックエンド開発

1. バックエンドディレクトリに移動
   ```bash
   cd backend
   ```

2. Node.js依存関係をインストール（Serverless Framework用）
   ```bash
   npm install
   ```

3. Python依存関係をインストール
   ```bash
   uv sync --dev
   ```

4. ローカル開発サーバーを起動
   ```bash
   npm run dev
   ```

5. API は `http://localhost:3000` で利用可能

#### バックエンド開発コマンド

```bash
# ローカル開発サーバー起動
npm run dev
# または
npm run start

# Python Lint
uv run ruff check .

# Python フォーマット
uv run ruff format .

# 型チェック
uv run mypy .

# AWS デプロイ
npx sls deploy
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

## データベース設計

### テーブル構成

- **users**: ユーザー情報（Discord ID、レート、試合履歴など）
- **match_queue**: マッチングキュー
- **matches**: マッチング情報と試合結果

## 開発規約

### Python (バックエンド)
- パッケージ管理: `uv`
- Linter/Formatter: `ruff`
- TypeChecker: `mypy`
- 型ヒント必須

### TypeScript/React (フロントエンド)
- Linter: ESLint
- Formatter: Prettier
- React 19 + TypeScript使用