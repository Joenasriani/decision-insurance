# Implementation Sequence

## Phase 1 — Ingestion

Implement:

- paste input
- document upload
- PDF parsing
- page-preserving extraction
- source registration
- chunk creation

Exit criterion:
Every usable source can be traced to source/chunk/page metadata.

## Phase 2 — Claim Engine

Implement:

- atomic claim extraction
- criticality
- assumptions
- unknowns
- source-span linkage

Exit criterion:
Claims are independently evaluable and source-traceable.

## Phase 3 — RAG Retrieval

Implement:

- uploaded corpus index
- claim-driven retrieval
- duplicate detection
- evidence object creation
- provenance

Exit criterion:
Retrieved evidence is linked to exact claims and exact source locations.

## Phase 4 — Evaluation

Implement:

- evidence relevance
- inference distance
- status classification
- critical gap logic

Exit criterion:
No SUPPORTED claim exists without valid evidence.

## Phase 5 — Challenge

Implement structured adversarial testing.

Exit criterion:
Critical claims can be tested for missing evidence, assumptions, alternatives, and contradictions.

## Phase 6 — Inspector UI

Allow users to inspect:

- claim
- evidence
- PDF page/source location
- assumptions
- contradictions
- unknowns
- challenge results

## Phase 7 — Graph

Render canonical state visually.

Graph is a view, never the source of truth.

## Phase 8 — Reevaluation

Implement:

- version history
- human overrides
- dependency-aware reevaluation
- change log

## Phase 9 — Decision Readiness

Implement deterministic evidence-state summary.

## Phase 10 — Validation Suite

Run all cases from `10_VALIDATION_AND_FAIL_CONDITIONS.md`.

Do not ship if hard-fail cases can silently pass.
