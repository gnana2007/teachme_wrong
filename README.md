# TeachMeWrong

Turn the AI from an answer machine into a confused student that **you** must teach. Alex (the AI student) opens with a plausible misconception; you explain, defend, and apply the concept; an independent evaluator updates a concept-level mastery graph; a transfer problem decides the final mastery state; professors see class-wide misconception patterns.

## Quick start (no API key needed)
```bash
# terminal 1
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload          # API docs: http://localhost:8000/docs
pytest tests                       # optional: runs the full loop

# terminal 2
cd frontend
npm install
cp .env.local.example .env.local
npm run dev                        # http://localhost:3000
```
Open http://localhost:3000 → **Sign in → Continue as demo student → Topics → Binary Search → Start teaching Alex**. Then sign in as the demo professor to see the class heatmap (Data Structures, 32 seeded students).

## Using a real LLM
Set `AI_PROVIDER=openai` (or `gemini`) and the matching key in `backend/.env`. Prompts live in `backend/app/prompts/`. The default `mock` provider is a deterministic, keyword-based stand-in so the loop is demonstrable offline; its evaluation is far cruder than a real model's.

## What is implemented vs. what is not
Working: the whole teaching loop, structured evaluation, weighted mastery, adaptive difficulty, transfer test, final state, misconception validation pipeline, material upload → extraction → chunk → embed → retrieve, student and professor views, seeded demo, role/ownership checks, upload validation, rate limiting, tests.

Not yet done (be aware before shipping):
- **Storage is in-memory** (`MemoryRepo`); data resets on restart. `schema.sql` (with RLS) is ready, but a Supabase-backed repository still needs to be written against the same interface.
- **Auth:** dev login uses an `X-User-Id` header. The Supabase JWT path exists in `deps.py` but is untested; the frontend has no Supabase sign-in yet.
- **Voice** uses the browser's speech API only; image/OCR, diagrams, code modalities return empty text (the `StudentInput` shape is ready).
- Embeddings default to a hashing stand-in; use `EMBEDDING_BACKEND=sentence-transformers` for real retrieval, or pgvector in production.
- Frontend is plain Tailwind (no shadcn/ui or framer-motion yet). I typechecked it but did not run `next build` or browser-test it.
- Professor "anonymized" samples use a simple alias; harden before real student data.

See `docs/ARCHITECTURE.md` for the full design.
