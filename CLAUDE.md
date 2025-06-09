# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Unitemate v2 は、ポケモンユナイト向けの対戦マッチングサービスです。レーティングシステムを用いてプレイヤーの強さを評価し、適切な対戦相手をマッチングします。

## システム構成

このプロジェクトは以下の構成になっています：

- **フロントエンド** (`frontend/`): React + TypeScript + Vite
- **バックエンド** (`backend/`): AWS Lambda + Serverless Framework (Python 3.12)
- **アーキテクチャ**: 
  - Netlify Functions: フロントエンドとの直接連携、認証処理
  - AWS Lambda: データベースアクセス、管理者権限でのバックエンド処理

## 開発コマンド

### フロントエンド (`frontend/`)

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

### バックエンド (`backend/`)

```bash
# ローカル開発サーバー起動
npm run dev
# または
npm run start

# Python関連 (uvを使用)
uv sync --dev
uv run ruff check .
uv run ruff format .
uv run mypy .
```

## コード規約

### Python (バックエンド)
- パッケージ管理: `uv`
- Linter/Formatter: `ruff`
- TypeChecker: `mypy`
- 型ヒント必須
- Python 3.12対応

### TypeScript/React (フロントエンド)
- Linter: ESLint
- Formatter: Prettier
- React 19 + TypeScript
- Viteを使用したビルド

## 主要機能

- マッチング機能と試合結果報告
- レート計算システム
- ランキング表示
- ユーザー管理（Discord認証）
- 管理者機能（試合結果修正）

## データベース設計

- `users`: ユーザー情報（Discord ID、レート、試合履歴など）
- `match_queue`: マッチングキュー
- `matches`: マッチング情報と試合結果