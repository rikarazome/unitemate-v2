# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Unitemate v2 は、ポケモンユナイト向けの対戦マッチングサービスです。レーティングシステムを用いてプレイヤーの強さを評価し、適切な対戦相手をマッチングします。

## システム構成

このプロジェクトは以下の構成になっています：

- **フロントエンド** (`frontend/`): React + TypeScript + Vite
- **バックエンド** (`backend/`): AWS Lambda + Serverless Framework (Python 3.12)

## 開発コマンド

### フロントエンド (`frontend/`)

```bash
# 開発サーバー起動 (http://localhost:5173)
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

### バックエンド (`backend/`)

```bash
# ローカル開発サーバー起動 (http://localhost:3000)
npm run dev
# または
npm run start

# Python依存関係のインストール
uv sync --dev

# Python関連 (uvを使用)
uv run ruff check .
uv run ruff format .
uv run mypy .

# AWS Lambda デプロイ
npx sls deploy
```

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

## 主要機能

- マッチング機能と試合結果報告
- レート計算システム
- ランキング表示
- ユーザー管理（Discord 認証）
- 管理者機能（試合結果修正）

## データベース設計

- `users`: ユーザー情報（Discord ID、レート、試合履歴など）
- `match_queue`: マッチングキュー
- `matches`: マッチング情報と試合結果

## 重要な注意事項

### Serverless Framework / Python ランタイム

- **このプロジェクトはPython 3.12を使用する**
- Serverless IDEの診断エラーでpython3.12が対応していないと表示されることがあるが、**無視すること**
- Serverless IDEのサポートが止まっており、Python 3.12対応に追従していないだけ
- AWS Lambdaは実際にはPython 3.12をサポートしている
- `runtime: python3.12`を`python3.11`に変更してはいけない
