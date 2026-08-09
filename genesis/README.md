# Genesis

Self-hostable founder intelligence: a coordinated idea-analysis suite plus recurring financial and competitor intelligence.

## Start locally

```sh
cp .env.example .env
docker compose up --build
```

Open `http://localhost:5180`. MongoDB, Redis, and MinIO are entirely self-hosted. Set `GROQ_API_KEY` for live model calls; without it, the AI service returns clearly-labelled deterministic fallback results so the product remains demonstrable offline.

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
