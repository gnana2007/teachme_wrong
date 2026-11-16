# TeachMeWrong --- Low-Level Design (LLD)

**Document status:** Draft based on the current public repository\
**Repository:** https://github.com/gnana2007/teachme_wrong\
**Primary reference:** `README.md` and `docs/ARCHITECTURE.md`

------------------------------------------------------------------------

## 1. Purpose and Scope

This document describes the internal modules, request flows, session
logic, agent responsibilities, retrieval process, mastery calculation,
and data entities documented for TeachMeWrong.

It is based on the repository's public architecture and README. Where
the public documentation does not specify an exact field, payload, or
implementation detail, this document explicitly says so instead of
inventing one. Confirm exact schemas and signatures against the
implementation in `backend/app/schemas/models.py`,
`backend/app/api/routes.py`, and `backend/app/database/schema.sql`.

## 2. Backend Module Layout

``` text
backend/
├── main.py
└── app/
    ├── api/
    │   ├── routes.py
    │   └── deps.py
    ├── ai/
    │   ├── provider.py
    │   ├── mock.py
    │   ├── knowledge_library.py
    │   └── prompts.py
    ├── prompts/
    │   └── agent prompt files
    ├── agents/
    │   └── agents.py
    ├── mastery/
    │   └── engine.py
    ├── rag/
    │   └── store.py
    ├── ingestion/
    │   └── extract.py
    ├── database/
    │   ├── repo.py
    │   ├── schema.sql
    │   └── seed.py
    ├── services/
    │   ├── session_service.py
    │   └── analytics.py
    └── schemas/
        └── models.py
```

The architecture also lists `backend/tests/test_flow.py` for end-to-end
flow and isolation tests. Some package directories are described as
reserved for future growth.

## 3. Frontend Module Layout

``` text
frontend/
├── app/
│   ├── landing and auth routes
│   ├── student routes
│   └── professor routes
├── components/
├── hooks/
├── lib/
└── types/
```

The public architecture does not enumerate every frontend file or exact
route name. The README identifies the frontend as a Next.js application
styled with Tailwind CSS and written in TypeScript.

## 4. API Design

The following table records the routes listed in `docs/ARCHITECTURE.md`.
The exact request/response Pydantic class names and field definitions
are not enumerated in that document; consult
`backend/app/schemas/models.py` and `backend/app/api/routes.py` before
treating any payload as a formal API contract.

  ------------------------------------------------------------------------------------------
  Method                  Endpoint                                   Responsibility
  ----------------------- ------------------------------------------ -----------------------
  POST                    `/auth/signup`                             Development signup

  POST                    `/auth/login`                              Development login

  GET                     `/me`                                      Return current user
                                                                     profile

  GET                     `/subjects`                                List subjects

  GET                     `/concepts`                                List concepts

  GET                     `/concepts/{id}`                           Return concept details
                                                                     and mastery

  POST                    `/concepts/custom`                         Analyze a custom topic,
                                                                     optionally using
                                                                     material

  POST                    `/materials/upload`                        Upload, validate,
                                                                     extract, and embed
                                                                     material

  POST                    `/materials/{id}/analyze`                  Analyze uploaded
                                                                     material

  POST                    `/sessions`                                Create a teaching
                                                                     session

  GET                     `/sessions/{id}`                           Fetch full session view

  POST                    `/sessions/{id}/message`                   Process a learner
                                                                     explanation

  POST                    `/sessions/{id}/transfer-test`             Generate a transfer
                                                                     problem

  POST                    `/sessions/{id}/transfer-test/answer`      Evaluate a transfer
                                                                     answer and finalize
                                                                     mastery

  POST                    `/sessions/{id}/evaluate`                  Finalize now or fetch
                                                                     final evaluation

  GET                     `/students/{id}/mastery`                   Return mastery data

  GET                     `/students/{id}/sessions`                  Return student sessions

  GET                     `/students/{id}/dashboard`                 Return student
                                                                     dashboard

  POST/GET                `/professor/courses`                       Create/list courses

  POST/GET                `/professor/courses/{id}/students`         Manage/list course
                                                                     students

  GET                     `/professor/courses/{id}/analytics`        Return course analytics

  GET                     `/professor/courses/{id}/misconceptions`   Return misconception
                                                                     analytics

  GET                     `/professor/courses/{id}/concepts/{cid}`   Return concept
                                                                     drill-down

  GET                     `/professor/courses/{id}/students/{sid}`   Return student
                                                                     drill-down
  ------------------------------------------------------------------------------------------

