import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.deps import rate_limit
from app.api.routes import router
from app.config import settings
from app.database.seed import seed

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

@asynccontextmanager
async def lifespan(_):
    seed()
    logging.getLogger("tmw").info("Seeded demo data. AI provider=%s", settings.ai_provider)
    yield


app = FastAPI(title="TeachMeWrong API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins.split(","), allow_methods=["*"], allow_headers=["*"])
app.middleware("http")(rate_limit)
app.include_router(router)


@app.get("/health")
def health():
    return {"ok": True, "provider": settings.ai_provider}
