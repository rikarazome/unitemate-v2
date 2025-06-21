# バックエンド用Makefile
.PHONY: dev start install sync lint format typecheck check deploy clean logs

# デフォルトターゲット
.DEFAULT_GOAL := dev

# ローカル開発サーバー起動
dev:
	npm run dev

# ローカル開発サーバー起動（別名）
start:
	npm run start

# Python依存関係のインストール（開発環境含む）
install:
	uv sync --dev

# Python依存関係の同期
sync:
	uv sync --dev

# Lint
lint:
	uv run ruff check .

# フォーマット
format:
	uv run ruff format .

# 型チェック
typecheck:
	uv run mypy .

# 全てのチェック（lint + format + typecheck）
check:
	uv run ruff check .
	uv run ruff format .
	uv run mypy .

# AWS Lambda デプロイ
deploy:
	npx sls deploy

# デプロイログの確認
logs:
	npx sls logs -f auth --tail

# クリーンアップ
clean:
	rm -rf node_modules .serverless
	uv cache clean

# 開発環境セットアップ
setup: install
	npm install
	@echo "バックエンド開発環境のセットアップが完了しました"

# DynamoDB ローカルのセットアップ
dynamodb-setup:
	npx sls dynamodb install

# ヘルプ
help:
	@echo "使用可能なコマンド:"
	@echo "  make dev           - ローカル開発サーバー起動 (http://localhost:3000)"
	@echo "  make start         - ローカル開発サーバー起動 (devの別名)"
	@echo "  make install       - Python依存関係をインストール"
	@echo "  make sync          - Python依存関係を同期"
	@echo "  make lint          - ruffでコードチェック"
	@echo "  make format        - ruffでコード整形"
	@echo "  make typecheck     - mypyで型チェック"
	@echo "  make check         - lint + format + typecheck の実行"
	@echo "  make deploy        - AWS Lambdaにデプロイ"
	@echo "  make logs          - デプロイログの確認"
	@echo "  make clean         - 生成ファイルの削除"
	@echo "  make setup         - 開発環境のセットアップ"
	@echo "  make dynamodb-setup - DynamDB ローカルのセットアップ"