### 4.1 API conventions

-   The backend is a FastAPI application.
-   Pydantic models are used for request/response data validation.
-   Authentication, role checks, and rate limiting are associated with
    `app/api/deps.py`.
-   Exact status codes and payload fields should be taken from the route
    and schema implementation, not inferred from endpoint names.

## 5. Session Service

`backend/app/services/session_service.py` is the orchestration layer for
the teaching interaction.

### 5.1 Responsibilities

1.  Load and maintain session state.
2.  Save the learner message.
3.  Retrieve relevant learning-material chunks.
4.  Ask the evaluator agent to assess the learner's explanation.
5.  Update concept-node mastery using deterministic application logic.
6.  Adjust difficulty.
7.  Identify the weakest or next focus node.
8.  Choose the next question type.
9.  Generate Alex's response.
10. Save the response and return feedback and progress.

### 5.2 Teaching message sequence

``` mermaid
sequenceDiagram
    participant Route as FastAPI Route
    participant Service as SessionService
    participant Repo as Repository
    participant RAG as Retrieval Store
    participant Evaluator as Evaluator Agent
    participant Engine as Mastery Engine
    participant Alex as Student Agent

    Route->>Service: learner message + session context
    Service->>Repo: load session and save learner message
    Service->>RAG: retrieve relevant chunks
    RAG-->>Service: top-3 chunks
    Service->>Evaluator: evaluate learner response
    Evaluator-->>Service: structured evaluation JSON
    Service->>Engine: update mastery evidence
    Engine-->>Service: mastery, difficulty, focus
    Service->>Alex: generate next response
    Alex-->>Service: response text
    Service->>Repo: save response and updated session
    Service-->>Route: reply, feedback, progress
```

## 6. Session State Machine

The documented phases are `TEACHING`, `TRANSFER`, and `COMPLETE`.

``` mermaid
stateDiagram-v2
    [*] --> TEACHING
    TEACHING --> TEACHING: another teaching turn
    TEACHING --> TRANSFER: transfer test
    TRANSFER --> COMPLETE: answer evaluated
    TEACHING --> COMPLETE: evaluate without transfer
    COMPLETE --> [*]
```

The architecture documents readiness for transfer after: - At least four
turns and the misconception has been corrected; or - At least eight
turns.

The API also exposes an explicit transfer-test endpoint. An explicit
evaluate operation can complete a session without the transfer step.

### 6.1 Session state fields

The architecture lists these state fields: - `phase` - `difficulty`
(range 1--6) - `turn` - `attempts` - `focus_node` - `misconception` -
`misconception_corrected` - `nodes_explained` - `weak_concepts` -
`concepts_mastered`

Exact types, defaults, and serialization details must be verified in the
implementation.

## 7. Agent Responsibilities

The architecture describes one prompt file per agent and corresponding
functions in `backend/app/agents/agents.py`.

  -----------------------------------------------------------------------
  Agent                               Responsibility
  ----------------------------------- -----------------------------------
  Concept analyzer                    Analyze a topic and identify
                                      concepts/knowledge structure

  Misconception generator             Generate a candidate misconception
                                      associated with a target knowledge
                                      node

  Misconception validator             Check whether a candidate is
                                      suitable and educationally useful

  Alex / student agent                Respond as the AI student being
                                      taught

  Socratic questioner                 Generate a question that prompts
                                      deeper explanation

  Evaluator                           Assess the learner's explanation
                                      and return structured evaluation

  Transfer generator                  Generate a problem that checks
                                      application beyond the original
                                      explanation
  -----------------------------------------------------------------------

