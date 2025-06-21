# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Unitemate v2 は、ポケモンユナイト向けの対戦マッチングサービスです。レーティングシステムを用いてプレイヤーの強さを評価し、適切な対戦相手をマッチングします。

## システム構成

このプロジェクトは以下の構成になっています：

- **フロントエンド** (`frontend/`): React + TypeScript + Vite
- **バックエンド** (`backend/`): AWS Lambda + Serverless Framework (Python 3.12)

## 開発コマンド

**重要: 全ての開発コマンドは Makefile に統一されています。以下の make コマンドを使用してください。**

### 全体管理（ルートディレクトリ）

```bash
# 開発環境セットアップ
make setup

# 開発サーバー起動（フロント + バック同時）
make dev

# 品質チェック（lint + format + typecheck + build）
make check

# AWS Lambdaデプロイ
make deploy

# 使用可能なコマンド一覧
make help
```

### フロントエンド単体 (`frontend/`)

```bash
# 開発サーバー起動 (http://localhost:5173)
make dev

# ビルド
make build

# Lint
make lint

# フォーマット
make format

# 全体のヘルプ
make help
```

### バックエンド単体 (`backend/`)

```bash
# ローカル開発サーバー起動 (http://localhost:3000)
make dev
# または
make start

# Python依存関係のインストール
make install

# Python関連チェック
make lint      # ruff check
make format    # ruff format
make typecheck # mypy

# 全体チェック
make check

# AWS Lambda デプロイ
make deploy

# 全体のヘルプ
make help
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

- **このプロジェクトは Python 3.12 を使用する**
- Serverless IDE の診断エラーで python3.12 が対応していないと表示されることがあるが、**無視すること**
- Serverless IDE のサポートが止まっており、Python 3.12 対応に追従していないだけ
- AWS Lambda は実際には Python 3.12 をサポートしている
- `runtime: python3.12`を`python3.11`に変更してはいけない
