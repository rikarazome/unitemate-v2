# Repository Guidelines

## Project Structure & Modules
- Root orchestration: `Makefile` proxies to frontend/backend.
- Frontend (Vite + React + TS): `frontend/src/{components,hooks,utils,types,data}`; build output in `frontend/dist`.
- Backend (Python 3.12, Serverless + AWS Lambda): `backend/src/{handlers,services,repositories,models,utils}`; infra in `backend/serverless.yml`; local DynamoDB assets in `backend/.dynamodb`.
- Tests: backend in `backend/tests/*.py`. Legacy/one‑off scripts live at repo root (e.g., `CSV2json.py`).

## Build, Test, and Dev Commands
- Global setup: `make setup` (installs frontend and backend deps).
- Run both apps: `make start` (frontend http://localhost:5173, backend http://localhost:3000).
- Lint/format all: `make check`.
- Frontend: `cd frontend && make start`, `npm run build`, `npm run lint`, `npm run format`.
- Backend: `cd backend && make start`, `make check` (ruff lint/format), tests via `uv run pytest`.
- Deploy backend: `cd backend && make deploy` (prod) or `npm run deploy:dev` / `npm run deploy:prd`.

## Coding Style & Naming
- Python: Ruff formatter, 120‑char lines, double quotes, spaces. Type hints required (`mypy` with `disallow_untyped_defs=true`). Modules/files use `snake_case`.
- TypeScript/React: ESLint + Prettier. Components `PascalCase` (`components/NamePlate.tsx`), hooks `camelCase` starting with `use*` (`hooks/useApi.ts`). Prefer functional components and `tsx` for JSX.

## Testing Guidelines
- Framework: `pytest`. Place tests under `backend/tests/` and name `test_*.py`.
- Write unit tests for handlers/services and repository behavior against local DynamoDB when practical (moto/local modes).
- Run: `cd backend && uv run pytest -q`. Keep tests deterministic and fast; add fixtures for tables/data.

## Commit & PR Guidelines
- Follow conventional commits seen in history: `feat:`, `fix:`, `refactor:`, `chore:`, `revert:`. Keep scope concise (e.g., `fix: unify win rate calc`).
- PRs should include: clear description, linked issue, screenshots for UI changes, and notes on migrations/infrastructure if `serverless.yml` changes.
- Ensure `make check` passes and backend tests run clean before requesting review.

## Security & Configuration
- Env files: copy `backend/.env.example` to `.env` (or `.env.dev`), and `frontend/.env.example` to `.env.local`. Key vars include `AUTH0_*`, `FRONTEND_URL`, `DUMMY_JWT_SECRET`.
- Do not commit secrets or `.env*`. Use staged deploy commands for dev/prod.
