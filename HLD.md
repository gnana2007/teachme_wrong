# TeachMeWrong --- High-Level Design (HLD)

**Document status:** Draft based on the current public repository\
**Repository:** https://github.com/gnana2007/teachme_wrong\
**Primary reference:** `README.md` and `docs/ARCHITECTURE.md`

------------------------------------------------------------------------

## 1. Purpose

This document describes the high-level architecture of TeachMeWrong: its
application layers, major services, data flow, integrations, deployment
direction, and important design boundaries.

It distinguishes the architecture described by the repository from
production components that are still pending.

## 2. System Summary

TeachMeWrong is a browser-based learning application backed by a FastAPI
service. The frontend communicates with the backend over HTTPS. The
backend coordinates learning sessions, AI agents, deterministic mastery
calculations, learning-material retrieval, and professor analytics.

The documented target architecture uses Supabase Postgres, pgvector,
Supabase Auth, and row-level security. The current development
implementation still uses an in-memory repository by default.

## 3. Architecture Diagram

``` mermaid
flowchart TB
    U[Student / Professor Browser]
    FE[Next.js Frontend]
    API[FastAPI Backend]
    AUTH[Authentication and Role Dependencies]
    SESSION[Session Service]
    AGENTS[AI Agents]
    PROVIDER[AI Provider Adapter]
    LLM[OpenAI / Gemini / Mock]
    MASTERY[Deterministic Mastery Engine]
    RAG[RAG and Retrieval]
    INGEST[Document Ingestion]
    ANALYTICS[Professor Analytics]
    REPO[Repository Interface]
    MEM[(MemoryRepo - current default)]
    SUPA[(Supabase Postgres + pgvector - target)]
    FILES[Uploaded Learning Materials]

    U --> FE
    FE -->|HTTPS API requests| API
    API --> AUTH
    API --> SESSION
    API --> INGEST
    API --> ANALYTICS
    SESSION --> AGENTS
    AGENTS --> PROVIDER
    PROVIDER --> LLM
    SESSION --> MASTERY
    SESSION --> RAG
    INGEST --> FILES
    INGEST --> RAG
    SESSION --> REPO
    ANALYTICS --> REPO
    REPO --> MEM
    REPO -. future persistent adapter .-> SUPA
    RAG -. vector persistence target .-> SUPA
```

**Important:** The diagram shows the intended separation and target
persistence path. It does not mean the Supabase repository adapter is
already complete.

## 4. Architectural Principles

1.  **Server-side AI calls:** The frontend does not hold provider API
    keys. AI requests are made by the backend.
2.  **Separation of responsibilities:** API routes, session
    orchestration, agents, mastery, ingestion, retrieval, and analytics
    are separated into distinct modules.
3.  **Deterministic mastery:** The LLM evaluates responses into
    structured evidence; application code calculates mastery.
4.  **Evidence-based progression:** Session progress and final mastery
    use learner evidence, misconception correction, and transfer
    performance.
5.  **Provider abstraction:** The AI provider interface supports OpenAI,
    Gemini, and a mock provider.
6.  **Repository abstraction:** Persistence is isolated behind a
    repository layer so the in-memory implementation can be replaced.
7.  **Role and ownership checks:** Backend dependencies enforce access
    boundaries for student and professor operations.

## 5. Major Components

### 5.1 Frontend

-   Framework: Next.js
-   UI styling: Tailwind CSS
-   Language: TypeScript
-   Main areas: landing, authentication, student routes, professor
    routes
-   Supporting code: components, hooks, libraries, and types

The student experience includes concept browsing, the teaching
conversation, feedback, mastery progress, and transfer testing. The
professor experience includes course-level analytics and misconception
exploration.

### 5.2 Backend API

-   Runtime: Python
-   Framework: FastAPI
-   Entry point: `backend/main.py`
-   API route module: `backend/app/api/routes.py`
-   Dependencies: `backend/app/api/deps.py`

The API exposes authentication, profile, subject/concept, material,
session, student, and professor operations.

### 5.3 Session Service

`backend/app/services/session_service.py` orchestrates the teaching
lifecycle. It coordinates message persistence, retrieval, evaluation,
mastery updates, difficulty adjustment, focus selection, Alex's reply,
and session progression.

### 5.4 AI Agents and Provider Layer

The repository documents these agents: - Concept analyzer -
Misconception generator - Misconception validator - Alex / student
persona - Socratic questioner - Evaluator - Transfer problem generator

Agent prompts are stored in `backend/app/prompts/`. Agent
implementations are in `backend/app/agents/agents.py`. Provider
selection is handled through `backend/app/ai/provider.py`, with OpenAI,
Gemini, and mock implementations.

The evaluator returns structured JSON and does not receive Alex's
persona. Its private reasoning is not exposed to the learner.

### 5.5 Mastery Engine

`backend/app/mastery/engine.py` calculates weighted mastery, adapts
difficulty, and determines final mastery state. The mastery calculation
is application logic rather than an LLM-generated final score.

