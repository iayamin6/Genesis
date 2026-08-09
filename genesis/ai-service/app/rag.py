import os, hashlib, math
import chromadb

SEED_DOCUMENTS = [
    ("unit-economics", "Unit economics: contribution margin equals revenue minus variable costs. Model assumptions explicitly and distinguish gross from net burn."),
    ("market-sizing", "Market sizing framework: define TAM, serviceable available market, serviceable obtainable market, and bottom-up customer counts. Cite sources and uncertainty."),
    ("risk-register", "Risk register framework: state risk, likelihood, impact, leading indicator, mitigation owner, and contingency plan."),
    ("legal-basics", "Legal boilerplate is jurisdiction-specific. Flag privacy, employment, intellectual-property, tax and industry regulations for professional review."),
]

class KnowledgeBase:
    def __init__(self):
        self.client = chromadb.PersistentClient(path=os.getenv("CHROMA_PATH", "/tmp/genesis-chroma"))
        self.collection = self.client.get_or_create_collection("genesis-frameworks")
        if not self.collection.count():
            self.collection.add(ids=[x[0] for x in SEED_DOCUMENTS], documents=[x[1] for x in SEED_DOCUMENTS], embeddings=[self._embed(x[1]) for x in SEED_DOCUMENTS])
    @staticmethod
    def _embed(text: str) -> list[float]:
        """Small deterministic embedding keeps the knowledge base fully self-hosted/offline.
        A local sentence-transformer can replace this at the collection boundary later.
        """
        raw = hashlib.sha512(text.lower().encode()).digest()
        vector = [(byte - 127.5) / 127.5 for byte in raw]
        scale = math.sqrt(sum(x * x for x in vector)) or 1
        return [x / scale for x in vector]
    def retrieve(self, query: str, n: int = 3) -> list[str]:
        result = self.collection.query(query_embeddings=[self._embed(query)], n_results=n)
        return result.get("documents", [[]])[0]

knowledge_base = KnowledgeBase()
