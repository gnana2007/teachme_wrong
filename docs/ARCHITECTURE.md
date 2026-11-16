# TeachMeWrong — Architecture (sections A–P of the spec)

## A. Architecture
```
Browser (Next.js, Vercel) ──HTTPS+JWT──▶ FastAPI (Render/Railway) ──▶ Supabase Postgres (+pgvector, Auth, RLS)
                                          │
                                          ├─ services/session_service  (state machine, orchestrates agents)
                                          ├─ agents/                    (single-responsibility agents)
                                          │     └─ ai/provider.py ──▶ OpenAI | Gemini | Mock
                                          ├─ mastery/engine             (deterministic, weighted evidence)
                                          ├─ rag/ + ingestion/          (extract → chunk → embed → retrieve)
                                          └─ services/analytics         (professor aggregates)
```
All AI calls are server-side. The frontend never holds keys and never touches the DB.

## B. Folder structure
```
backend/main.py                 app entry, CORS, rate limit, seed
backend/app/api/                routes.py (all endpoints), deps.py (auth, roles, rate limit)
backend/app/ai/                 provider.py (AIProvider), mock.py, knowledge_library.py, prompts.py
backend/app/prompts/            8 prompt files, one per agent
backend/app/agents/agents.py    analyzer, misconception gen+validator, student, questioner, evaluator, transfer
backend/app/mastery/engine.py   weighted mastery, adaptive difficulty, final state
backend/app/rag/store.py        chunking, embeddings, vector search
backend/app/ingestion/extract.py PDF/PPTX/DOCX/TXT extraction + MIME/magic validation
backend/app/database/           repo.py (storage layer), schema.sql (Supabase + RLS), seed.py (demo)
backend/app/services/           session_service.py, analytics.py
backend/app/schemas/models.py   Pydantic models incl. StudentInput
backend/tests/test_flow.py      end-to-end loop + isolation tests
frontend/app/                   routes (landing, auth, student/*, professor/*)
frontend/components/, hooks/, lib/, types/
```
(`backend/app/evaluation`, `models`, and `/shared` are reserved empty packages for growth.)

## C. ER diagram
```
users 1─* courses(professor_id)        courses *─* users via course_students
courses 1─* concepts 1─* knowledge_nodes (self-ref parent)
concepts 1─* misconceptions *─1 knowledge_nodes
users 1─* learning_materials 1─* material_chunks(vector)
users 1─* learning_sessions *─1 concepts ; sessions 1─* messages ; messages 1─* evaluations
users *─* knowledge_nodes via mastery(score, evidence_weight)
learning_sessions 1─1 transfer_tests ; learning_sessions 1─* misconception_events
```
Full DDL + row-level-security policies: `backend/app/database/schema.sql`.

## D. API
| Method | Path | Purpose |
|---|---|---|
| POST | /auth/signup, /auth/login | dev auth (prod: Supabase Auth) |
| GET | /me, /subjects, /concepts, /concepts/{id} | profile, browse, detail+mastery |
| POST | /concepts/custom | analyze topic (+material) → nodes + validated misconceptions |
| POST | /materials/upload, /materials/{id}/analyze | upload + extract + embed; build concept |
| POST | /sessions | start session; Alex opens with a misconception |
| GET | /sessions/{id} | full session view |
| POST | /sessions/{id}/message | explain → evaluate → mastery → Alex replies |
| POST | /sessions/{id}/transfer-test | generate transfer problem |
| POST | /sessions/{id}/transfer-test/answer | evaluate transfer + final mastery |
| POST | /sessions/{id}/evaluate | finalize now / fetch final |
| GET | /students/{id}/mastery, /sessions, /dashboard | student views |
| POST/GET | /professor/courses, /professor/courses/{id}/students | courses and roster |
| GET | /professor/courses/{id}/analytics, /misconceptions, /concepts/{cid}, /students/{sid} | analytics |

## E. Agents
Student (Alex), Evaluator, Socratic questioner, Concept analyzer, Misconception generator, Misconception validator, Transfer generator. Each has one prompt file and one function in `agents.py`. The evaluator never sees Alex's persona and returns structured JSON only; its reasoning is never exposed. Mastery is deterministic code, not an LLM.

