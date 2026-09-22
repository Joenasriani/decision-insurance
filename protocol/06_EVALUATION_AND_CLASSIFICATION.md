# Evaluation and Classification Protocol

## Evaluation Order

For each claim:

1. inspect linked evidence
2. test evidence directness
3. test source relevance
4. test temporal validity
5. inspect assumptions
6. inspect contradictions
7. inspect unknowns
8. inspect extraction reliability where document-derived
9. determine status
10. produce concise rationale summary

## Status Rules

### SUPPORTED
All material dimensions are established by adequate evidence.

### PARTIAL
Some but not all material dimensions are established.

### UNSUPPORTED
The claim lacks adequate evidence.

### ASSUMPTION
The proposition is needed but unestablished.

### CONTRADICTED
Credible evidence materially conflicts with the claim.

### UNKNOWN
The available information is insufficient.

## Inference Distance

- LOW: evidence directly establishes the proposition
- MEDIUM: limited explicit inference required
- HIGH: multiple assumptions/speculative reasoning required

A HIGH inference distance normally prevents SUPPORTED status unless the inference chain is independently established.

## Critical Gap Rule

If a CRITICAL claim is UNSUPPORTED, CONTRADICTED, ASSUMPTION, or UNKNOWN:

- mark `critical_gap = true`
- surface it in decision readiness
- do not suppress it beneath aggregate scoring

## No Majority Voting

Support is not determined by source count.

Quality, directness, independence, and temporal validity matter more.

## No Hidden Reasoning

Return structured rationale summaries only.

Do not expose private chain-of-thought.