### 5.6 Learning Material Ingestion and RAG

The documented pipeline: 1. Validate MIME type, magic bytes, and upload
size. 2. Extract text from PDF, PPTX, DOCX, or TXT. 3. Clean and chunk
text. 4. Generate embeddings. 5. Store chunks. 6. Retrieve the top three
relevant chunks for evaluator context during a teaching turn.

The documented default is a dependency-free hashing embedding stand-in.
`EMBEDDING_BACKEND=sentence-transformers` enables the
sentence-transformers option. pgvector is the production storage
direction.

### 5.7 Analytics

`backend/app/services/analytics.py` supports professor aggregates. The
professor UI presents concept understanding and misconception patterns,
with drill-down views.

### 5.8 Data Layer

-   Repository implementation: `backend/app/database/repo.py`
-   Database schema: `backend/app/database/schema.sql`
-   Seed data: `backend/app/database/seed.py`

The current README states that the runtime uses in-memory `MemoryRepo`,
so data resets on restart. The SQL schema includes the intended
Supabase/Postgres structure and RLS policies. A Supabase-backed
repository still needs to be implemented.

## 6. Technology Stack

  -----------------------------------------------------------------------
  Layer                   Technology              Role / status
  ----------------------- ----------------------- -----------------------
  Frontend                Next.js                 Browser application

  Frontend language       TypeScript              Application typing

  Styling                 Tailwind CSS            UI styling

  Backend                 Python + FastAPI        HTTP API

  Data validation         Pydantic                Request and response
                                                  models

  AI providers            OpenAI, Gemini, Mock    Provider adapter
                                                  options

  Document extraction     PyMuPDF, python-pptx,   Material extraction
                          python-docx, TXT        
                          handling                

  Embeddings              Hashing stand-in by     Development and
                          default;                retrieval
                          sentence-transformers   
                          option                  

  Target database         Supabase Postgres       Persistent data target

  Target vector search    pgvector                Production vector
                                                  retrieval target

  Target authentication   Supabase Auth           Production
                                                  authentication
                                                  direction

  Tests                   pytest                  Backend test suite
  -----------------------------------------------------------------------

The repository describes plain Tailwind UI. shadcn/ui and framer-motion
are not currently part of the documented implementation.

## 7. High-Level Data Flow

### 7.1 Teaching interaction

``` mermaid
sequenceDiagram
    actor Student
    participant UI as Next.js UI
    participant API as FastAPI
    participant Session as Session Service
    participant RAG as Retrieval
    participant Eval as Evaluator Agent
    participant Mastery as Mastery Engine
    participant Alex as Alex Agent

    Student->>UI: Submit explanation
    UI->>API: POST /sessions/{id}/message
    API->>Session: Process learner message
    Session->>RAG: Retrieve relevant material chunks
    RAG-->>Session: Top relevant chunks
    Session->>Eval: Evaluate explanation with context
    Eval-->>Session: Structured evaluation
    Session->>Mastery: Update node mastery and difficulty
    Mastery-->>Session: Updated progress and focus
    Session->>Alex: Generate next student response
    Alex-->>Session: Alex reply
    Session-->>API: Reply, feedback, progress
    API-->>UI: JSON response
    UI-->>Student: Updated conversation and mastery
```

### 7.2 Material ingestion

``` mermaid
flowchart LR
    A[Upload file] --> B[Validate MIME, magic bytes, size]
    B --> C[Extract text]
    C --> D[Clean and chunk]
    D --> E[Generate embeddings]
    E --> F[Store chunks]
    F --> G[Retrieve relevant chunks during sessions]
```

### 7.3 Professor analytics

The professor client requests course and analytics data from FastAPI.
The backend aggregates course, concept, student, and misconception
information through the service and repository layers. The UI renders
concept understanding and misconception heatmap views.

## 8. Domain Data Model

The architecture document describes these relationships:

``` mermaid
erDiagram
    USERS ||--o{ COURSES : teaches
    COURSES ||--o{ CONCEPTS : contains
    COURSES }o--o{ USERS : enrolls
    CONCEPTS ||--o{ KNOWLEDGE_NODES : decomposes_into
    CONCEPTS ||--o{ MISCONCEPTIONS : has
    KNOWLEDGE_NODES ||--o{ MISCONCEPTIONS : targets
    USERS ||--o{ LEARNING_MATERIALS : uploads
    LEARNING_MATERIALS ||--o{ MATERIAL_CHUNKS : contains
    USERS ||--o{ LEARNING_SESSIONS : starts
    CONCEPTS ||--o{ LEARNING_SESSIONS : focuses
    LEARNING_SESSIONS ||--o{ MESSAGES : contains
    MESSAGES ||--o{ EVALUATIONS : receives
    USERS }o--o{ KNOWLEDGE_NODES : mastery
    LEARNING_SESSIONS ||--o| TRANSFER_TESTS : has
    LEARNING_SESSIONS ||--o{ MISCONCEPTION_EVENTS : records
```

