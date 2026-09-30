import os, hashlib, math

SEED_DOCUMENTS = [
    ("unit-economics", "Unit economics: contribution margin equals revenue minus variable costs. Model assumptions explicitly and distinguish gross from net burn."),
    ("market-sizing", "Market sizing framework: define TAM, serviceable available market, serviceable obtainable market, and bottom-up customer counts. Cite sources and uncertainty."),
    ("risk-register", "Risk register framework: state risk, likelihood, impact, leading indicator, mitigation owner, and contingency plan."),
    ("legal-basics", "Legal boilerplate is jurisdiction-specific. Flag privacy, employment, intellectual-property, tax and industry regulations for professional review."),
]

class KnowledgeBase:
    """Explicit lexical retrieval over framework documents; no fake semantic vectors."""
    def retrieve(self, query: str, n: int = 3) -> list[str]:
        import re
        terms = set(re.findall(r"\w+", query.lower()))
        scored = [(len(terms & set(re.findall(r"\w+", document.lower()))), document) for _, document in SEED_DOCUMENTS]
        return [document for score, document in sorted(scored, reverse=True)[:n] if score > 0]

knowledge_base = KnowledgeBase()
