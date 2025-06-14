# Makefile for unitemate-v2

.PHONY: lint lint-backend lint-frontend format format-backend format-frontend help

# ==============================================================================
# Lint Commands
# ==============================================================================

## Run all linters
lint: lint-backend lint-frontend

## Run backend linters (ruff check)
lint-backend:
	@echo "Running backend linters..."
	@cd backend && uv run ruff check .

## Run frontend linters (eslint)
lint-frontend:
	@echo "Running frontend linters..."
	@cd frontend && npm run lint

# ==============================================================================
# Format Check Commands
# ==============================================================================

## Run all format checkers
format: format-backend format-frontend

## Run backend format checker (ruff format --check)
format-backend:
	@echo "Checking backend formatting..."
	@cd backend && uv run ruff format --check .

## Run frontend format checker (prettier --check)
format-frontend:
	@echo "Checking frontend formatting..."
	@cd frontend && npx prettier --check .

# ==============================================================================
# Help
# ==============================================================================

## Show help
help:
	@echo "Available commands:"
	@echo "  lint             - Run all linters (backend and frontend)"
	@echo "  lint-backend     - Run backend linters (ruff check)"
	@echo "  lint-frontend    - Run frontend linters (eslint)"
	@echo "  format           - Run all format checkers (backend and frontend)"
	@echo "  format-backend   - Run backend format checker (ruff format --check)"
	@echo "  format-frontend  - Run frontend format checker (prettier --check)"
	@echo "  help             - Show this help message"
