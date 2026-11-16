# TeachMeWrong --- Product Requirements Document (PRD)

**Document status:** Draft based on the current public repository\
**Product:** TeachMeWrong\
**Repository:** https://github.com/gnana2007/teachme_wrong\
**Primary reference:** `README.md` and `docs/ARCHITECTURE.md`

------------------------------------------------------------------------

## 1. Product Overview

TeachMeWrong is an interactive learning platform built around the
learning-by-teaching approach. Instead of presenting an AI as an answer
machine, the product presents Alex, an AI student who begins with a
plausible misconception.

A human learner teaches Alex by explaining, defending, and applying a
concept. An independent evaluator assesses the learner's responses, a
deterministic mastery engine updates concept-level mastery, and a
transfer problem checks whether the learner can apply the concept in a
new context. Professors can inspect class-level concept understanding
and misconception patterns.

## 2. Problem Statement

Traditional digital learning experiences often emphasize receiving
explanations and answers. They may provide limited opportunity for
learners to articulate their reasoning, identify gaps in their own
understanding, and demonstrate transfer to a new problem.

TeachMeWrong addresses this by making the learner responsible for
teaching and correcting an AI student's misconceptions. The platform
records evidence from the teaching interaction and uses that evidence to
estimate mastery at the concept level.

## 3. Product Goals

1.  Encourage active learning through explanation and correction.
2.  Make learner reasoning observable through structured evaluation.
3.  Track mastery at concept and knowledge-node level rather than
    relying only on completion.
4.  Adapt question difficulty based on learner performance.
5.  Verify learning through a transfer problem.
6.  Give professors aggregated visibility into class-wide understanding
    and recurring misconceptions.
7.  Allow learning material to be uploaded, processed, and retrieved as
    supporting context.

## 4. Target Users

### 4.1 Students

Students use the platform to: - Browse subjects and concepts. - Start a
teaching session with Alex. - Explain concepts and respond to
questions. - Review feedback and mastery progress. - Complete a transfer
test. - Review the final mastery state and recommended next actions.

### 4.2 Professors

Professors use the platform to: - Create and manage courses. - View
course rosters. - Inspect class-level concept understanding. - Explore
misconception patterns and anonymized examples. - Identify concepts that
may need reteaching.

## 5. Core Product Experience

### 5.1 Student learning flow

1.  The student signs in or uses the available demo flow.
2.  The student browses subjects and concepts.
3.  The student starts a session for a concept.
4.  Alex opens with a plausible misconception.
5.  The student explains the concept through a conversation.
6.  The evaluator assesses the response and returns structured feedback.
7.  The mastery engine updates evidence and mastery.
8.  The system adjusts difficulty and selects a suitable next focus.
9.  The student completes a transfer problem, when applicable.
10. The platform calculates and displays the final mastery state.

### 5.2 Professor flow

1.  A professor signs in.
2.  The professor opens a course.
3.  The professor reviews concept understanding and the misconception
    heatmap.
4.  The professor drills down into a concept or misconception pattern.
5.  The professor reviews anonymized samples and reteaching suggestions.

## 6. Functional Requirements

  -----------------------------------------------------------------------
  ID                      Requirement             Current status from
                                                  repository
  ----------------------- ----------------------- -----------------------
  FR-01                   Provide student and     Implemented in the
                          professor experiences   current application

  FR-02                   Allow users to browse   Implemented
                          subjects and concepts   

  FR-03                   Start a learning        Implemented
                          session for a concept   

  FR-04                   Have Alex present a     Implemented
                          plausible misconception 

  FR-05                   Accept learner messages Implemented
                          and evaluate            
                          explanations            

  FR-06                   Return structured       Implemented
                          evaluation feedback     

  FR-07                   Update concept-level    Implemented
                          mastery using weighted  
                          evidence                

  FR-08                   Adapt difficulty and    Implemented
                          select weaker knowledge 
                          nodes                   

  FR-09                   Generate and evaluate a Implemented
                          transfer problem        

  FR-10                   Display student mastery Implemented
                          and session information 

  FR-11                   Provide professor       Implemented
                          course and roster views 

  FR-12                   Provide professor       Basic implementation
                          analytics and           present
                          misconception views     

  FR-13                   Upload learning         Implemented
                          materials and extract   
                          supported document text 

  FR-14                   Chunk, embed, store,    Implemented with a
                          and retrieve learning   development
                          material context        hashing-embedding
                                                  stand-in by default

  FR-15                   Support real LLM        Provider integration
                          providers               exists for OpenAI and
                                                  Gemini; mock is the
                                                  default

  FR-16                   Persist application     Not complete; current
                          data across restarts    repository describes
                          using Supabase          in-memory `MemoryRepo`
                                                  storage

  FR-17                   Provide production      Not complete; current
                          Supabase authentication development flow uses
                          in the frontend         an `X-User-Id` header

  FR-18                   Support image/OCR,      Not implemented
                          diagram, and code       
                          learner input           

  FR-19                   Provide voice input     Browser speech API
                                                  only; not a full
                                                  modality implementation
  -----------------------------------------------------------------------

