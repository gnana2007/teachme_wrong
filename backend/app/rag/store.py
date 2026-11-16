"""Chunk -> embed -> store -> retrieve. Dev: in-memory + hashing embeddings (no deps).
Prod: swap `VectorStore` for pgvector (table `material_chunks`, vector(384))."""
import hashlib
import math
import re

from app.config import settings

DIM = 384


def chunk_text(text: str, size: int = 800, overlap: int = 120) -> list[str]:
    text = re.sub(r"\s+", " ", text).strip()
    return [text[i:i + size] for i in range(0, len(text), size - overlap)] if text else []


def _hash_embed(t: str) -> list[float]:
    v = [0.0] * DIM
    for tok in re.findall(r"[a-z0-9]+", t.lower()):
        h = int(hashlib.md5(tok.encode()).hexdigest(), 16)
        v[h % DIM] += 1 if (h >> 8) & 1 else -1
    n = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / n for x in v]


_model = None


def embed(t: str) -> list[float]:
    global _model
    if settings.embedding_backend == "sentence-transformers":
        if _model is None:
            from sentence_transformers import SentenceTransformer
            _model = SentenceTransformer("all-MiniLM-L6-v2")
        return _model.encode(t, normalize_embeddings=True).tolist()
    return _hash_embed(t)


class VectorStore:
    def __init__(self):
        self._chunks: dict[str, list[tuple[str, list[float]]]] = {}

    def add(self, material_id: str, text: str) -> int:
        cs = chunk_text(text)
        self._chunks[material_id] = [(c, embed(c)) for c in cs]
        return len(cs)

    def search(self, material_id: str | None, query: str, k: int = 3) -> list[str]:
        if not material_id or material_id not in self._chunks:
            return []
        q = embed(query)
        scored = sorted(((sum(a * b for a, b in zip(q, e)), c) for c, e in self._chunks[material_id]), reverse=True)
        return [c for _, c in scored[:k]]


vector_store = VectorStore()
