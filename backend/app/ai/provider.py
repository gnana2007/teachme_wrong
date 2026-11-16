"""Provider abstraction. Swap OpenAI / Gemini / mock via AI_PROVIDER."""
import json
import re
from abc import ABC, abstractmethod
from functools import lru_cache

import httpx

from app.config import settings


class AIProvider(ABC):
    @abstractmethod
    async def generate(self, task: str, system: str, user: str, context: dict | None = None) -> str: ...

    @abstractmethod
    async def generate_structured(self, task: str, system: str, user: str, context: dict | None = None) -> dict: ...

    async def evaluate(self, system: str, user: str, context: dict | None = None) -> dict:
        return await self.generate_structured("evaluator", system, user, context)


def _parse_json(text: str) -> dict:
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    m = re.search(r"\{.*\}", text, re.S)
    return json.loads(m.group(0) if m else text)


class OpenAIProvider(AIProvider):
    url = "https://api.openai.com/v1/chat/completions"

    async def _call(self, system: str, user: str, as_json: bool) -> str:
        if not settings.openai_api_key or settings.openai_api_key.strip() == "":
            raise ValueError("OPENAI_API_KEY is not configured. Please set your key in backend/.env or set AI_PROVIDER=mock.")
        body = {"model": settings.openai_model, "temperature": 0.7,
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
        if as_json:
            body["response_format"] = {"type": "json_object"}
        async with httpx.AsyncClient(timeout=60) as c:
            r = await c.post(self.url, json=body, headers={"Authorization": f"Bearer {settings.openai_api_key}"})
            if r.status_code >= 400:
                raise RuntimeError(f"OpenAI error ({r.status_code}): {r.text}")
            return r.json()["choices"][0]["message"]["content"]

    async def generate(self, task, system, user, context=None):
        return await self._call(system, user, False)

    async def generate_structured(self, task, system, user, context=None):
        return _parse_json(await self._call(system, user, True))


class GeminiProvider(AIProvider):
    async def _call(self, system: str, user: str, as_json: bool) -> str:
        if not settings.gemini_api_key or settings.gemini_api_key.strip() == "":
            raise ValueError("GEMINI_API_KEY is not configured. Please set your key in backend/.env (from https://aistudio.google.com) or set AI_PROVIDER=mock.")
        url = (f"https://generativelanguage.googleapis.com/v1beta/models/"
               f"{settings.gemini_model}:generateContent?key={settings.gemini_api_key}")
        body = {"systemInstruction": {"parts": [{"text": system}]},
                "contents": [{"role": "user", "parts": [{"text": user}]}]}
        if as_json:
            body["generationConfig"] = {"responseMimeType": "application/json"}
        async with httpx.AsyncClient(timeout=60) as c:
            r = await c.post(url, json=body)
            if r.status_code >= 400:
                raise RuntimeError(f"Gemini API error ({r.status_code}): {r.text}")
            return r.json()["candidates"][0]["content"]["parts"][0]["text"]

    async def generate(self, task, system, user, context=None):
        return await self._call(system, user, False)

    async def generate_structured(self, task, system, user, context=None):
        return _parse_json(await self._call(system, user, True))


@lru_cache
def get_provider() -> AIProvider:
    p = settings.ai_provider.lower()
    if p == "openai":
        return OpenAIProvider()
    if p == "gemini":
        return GeminiProvider()
    from app.ai.mock import MockProvider
    return MockProvider()