## 7. Non-Functional Requirements

The following are product requirements and engineering expectations;
they should be validated against the deployed environment.

-   **Security:** Keep AI provider credentials on the server. Enforce
    role and ownership checks on protected operations.
-   **Privacy:** Avoid exposing evaluator reasoning. Treat student
    submissions and uploaded learning materials as potentially
    sensitive.
-   **Reliability:** Return clear errors for invalid input, unsupported
    material, and failed operations.
-   **Performance:** Keep interactive teaching responses usable and
    retrieve only relevant learning-material chunks for evaluation.
-   **Maintainability:** Keep agents, prompts, mastery calculations,
    ingestion, API routes, and persistence concerns separated.
-   **Scalability:** Preserve a repository interface so the in-memory
    implementation can be replaced by persistent storage.
-   **Usability:** Make session progress, feedback, current focus, and
    final mastery understandable to students.
-   **Auditability:** Make mastery updates based on explicit evidence
    and deterministic rules rather than opaque LLM-generated scores.

## 8. Product Rules and Learning Logic

### 8.1 Teaching session progression

The documented session flow starts in `TEACHING`. A session can become
ready for transfer after at least four turns and correction of the
misconception, or after eight turns. The transfer flow proceeds through
`TRANSFER` and then `COMPLETE`. A session can also be finalized through
the evaluate endpoint without the transfer step.

### 8.2 Misconception validation

Generated misconception candidates are checked for: - Grounding -
Plausibility - Relevance - Difficulty fit - Educational value

The architecture document specifies each criterion must be at least
`0.6`, with a mean of at least `0.7`, and the verdict must be accepted.
Candidates targeting unknown knowledge nodes are dropped. If no
candidate survives, the API returns `422` rather than presenting a weak
misconception.

### 8.3 Mastery calculation

For a demonstrated knowledge node, evidence is documented as:

`e = 0.5 × accuracy + 0.3 × reasoning + 0.2 × completeness`

Evidence weight is:

`w = 0.6 + 0.2 × difficulty`

The previous evidence weight is decayed by `0.85` before incorporating
new evidence. If the focus node was asked about but not demonstrated,
the evidence is capped at `0.35`.

Final states documented by the repository: - `MASTERED`: average mastery
at least `0.78`, transfer score at least `0.7`, and misconception
corrected. - `NEEDS_REINFORCEMENT`: average mastery below `0.5` or
transfer score below `0.4`. - `PARTIALLY_MASTERED`: otherwise.

## 9. User-Facing Screens and Views

### Student

-   Landing and authentication views.
-   Subject and concept browsing.
-   Concept detail and mastery information.
-   Teaching session: concept map, Alex conversation, feedback, transfer
    card, composer, voice control, mastery bars, and difficulty.
-   End-of-session summary with strengths, reinforcement needs,
    misconception, transfer result, final state, and next actions.

### Professor

-   Course overview.
-   Concept understanding bars.
-   Misconception heatmap.
-   Concept drill-down with root issue and reteaching hint.
-   Misconception examples and counts.

## 10. Constraints and Known Limitations

The current README explicitly identifies these limitations: - Storage
currently uses an in-memory `MemoryRepo`; data resets on restart. - A
Supabase schema with row-level security is present, but the
Supabase-backed repository remains to be implemented. - Development
authentication uses an `X-User-Id` header. The Supabase JWT path exists
in backend dependencies but is untested, and frontend Supabase sign-in
is not present. - Voice uses browser speech APIs only. - Image/OCR,
diagrams, and code modalities are not implemented. - Hashing embeddings
are the default stand-in; a sentence-transformers option exists, and
pgvector is the production direction. - Professor anonymized samples
currently use a simple alias and require hardening before use with real
student data. - The frontend has been typechecked, but the README says
`next build` and browser testing have not been run.

## 11. Success Measures

The repository does not define numeric product KPIs. The following are
proposed measures to instrument before production: - Percentage of
started sessions that reach completion. - Percentage of sessions in
which the learner corrects Alex's misconception. - Transfer-test
completion and performance. - Change in concept mastery across repeated
sessions. - Frequency of concepts and misconception patterns flagged for
professor review. - Material ingestion success and retrieval
relevance. - Session response latency and API error rate.

These are proposed measurement ideas, not currently reported metrics.

## 12. Out of Scope for the Current Implementation

Unless separately implemented, the following must not be represented as
completed: - Production-grade Supabase persistence. - Fully tested
production authentication. - Image understanding and OCR. - Diagram and
code interpretation. - A dedicated voice-processing backend. - Fully
anonymized professor samples suitable for real student datasets.

## 13. Open Decisions

-   Confirm production identity provider and complete the frontend
    authentication flow.
-   Implement and test the Supabase repository.
-   Define retention and deletion policies for learner data and uploaded
    materials.
-   Harden anonymization before using real student data in professor
    analytics.
-   Select and evaluate the production embedding model and vector
    database configuration.
-   Define measurable learning-outcome targets and validate them with
    users.