### 7.1 Evaluator isolation

The architecture explicitly states that the evaluator does not see
Alex's persona and returns structured JSON only. Evaluator reasoning is
not exposed to the learner.

### 7.2 Provider abstraction

`backend/app/ai/provider.py` provides the AI provider abstraction.
Documented provider choices are: - OpenAI - Gemini - Mock

The README says the default `mock` provider is deterministic and
keyword-based, and is substantially cruder than a real model. Real
provider use requires configuring `AI_PROVIDER` and the matching API key
in `backend/.env`.

## 8. Misconception Generation and Validation

The documented generation output contains: - `target_node` -
`statement` - `severity` - `difficulty` - `reason`

The validation dimensions are: - `grounded` - `plausible` - `relevant` -
`difficulty_fit` - `educational_value`

Acceptance rule documented in the architecture: - Every validation
criterion must be at least `0.6`. - Mean score must be at least `0.7`. -
Verdict must be `accept`.

Candidates targeting unknown knowledge nodes are dropped. If no
candidate survives validation, the API returns HTTP `422` rather than
presenting a weak misconception.

## 9. Mastery Engine

`backend/app/mastery/engine.py` performs weighted evidence aggregation,
adaptive difficulty, and final-state calculation.

### 9.1 Evidence score

When a knowledge node is demonstrated:

``` text
e = 0.5 × accuracy
  + 0.3 × reasoning
  + 0.2 × completeness
```

When the focus node is asked about but not demonstrated, evidence is
capped at `0.35`.

### 9.2 Evidence weight

For difficulty `d`:

``` text
w = 0.6 + 0.2 × d
```

The documented difficulty range is 1--6.

### 9.3 Weighted update

Let: - `W` = previous evidence weight - `score` = previous mastery
score - `e` = new evidence score - `w` = new evidence weight

The architecture documents:

``` text
W' = W × 0.85
score' = (score × W' + e × w) / (W' + w)
```

This decays older evidence before incorporating the new evidence.

### 9.4 Final mastery state

  -----------------------------------------------------------------------
  Final state                         Documented condition
  ----------------------------------- -----------------------------------
  `MASTERED`                          Average mastery ≥ 0.78, transfer ≥
                                      0.7, and misconception corrected

  `NEEDS_REINFORCEMENT`               Average mastery \< 0.5 or transfer
                                      \< 0.4

  `PARTIALLY_MASTERED`                Otherwise
  -----------------------------------------------------------------------

These thresholds are taken from the architecture document.

## 10. Retrieval-Augmented Generation (RAG)

### 10.1 Ingestion flow

`backend/app/ingestion/extract.py` handles extraction and validation.
The documented supported formats are PDF, PPTX, DOCX, and TXT.

``` mermaid
flowchart TD
    A[File upload] --> B[Validate MIME type]
    B --> C[Validate magic bytes and size]
    C --> D[Extract text]
    D --> E[Clean text]
    E --> F[Chunk text]
    F --> G[Generate embeddings]
    G --> H[Store chunks and vectors]
```

### 10.2 Chunking and retrieval

The architecture documents: - Chunk size: 800 characters. - Overlap: 120
characters. - Retrieval: top 3 chunks for the evaluator at each turn. -
Analyzer and misconception generator receive source text.

### 10.3 Embedding backends

-   Default development option: dependency-free hashing embeddings.
-   Optional: `EMBEDDING_BACKEND=sentence-transformers`.
-   Production direction: pgvector-backed storage.

## 11. Data Model

