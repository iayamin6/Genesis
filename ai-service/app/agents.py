from __future__ import annotations
import asyncio, time
from typing import TypedDict, Annotated, Any
from operator import add
from pydantic import BaseModel, Field
from .providers import llm_provider, search_provider
from .rag import knowledge_base
from .callbacks import emit_event

class MarketOutput(BaseModel): market_summary: str; customer_segments: list[str]; sources: list[str]; assumptions: list[str]
class RiskOutput(BaseModel): risks: list[str]; mitigations: list[str]; critical_unknowns: list[str]
class FinancialOutput(BaseModel): revenue_model: str; cost_drivers: list[str]; financial_assumptions: list[str]; validation_steps: list[str]
class LegalOutput(BaseModel): jurisdiction_flags: list[str]; legal_risks: list[str]; recommended_counsel: list[str]
class CompetitiveOutput(BaseModel): competitors: list[str]; differentiation: list[str]; positioning_risks: list[str]
class AssumptionOutput(BaseModel): challenged_assumptions: list[str]; break_conditions: list[str]; experiments: list[str]
class PitchOutput(BaseModel): one_liner: str; narrative: str; milestones: list[str]; open_questions: list[str]

class GraphState(TypedDict, total=False):
    run_id: str
    idea: str
    industry: str
    results: Annotated[list[dict[str, Any]], add]
    context: dict[str, Any]

async def run_agent(name: str, schema: type[BaseModel], state: GraphState) -> dict:
    started = time.perf_counter(); provider = llm_provider(); search = search_provider()
    await emit_event(state.get("run_id"), {"type": "agent_started", "agent": name})
    query = f"{state['idea']} {state.get('industry', '')} {name}"
    sources = await search.search(query) if name in {"market_research", "competitive_intelligence", "legal_scout"} else []
    grounding = knowledge_base.retrieve(query)
    prompt = f"""You are Genesis's {name}. Return only the requested validated schema. Do not invent facts. Mark uncertain facts as assumptions.
Startup: {state['idea']}\nIndustry: {state.get('industry', 'unspecified')}\nRAG grounding: {grounding}\nSearch evidence: {sources}\nPrior outputs: {state.get('results', [])}"""
    try:
        output, usage = await asyncio.wait_for(provider.structured(prompt, schema), timeout=30)
        status, error = "completed", None
    except Exception as exc:
        output, usage, status, error = {"notice": "This agent did not complete; retry the run."}, {"inputTokens": 0, "outputTokens": 0}, "failed", str(exc)
    result = {"agent": name, "status": status, "output": output, "error": error, "usage": {**usage, "durationMs": round((time.perf_counter()-started)*1000)}}
    await emit_event(state.get("run_id"), {"type": "agent_finished", **result})
    return {"results": [result]}

async def market(state): return await run_agent("market_research", MarketOutput, state)
async def risk(state): return await run_agent("risk_analysis", RiskOutput, state)
async def legal(state): return await run_agent("legal_scout", LegalOutput, state)
async def competitive(state): return await run_agent("competitive_intelligence", CompetitiveOutput, state)
async def assumptions(state): return await run_agent("assumption_stress_tester", AssumptionOutput, state)
async def financial(state): return await run_agent("financial_modelling", FinancialOutput, state)
async def pitch(state): return await run_agent("pitch_writer", PitchOutput, state)
