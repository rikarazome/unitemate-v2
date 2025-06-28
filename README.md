# Unitemate v2

ポケモンユナイト向けの対戦マッチングサービスです。レーティングシステムを用いてプレイヤーの強さを評価し、適切な対戦相手をマッチングします。

## システム構成

![システム構成図](docs/mvp/img/unitemate-v2.drawio.png)

### アーキテクチャ概要

- **フロントエンド**: React + TypeScript
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
   make start
   ```

4. ブラウザでアクセス
   - フロントエンド: `http://localhost:5173`
   - バックエンド API: `http://localhost:3000`

### コード品質チェック

```bash
make check
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
```