The architecture describes the following entities and relationships. The
authoritative column definitions and constraints are in
`backend/app/database/schema.sql`.

  -----------------------------------------------------------------------
  Entity                              Purpose / relationship described
  ----------------------------------- -----------------------------------
  `users`                             User accounts; professors own
                                      courses

  `courses`                           Courses associated with a professor

  `course_students`                   Many-to-many course/student
                                      enrollment

  `concepts`                          Concepts belonging to courses

  `knowledge_nodes`                   Concept decomposition; supports
                                      parent-child hierarchy

  `misconceptions`                    Misconceptions associated with
                                      concepts and target nodes

  `learning_materials`                Materials uploaded by users

  `material_chunks`                   Extracted chunks with vector
                                      embeddings

  `learning_sessions`                 Student learning sessions focused
                                      on concepts

  `messages`                          Conversation messages in a session

  `evaluations`                       Evaluation records associated with
                                      messages

  `mastery`                           Per-user, per-knowledge-node score
                                      and evidence weight

  `transfer_tests`                    Transfer assessment associated with
                                      a session

  `misconception_events`              Misconception-related events
                                      recorded in a session
  -----------------------------------------------------------------------

The schema also includes row-level-security policies for the intended
Supabase/Postgres deployment.

## 12. Authentication and Authorization

The README documents the current state: - Development login uses an
`X-User-Id` header. - A Supabase JWT verification path exists in
`deps.py` but is untested. - The frontend does not yet have Supabase
sign-in. - Role and ownership checks are listed among the working
features.

Do not describe the current development header as production
authentication. Production authentication requires completing and
testing the Supabase JWT and frontend sign-in flow.

## 13. Repository and Persistence Layer

`backend/app/database/repo.py` contains the repository abstraction and
current in-memory `MemoryRepo` implementation, according to the README.

Current behavior: - Data is held in memory. - Data resets when the
backend restarts.

Planned persistence: - `backend/app/database/schema.sql` defines the
Supabase/Postgres schema and RLS. - A Supabase-backed repository still
needs to be implemented against the same interface.

## 14. Professor Analytics

`backend/app/services/analytics.py` provides professor aggregates. The
documented UI includes: - Concept understanding bars. - Misconception
heatmap. - Concept drill-down showing root issue and reteaching hint. -
Misconception drill-down with anonymized samples, node, count, and
reteaching suggestion.

The README warns that current anonymized samples use a simple alias and
must be hardened before real student data is used.

## 15. Error Handling and Validation

The public architecture specifically documents: - Upload MIME,
magic-byte, and size validation. - Unknown misconception target nodes
are discarded. - A `422` response is returned if no misconception
candidate passes validation. - Rate limiting is included in backend
dependencies.

Exact error response structure, exception mapping, and all endpoint
status codes are not specified in the public architecture summary.
Verify those details in the route implementation before publishing an
API contract.

## 16. Configuration

Backend variables listed in the architecture: - `AI_PROVIDER` -
`OPENAI_API_KEY` - `OPENAI_MODEL` - `GEMINI_API_KEY` - `GEMINI_MODEL` -
`SUPABASE_URL` - `SUPABASE_SERVICE_ROLE_KEY` - `SUPABASE_JWT_SECRET` -
`EMBEDDING_BACKEND` - `MAX_UPLOAD_MB` - `RATE_LIMIT_PER_MINUTE` -
`CORS_ORIGINS`

Frontend variable: - `NEXT_PUBLIC_API_URL`

Use `.env.example` and `.env.local.example` for exact defaults. Never
place real secrets in source control.

## 17. Testing

The repository architecture identifies `backend/tests/test_flow.py` as
covering the end-to-end loop and isolation tests. The README documents:

``` bash
cd backend
pytest tests
```

The README also states that the frontend has been typechecked, but
`next build` and browser testing have not yet been run. Do not claim
those checks passed unless they are run and verified.

## 18. Known Implementation Gaps

-   Persistent Supabase repository is pending; current storage is
    in-memory.
-   Production Supabase authentication is not fully tested or connected
    to frontend sign-in.
-   Image/OCR, diagram, and code input are not implemented.
-   Voice support is currently browser speech API only.
-   Hashing embeddings are the default stand-in.
-   Professor sample anonymization needs hardening.
-   Frontend production build and browser-level testing remain to be
    verified.
