---
trigger: model_decision
description: 使用技術の要件
---

## 技術スタック

### フロントエンド

- React (Typescript) で実装し、Vercel にデプロイする。
- Linter として、ESLint を使用すること。
- Formatter として、Prettier を使用すること。

### 認証機能

- Auth0 を採用する。

### バックエンド

- Serverless Framework を使用し、API Gateway + Lambda (Python13) + DynamoDB で実現する。
- パッケージ管理には、`uv`を使用すること。
- Linter、Formatter、TypeChecker には、`ruff`を使用すること。
- 型ヒントを必ず使用すること。

## ディレクトリ構成

```yaml
unitemate-v2/
├── .git/
├── .github/
│   └── workflows/            # CI/CD設定
│
├── frontend/                 # Reactアプリ + Netlify Functions
│   ├── node_modules/
│   ├── public/
│   ├── src/                  # Reactのソースコード (BFF) のコード
│   ├── package.json          # フロントエンドの依存関係
│   └── ...
│
├── backend/                  # Serverless Framework (Python Lambda)
│   ├── src/                  # Pythonのソースコード
│   │   ├── handlers/         # Lambdaハンドラー
│   │   │   ├── get_item.py
│   │   │   └── create_item.py
│   │   └── models/           # データモデルなど
│   ├── serverless.yml        # Serverless Frameworkの設定
│   ├── pyproject.toml        # uvの管理ファイル
│   └── ...
│
├── .gitignore
└── package.json              # (推奨) モノレポ管理ツール用
```
