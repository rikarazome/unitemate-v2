# フロントエンド用Makefile
.PHONY: start install check help

# デフォルトターゲット
.DEFAULT_GOAL := start

# 開発サーバー起動
start:
	npm run dev

# 依存関係インストール
install:
	npm install

# 全てのチェック（lint + format）
check:
	npm run lint
	npm run format

# ヘルプ
help:
	@echo "使用可能なコマンド:"
	@echo "  make start    - 開発サーバー起動 (http://localhost:5173)"
	@echo "  make install  - 依存関係のインストール"
	@echo "  make check    - lint と format の実行"
