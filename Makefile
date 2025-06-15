# Makefile for unitemate-v2

.PHONY: setup setup-frontend setup-backend dev lint lint-backend lint-frontend format format-backend format-frontend help

# ==============================================================================
# Setup Commands
# ==============================================================================

## Setup both frontend and backend development environments
setup: setup-frontend setup-backend

## Setup frontend development environment
setup-frontend:
	@echo "Setting up frontend development environment..."
	@cd frontend && npm install

## Setup backend development environment
setup-backend:
	@echo "Setting up backend development environment..."
	@cd backend && npm install && uv sync --dev

# ==============================================================================
# Development Commands
# ==============================================================================

## Start development servers (frontend and backend)
dev:
	@echo "Starting development servers..."
	@echo "Frontend will be available at http://localhost:5173"
	@echo "Backend will be available at http://localhost:3000"
	@echo ""
	@echo "Starting frontend and backend in parallel..."
	@(cd frontend && npm run dev) & (cd backend && npm run dev)

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
	@echo "  setup            - Setup both frontend and backend development environments"
	@echo "  setup-frontend   - Setup frontend development environment"
	@echo "  setup-backend    - Setup backend development environment"
	@echo "  dev              - Start both development servers in parallel"
	@echo "  lint             - Run all linters (backend and frontend)"
	@echo "  lint-backend     - Run backend linters (ruff check)"
	@echo "  lint-frontend    - Run frontend linters (eslint)"
	@echo "  format           - Run all format checkers (backend and frontend)"
	@echo "  format-backend   - Run backend format checker (ruff format --check)"
	@echo "  format-frontend  - Run frontend format checker (prettier --check)"
	@echo "  help             - Show this help message"
