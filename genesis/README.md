# Genesis

Self-hostable operating intelligence for founders: company relationships, capacity and delivery risks, customer revenue exposure, and action outcomes, alongside the existing financial, competitor, and idea-analysis tools.

## Start locally

```sh
cp .env.example .env
docker compose up --build
```

Open `http://localhost:5180`. The frontend proxies API and live-event requests through this same URL. Docker services restart automatically while Docker Desktop is running. MongoDB is available on host port `27018`; storage uses `19000` (API) and `19001` (console). MongoDB, Redis, and MinIO are entirely self-hosted. Set `GROQ_API_KEY` for live model calls; without it, the AI service returns clearly-labelled deterministic fallback results so the product remains demonstrable offline.

The web app requires the API: do not start `web/` alone. Start Docker Desktop, then run `docker compose up --build`. Confirm `http://localhost:3001/health` responds before opening the UI.

## Services

- `web/` — React trace viewer and founder dashboard
- `api/` — Express, JWT, MongoDB, Socket.io, Bull
- `ai-service/` — FastAPI, LangGraph, ChromaDB, provider adapters
- `scheduler/` — intentionally housed in the API as repeatable Bull jobs

## Verification

```sh
cd ai-service && pytest
cd ../api && npm test
```

## Company intelligence

The first connected vertical slice requires no paid API or LLM key. Open a workspace and use the command center to import company observations or prepare explicitly labeled synthetic data. See [architecture assessment](docs/architecture.md) and [import contract and demo](docs/company-import.md).

For the operational slice alone, start `docker compose up -d mongo redis`, then run `npm install && MONGO_URI=mongodb://127.0.0.1:27018/genesis npm start` in `api/` and `npm install && npm run dev` in `web/`. Existing AI analysis also requires the AI service.

For HTTP/database verification, run an API with `API_PORT=3002 MONGO_URI=mongodb://127.0.0.1:27017/genesis-integration`, then run `node scripts/integration.mjs` from `api/`. The script creates isolated test accounts/workspaces and retains them for inspection.

Internal AI callbacks now require matching `INTERNAL_API_TOKEN` values in the API and AI service; Compose supplies a local development default. Set your own value for a shared deployment.

## Expanded operating intelligence

Customer health, GitHub synchronization and action publication, scoped ingestion, sourced market observations, operational scenarios, historical financial trends, and evidence-based company questions now extend the command center. These features use local computation or optional provider credentials; no paid model is required.

See [feature status and configuration boundaries](docs/remaining-features-status.md) for the implementation inventory and [production operations](docs/production-operations.md) for deployment, secrets, and recovery. This implementation pass did not run tests or builds; live provider behavior and production deployment remain unverified.
