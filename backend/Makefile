# バックエンド用Makefile
.PHONY: start install check deploy help

# デフォルトターゲット
.DEFAULT_GOAL := start

# ローカル開発サーバー起動
start:
	npm run start

# Python依存関係のインストール（開発環境含む）
install:
	uv venv
	uv sync --extra dev
	npm install
	sls dynamodb install
	sls dynamodb migrate

# lint & formatチェック
check:
	uv run ruff check .
	uv run ruff format .

# AWS Lambda デプロイ
deploy:
	uv pip compile pyproject.toml -o requirements.txt
	sls deploy -s prd
	rm requirements.txt

# ヘルプ
help:
	@echo "使用可能なコマンド:"
	@echo "  make start         - ローカル開発サーバー起動 (http://localhost:3000)"
	@echo "  make install       - Python依存関係をインストール"
	@echo "  make check         - lint + format の実行"
	@echo "  make deploy        - AWS Lambdaにデプロイ"
