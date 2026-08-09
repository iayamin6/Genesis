import os
import httpx

async def emit_event(run_id: str | None, event: dict):
    if not run_id: return
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(os.getenv("API_CALLBACK_URL", "http://localhost:3001") + "/internal/agent-events", json={"runId": run_id, "event": event})
    except Exception:
        # Streaming must never make agent execution fail if the relay is unavailable.
        pass