The complete DDL and row-level-security policies are documented in
`backend/app/database/schema.sql`.

## 9. API Surface

The architecture document lists these API operations. Exact payload
schemas should be checked against the Pydantic models and route
implementation.

  ------------------------------------------------------------------------------------------
  Method                  Path                                       Purpose
  ----------------------- ------------------------------------------ -----------------------
  POST                    `/auth/signup`                             Development signup

  POST                    `/auth/login`                              Development login

  GET                     `/me`                                      Current profile

  GET                     `/subjects`                                Browse subjects

  GET                     `/concepts`                                Browse concepts

  GET                     `/concepts/{id}`                           Concept detail and
                                                                     mastery

  POST                    `/concepts/custom`                         Analyze a custom topic
                                                                     and optional material

  POST                    `/materials/upload`                        Upload and extract
                                                                     learning material

  POST                    `/materials/{id}/analyze`                  Analyze uploaded
                                                                     material

  POST                    `/sessions`                                Start a teaching
                                                                     session

  GET                     `/sessions/{id}`                           Fetch session

  POST                    `/sessions/{id}/message`                   Submit teaching message

  POST                    `/sessions/{id}/transfer-test`             Generate transfer
                                                                     problem

  POST                    `/sessions/{id}/transfer-test/answer`      Submit transfer answer

  POST                    `/sessions/{id}/evaluate`                  Finalize or fetch final
                                                                     evaluation

  GET                     `/students/{id}/mastery`                   Student mastery view

  GET                     `/students/{id}/sessions`                  Student sessions

  GET                     `/students/{id}/dashboard`                 Student dashboard

  POST/GET                `/professor/courses`                       Create/list professor
                                                                     courses

  POST/GET                `/professor/courses/{id}/students`         Manage/view course
                                                                     roster

  GET                     `/professor/courses/{id}/analytics`        Course analytics

  GET                     `/professor/courses/{id}/misconceptions`   Misconception analytics

  GET                     `/professor/courses/{id}/concepts/{cid}`   Concept drill-down

  GET                     `/professor/courses/{id}/students/{sid}`   Student drill-down
  ------------------------------------------------------------------------------------------

## 10. Session Lifecycle

``` mermaid
stateDiagram-v2
    [*] --> TEACHING
    TEACHING --> TEACHING: learner message / evaluation
    TEACHING --> TRANSFER: transfer test started
    TRANSFER --> COMPLETE: transfer answer evaluated
    TEACHING --> COMPLETE: explicit evaluate / skip transfer
    COMPLETE --> [*]
```

The architecture describes readiness for transfer after at least four
turns and misconception correction, or after eight turns. The API can
also proceed to transfer when the transfer-test endpoint is called.
Explicit evaluation can complete a session without transfer.

## 11. Security and Trust Boundaries

-   Provider API keys remain in backend environment variables.
-   Frontend requests do not directly access the database.
-   Backend dependencies provide authentication, roles, and rate
    limiting.
-   The repository describes role and ownership checks and upload
    validation.
-   Evaluator reasoning is not returned to the student.
-   Supabase RLS is part of the target SQL schema.
-   Current development auth uses `X-User-Id`; the production Supabase
    JWT path is not yet fully tested.
-   Professor sample anonymization is currently a simple alias and must
    be hardened before real student data is used.

## 12. Environment Configuration

The architecture lists these backend variables: `AI_PROVIDER`,
`OPENAI_API_KEY`, `OPENAI_MODEL`, `GEMINI_API_KEY`, `GEMINI_MODEL`,
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`,
`EMBEDDING_BACKEND`, `MAX_UPLOAD_MB`, `RATE_LIMIT_PER_MINUTE`,
`CORS_ORIGINS`.

Frontend: `NEXT_PUBLIC_API_URL`.

Do not commit real secrets. Use the repository's `.env.example` and
`.env.local.example` as the source for exact configuration names and
defaults.

## 13. Deployment Design

The documented deployment direction is: - Frontend: Vercel. - FastAPI
backend: Render or Railway. - Data and authentication target: Supabase.

The documented backend command is:
`uvicorn main:app --host 0.0.0.0 --port $PORT`

For the Supabase target, run the database schema, enable Auth, and
configure `SUPABASE_JWT_SECRET` so the backend can verify bearer tokens.

## 14. Known Architecture Gaps

1.  Replace the in-memory `MemoryRepo` with a tested Supabase-backed
    repository.
2.  Complete and test the production Supabase authentication path and
    frontend sign-in.
3.  Decide and implement durable storage for uploaded material and
    related metadata.
4.  Replace or configure development hashing embeddings for production
    retrieval.
5.  Harden professor analytics anonymization.
6.  Implement image/OCR, diagram, and code modalities if they remain
    product goals.
7.  Add production build and browser-level verification; the README
    reports these checks have not yet been run.
