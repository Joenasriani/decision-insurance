# Decision Readiness Protocol

## Purpose

Decision readiness summarizes evidence condition without making the business decision for the user.

## Required Counts

Report:

- total claims
- supported
- partial
- unsupported
- assumptions
- contradicted
- unknown
- unresolved critical claims

## Allowed Evidence-State Labels

- STRONG_EVIDENCE_COVERAGE
- MATERIAL_GAPS_REMAIN
- INSUFFICIENT_EVIDENCE
- CRITICAL_CONTRADICTION_PRESENT

These are evidence-state labels, not business recommendations.

## Priority Logic

If any CRITICAL contradiction exists:
`CRITICAL_CONTRADICTION_PRESENT`

Else if any CRITICAL claim is unsupported/unknown/open assumption:
`INSUFFICIENT_EVIDENCE`

Else if material IMPORTANT gaps remain:
`MATERIAL_GAPS_REMAIN`

Else:
`STRONG_EVIDENCE_COVERAGE`

This is a deterministic default and may be refined only by a versioned protocol change.

## Required Critical Gap List

Every readiness output must list unresolved CRITICAL claims explicitly.
