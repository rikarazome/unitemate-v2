# フロントエンド用Makefile
.PHONY: dev build lint format preview install clean

# デフォルトターゲット
.DEFAULT_GOAL := dev

# 開発サーバー起動
dev:
	npm run dev

# ビルド
build:
	npm run build

# Lint
lint:
	npm run lint

# フォーマット
format:
	npm run format

# プレビュー
preview:
	npm run preview

# 依存関係インストール
install:
	npm install

# クリーンアップ
clean:
	rm -rf node_modules dist

# 全てのチェック（lint + build）
check: lint build

# 開発環境セットアップ
setup: install
	@echo "フロントエンド開発環境のセットアップが完了しました"

# ヘルプ
help:
	@echo "使用可能なコマンド:"
	@echo "  make dev      - 開発サーバー起動 (http://localhost:5173)"
	@echo "  make build    - プロダクションビルド"
	@echo "  make lint     - ESLintでコードチェック"
	@echo "  make format   - Prettierでコード整形"
	@echo "  make preview  - ビルド結果のプレビュー"
	@echo "  make install  - 依存関係のインストール"
	@echo "  make clean    - 生成ファイルの削除"
	@echo "  make check    - lint + build の実行"
	@echo "  make setup    - 開発環境のセットアップ"