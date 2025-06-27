# Makefile for unitemate-v2

.PHONY: setup setup-frontend setup-backend start check check-backend check-frontend help

# ==============================================================================
# Setup Commands
# ==============================================================================

## Setup both frontend and backend development environments
setup: setup-frontend setup-backend

## Setup frontend development environment
setup-frontend:
	@echo "Setting up frontend development environment..."
	@cd frontend && make install

## Setup backend development environment
setup-backend:
	@echo "Setting up backend development environment..."
	@cd backend && make install

# ==============================================================================
# Development Commands
# ==============================================================================

## Start development servers (frontend and backend)
start:
	@echo "Starting development servers..."
	@echo "Frontend will be available at http://localhost:5173"
	@echo "Backend will be available at http://localhost:3000"
	@echo ""
	@echo "Starting frontend and backend in parallel..."
	@(cd frontend && make start) & (cd backend && make start)

# ==============================================================================
# Check Commands
# ==============================================================================

## Run all linters & format
check: check-backend check-frontend

## Run backend linters & format
check-backend:
	@echo "Running backend linters..."
	@cd backend && make check

## Run frontend linters & format
check-frontend:
	@echo "Running frontend linters..."
	@cd frontend && make check

# ==============================================================================
# Help
# ==============================================================================

## Show help
help:
	@echo "Available commands:"
	@echo "  setup            - Setup both frontend and backend development environments"
	@echo "  setup-frontend   - Setup frontend development environment"
	@echo "  setup-backend    - Setup backend development environment"
	@echo "  start            - Start both development servers in parallel"
	@echo "  check            - Run all linters & format (backend and frontend)"
	@echo "  check-backend    - Run backend linters & format"
	@echo "  check-frontend   - Run frontend linters & format"
	@echo "  help             - Show this help message"
