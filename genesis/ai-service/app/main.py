from __future__ import annotations
import os
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from pymongo import MongoClient
from .graph import build_graph
from .logging import log
from .providers import llm_provider, search_provider
from .callbacks import emit_event

app = FastAPI(title="Genesis AI Service")
graph = build_graph()
mongo = MongoClient(os.getenv("MONGO_URI", "mongodb://localhost:27017/genesis"))
runs = mongo.get_default_database().agentruns

class Competitor(BaseModel): id: str; name: str; url: str | None = None; lastSnapshot: dict | None = None
class RunRequest(BaseModel): runId: str; kind: str = "idea_analysis"; idea: str; industry: str = ""; competitors: list[Competitor] = []

class CompetitorSnapshot(BaseModel): pricing: str; hiring: str; summary: str

def snapshot_diff(previous: dict | None, current: dict):
    if not previous: return {"baseline": True, "significant": False, "changes": []}
    fields = ("pricing", "hiring", "summary")
    changes = [{"field": field, "before": previous.get(field, ""), "after": current.get(field, "")} for field in fields if previous.get(field, "").lower().strip() != current.get(field, "").lower().strip()]
    return {"baseline": False, "significant": any(x["field"] in {"pricing", "hiring"} for x in changes), "changes": changes}

async def competitor_digest(document, request: RunRequest):
    workspace = mongo.get_default_database().workspaces.find_one({"_id": document["workspaceId"]})
    output = []
    for competitor in request.competitors:
        await emit_event(request.runId, {"type": "agent_started", "agent": f"competitor:{competitor.name}"})
        sources = await search_provider().search(f"{competitor.name} pricing jobs hiring {competitor.url or ''}")
        prompt = f"Summarize only evidenced competitor signals in the requested schema. Unknown information must say unknown. Competitor: {competitor.name}. Evidence: {sources}"
        try: snapshot, usage = await llm_provider().structured(prompt, CompetitorSnapshot); status = "completed"
        except Exception as exc: snapshot, usage, status = {"pricing": "unknown", "hiring": "unknown", "summary": f"Search/provider failure: {exc}"}, {"inputTokens": 0, "outputTokens": 0}, "failed"
        diff = snapshot_diff(competitor.lastSnapshot, snapshot)
        output.append({"competitor": competitor.name, "snapshot": snapshot, "diff": diff, "usage": usage, "status": status})
        mongo.get_default_database().workspaces.update_one({"_id": document["workspaceId"], "competitors._id": __import__('bson').ObjectId(competitor.id)}, {"$set": {"competitors.$.lastSnapshot": snapshot, "competitors.$.lastCheckedAt": datetime.now(timezone.utc)}})
        if diff["significant"]:
            for change in diff["changes"]:
                if change["field"] not in {"pricing", "hiring"}: continue
                await emit_event(request.runId, {"type": "alert", "category": "competitor", "severity": "warning" if change["field"] == "hiring" else "info", "dedupeKey": f"competitor:{document['workspaceId']}:{competitor.id}:{datetime.now(timezone.utc).date()}:{change['field']}", "title": f"{competitor.name} changed {change['field']}", "body": f"Previous: {change['before'][:240]} New: {change['after'][:240]}", "metadata": {"competitor": competitor.name, "change": change}})
        await emit_event(request.runId, {"type": "agent_finished", "agent": f"competitor:{competitor.name}", "status": status, "output": {"diff": diff}, "usage": usage})
    return output

@app.get('/health')
def health(): return {"status": "ok", "service": "ai-service"}

@app.post('/runs/{run_id}')
async def execute(run_id: str, request: RunRequest):
    document = runs.find_one({"_id": __import__('bson').ObjectId(run_id)})
    if not document: raise HTTPException(404, "Run not found")
    if document.get("status") == "completed": return {"status": "already_completed"}
    runs.update_one({"_id": document["_id"]}, {"$set": {"status": "running", "startedAt": datetime.now(timezone.utc)}})
    log("info", "run_started", runId=run_id)
    try:
        if request.kind == "competitor_digest":
            digest = await competitor_digest(document, request)
            runs.update_one({"_id": document["_id"]}, {"$set": {"status": "completed", "agents": [{"agent": "competitor_intelligence", "status": "completed", "output": digest}], "output": {"digest": digest}, "completedAt": datetime.now(timezone.utc)}})
            return {"status": "completed", "results": digest}
        final = await graph.ainvoke({"run_id": run_id, "idea": request.idea, "industry": request.industry, "results": [], "context": {}})
        results = final["results"]; partial = any(r["status"] == "failed" for r in results)
        runs.update_one({"_id": document["_id"]}, {"$set": {"status": "partial" if partial else "completed", "agents": results, "output": {r["agent"]: r["output"] for r in results}, "completedAt": datetime.now(timezone.utc)}})
        log("info", "run_completed", runId=run_id, partial=partial)
        return {"status": "partial" if partial else "completed", "results": results}
    except Exception as exc:
        runs.update_one({"_id": document["_id"]}, {"$set": {"status": "failed", "error": str(exc), "completedAt": datetime.now(timezone.utc)}})
        log("error", "run_failed", runId=run_id, error=str(exc)); raise HTTPException(500, "Agent run failed")
