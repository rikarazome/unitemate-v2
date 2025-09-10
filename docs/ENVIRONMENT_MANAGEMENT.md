# 環境管理構成案

## 概要

ユナメイトv2プロジェクトの環境管理方針とベストプラクティス

## 環境構成

### 採用する環境

- **Development (dev)** - 開発環境
- **Production (prod)** - 本番環境

※ Staging環境は必要に応じて将来追加可能

## 1. フロントエンド環境管理

### 環境ファイル構成
```
frontend/
├── .env                 # 全環境共通のデフォルト値
├── .env.local           # ローカル開発用（gitignore対象）
├── .env.development     # dev環境用
├── .env.production      # prd環境用
└── .gitignore           # .env.localを除外
```

### Viteの環境変数読み込み順序
1. `.env.local` (最優先、gitignore対象)
2. `.env.development` または `.env.production`
3. `.env` (デフォルト値)

### 環境変数の命名規則
```bash
# Auth0設定
VITE_AUTH0_DOMAIN=
VITE_AUTH0_CLIENT_ID=
VITE_AUTH0_AUDIENCE=

# API設定
VITE_API_BASE_URL=
VITE_WEBSOCKET_URL=
```

### package.jsonスクリプト
```json
{
  "scripts": {
    "dev": "vite --mode development",
    "build:dev": "vite build --mode development", 
    "build:prod": "vite build --mode production"
  }
}
```

## 2. バックエンド環境管理（Serverless Framework）

### ステージ別デプロイコマンド
```bash
# 開発環境
serverless deploy --stage dev

# 本番環境
serverless deploy --stage prod
```

### serverless.yml環境変数設定
```yaml
provider:
  environment:
    STAGE: ${sls:stage}
  httpApi:
    cors:
      allowedOrigins:
        - ${env:FRONTEND_URL}  # 環境別に設定
```

## 3. ブランチ戦略

### ブランチ構成
```
main (production)     # 本番環境 - 自動デプロイ対象
├── dev              # 開発環境 - 開発用デプロイ対象  
├── feature/*        # 機能開発 - devにマージ
└── hotfix/*         # 緊急修正 - mainに直接マージ
```

### ワークフロー
1. `feature/xxx` で機能開発
2. `dev` ブランチにマージ → 開発環境に自動デプロイ
3. テスト完了後、`main` ブランチにマージ → 本番環境に自動デプロイ

## 4. デプロイ戦略

### フロントエンド (Vercel)
- **main ブランチ** → Production deployment (本番)
- **dev ブランチ** → Preview deployment (開発)
- 環境変数は Vercel Dashboard で環境別に設定

### バックエンド (AWS Lambda)
- 手動デプロイまたはCI/CDパイプラインで自動化
- ステージごとに独立したAWSリソース

## 5. セキュリティ

### 機密情報の管理
- `.env.local` は gitignore に追加（ローカル開発用）
- 本番環境の機密情報は Vercel/AWS の環境変数機能を使用
- Auth0の本番用とdev用でクライアントを分離

## 6. 実装チェックリスト

- [ ] `.env.development` と `.env.production` 作成
- [ ] `.env.local` を `.gitignore` に追加
- [ ] `package.json` にビルドスクリプト追加
- [ ] `dev` ブランチ作成
- [ ] Vercel環境変数設定（dev/prd別）
- [ ] Auth0アプリケーション設定（dev/prd別）
- [ ] serverless.yml環境変数調整

## 7. 参考リンク

- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Serverless Framework Variables](https://www.serverless.com/framework/docs/providers/aws/guide/variables)
- [Git Flow Workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow)

---

最終更新: 2025-01-09
作成者: Claude Code Assistant