## F. Session state machine
```
TEACHING ──(≥4 turns & misconception corrected, or ≥8 turns)──▶ [ready_for_transfer]
TEACHING ──POST transfer-test──▶ TRANSFER ──POST answer──▶ COMPLETE
TEACHING ──POST evaluate──▶ COMPLETE (skip transfer)
```
State (`session.state`): phase, difficulty 1–6, turn, attempts, focus_node, misconception, misconception_corrected, nodes_explained, weak_concepts, concepts_mastered.

Per message: save → retrieve chunks → evaluate → update mastery → adjust difficulty → pick weakest node → choose question type → Alex replies → save → return reply + feedback + progress.

## G. RAG pipeline
Upload → MIME + magic-byte + size validation → extract (PyMuPDF / python-pptx / python-docx / txt) → clean → chunk (800 chars, 120 overlap) → embed → store → at each turn retrieve top-3 chunks for the evaluator; the analyzer and misconception generator receive the source text. Dev uses dependency-free hashing embeddings; set `EMBEDDING_BACKEND=sentence-transformers` for real ones. Production swaps `VectorStore` for pgvector (`material_chunks`).

## H. Misconception engine
Generate (structured: target_node, statement, severity, difficulty, reason) → validate: grounded, plausible, relevant, difficulty_fit, educational_value (each ≥0.6, mean ≥0.7, verdict accept) → store. Candidates targeting unknown nodes are dropped. If nothing survives, the API returns 422 rather than showing a weak misconception.

## I. Mastery design
Per (student, node): `score` and `evidence_weight`. New evidence `e` with weight `w = 0.6 + 0.2·difficulty`: `W' = W·0.85; score' = (score·W' + e·w)/(W' + w)`. Evidence = 0.5·accuracy + 0.3·reasoning + 0.2·completeness when the node was demonstrated, capped at 0.35 when the focus node was asked about and not demonstrated. Harder questions count more; recent answers count more. Final state: MASTERED (avg ≥ .78, transfer ≥ .7, misconception corrected), NEEDS_REINFORCEMENT (avg < .5 or transfer < .4), else PARTIALLY_MASTERED.

## J. Student UI
Left: clickable concept map (status dots, focus ring). Centre: Alex header with current misconception, chat, feedback strip, transfer card, composer with voice. Right: live mastery bars and difficulty level. End screen: strong / needs reinforcement / misconception / transfer / final state / three actions.

## K. Professor UI
Course page: concept understanding bars (click → concept drill-down by node with root issue and reteach hint) beside a misconception heatmap (click → anonymized samples, node, count, reteach suggestion).

## L. Roadmap
1 Foundation ✅ scaffold · 2 Teaching loop ✅ · 3 Evaluation ✅ · 4 RAG ✅ (hash embeddings) · 5 Transfer ✅ · 6 Professor ✅ (basic) · 7 Modalities: voice (browser STT) stub, image OCR/vision, diagrams, code are not yet implemented.

## M. Environment variables
Backend: `AI_PROVIDER, OPENAI_API_KEY, OPENAI_MODEL, GEMINI_API_KEY, GEMINI_MODEL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET, EMBEDDING_BACKEND, MAX_UPLOAD_MB, RATE_LIMIT_PER_MINUTE, CORS_ORIGINS`. Frontend: `NEXT_PUBLIC_API_URL`.

## N. Packages
Backend: see `backend/requirements.txt`. Frontend: next, react, tailwindcss, typescript (shadcn/ui and framer-motion can be added when you want them; the UI is plain Tailwind).

## O. Local commands
```
cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
cp .env.example .env && uvicorn main:app --reload        # http://localhost:8000/docs
pytest tests
cd frontend && npm install && cp .env.local.example .env.local && npm run dev   # http://localhost:3000
```

## P. Deployment
Vercel (frontend) → Render/Railway (FastAPI, `uvicorn main:app --host 0.0.0.0 --port $PORT`) → Supabase (run `schema.sql`, enable Auth). Set `SUPABASE_JWT_SECRET` so the backend verifies Bearer tokens.
