from functools import lru_cache
from pathlib import Path

_DIR = Path(__file__).resolve().parent.parent / "prompts"


@lru_cache
def load_prompt(name: str) -> str:
    return (_DIR / f"{name}.txt").read_text(encoding="utf-8")
