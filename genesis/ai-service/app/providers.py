"""Replaceable LLM and web-search boundaries. Agent modules never import vendors."""
from __future__ import annotations
import asyncio, json, os
from abc import ABC, abstractmethod
from typing import Any
from duckduckgo_search import DDGS
from langchain_groq import ChatGroq
from langchain_ollama import ChatOllama

class LLMProvider(ABC):
    @abstractmethod
    async def structured(self, prompt: str, schema: type) -> tuple[dict[str, Any], dict[str, int]]: ...

class GroqProvider(LLMProvider):
    def __init__(self): self.model = ChatGroq(model="llama-3.3-70b-versatile", temperature=0, timeout=25, max_retries=0)
    async def structured(self, prompt, schema):
        response = await self.model.with_structured_output(schema).ainvoke(prompt)
        usage = getattr(response, "usage_metadata", {}) or {}
        return response.model_dump(), {"inputTokens": usage.get("input_tokens", 0), "outputTokens": usage.get("output_tokens", 0)}

class OllamaProvider(LLMProvider):
    def __init__(self): self.model = ChatOllama(model=os.getenv("OLLAMA_MODEL", "llama3.1"), base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"), temperature=0)
    async def structured(self, prompt, schema):
        response = await self.model.with_structured_output(schema).ainvoke(prompt)
        return response.model_dump(), {"inputTokens": 0, "outputTokens": 0}

class DeterministicFallback(LLMProvider):
    """Keeps the self-hosted app usable without credentials; never claims researched facts."""
    async def structured(self, prompt, schema):
        fields = schema.model_fields
        data = {name: (["Live provider unavailable; validate before acting."] if "list" in str(field.annotation).lower() else "Live provider unavailable; validate before acting.") for name, field in fields.items()}
        return schema.model_validate(data).model_dump(), {"inputTokens": 0, "outputTokens": 0}

class FailoverProvider(LLMProvider):
    def __init__(self, primary: LLMProvider, fallback: LLMProvider): self.primary, self.fallback = primary, fallback
    async def structured(self, prompt, schema):
        try: return await self.primary.structured(prompt, schema)
        except Exception: return await self.fallback.structured(prompt, schema)

def llm_provider() -> LLMProvider:
    requested = os.getenv("LLM_PROVIDER", "groq").lower()
    fallback = FailoverProvider(OllamaProvider(), DeterministicFallback())
    if requested == "groq" and os.getenv("GROQ_API_KEY"): return FailoverProvider(GroqProvider(), fallback)
    if requested == "ollama": return fallback
    return DeterministicFallback()

class SearchProvider(ABC):
    @abstractmethod
    async def search(self, query: str, limit: int = 5) -> list[dict[str, str]]: ...

class DuckDuckGoSearch(SearchProvider):
    async def search(self, query, limit=5):
        def run():
            return [{"title": r.get("title", ""), "url": r.get("href", ""), "snippet": r.get("body", "")} for r in DDGS().text(query, max_results=limit)]
        try: return await asyncio.wait_for(asyncio.to_thread(run), timeout=15)
        except Exception: return []

class SearxNGSearch(SearchProvider):
    async def search(self, query, limit=5):
        import httpx
        url = os.environ["SEARXNG_URL"].rstrip("/") + "/search"
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(url, params={"q": query, "format": "json"}); response.raise_for_status()
            return [{"title": x.get("title", ""), "url": x.get("url", ""), "snippet": x.get("content", "")} for x in response.json().get("results", [])[:limit]]

def search_provider() -> SearchProvider:
    return SearxNGSearch() if os.getenv("SEARCH_PROVIDER") == "searxng" else DuckDuckGoSearch()
