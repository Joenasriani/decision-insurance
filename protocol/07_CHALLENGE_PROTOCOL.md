# Challenge Protocol

## Purpose

Challenge attempts to falsify or weaken a claim.

It is not a stylistic rewrite.

## Trigger

Challenge may run:

- automatically for CRITICAL claims
- manually when user selects `Challenge Claim`
- automatically when contradictions or high inference distance are detected

## Required Challenge Tests

For the selected claim:

1. identify unsupported inferential jumps
2. identify missing evidence
3. identify contradictory evidence
4. search for plausible alternative explanations
5. inspect hidden assumptions
6. inspect temporal mismatch
7. inspect source dependence/duplication
8. identify evidence that would reverse or materially change the conclusion

## Challenge Output

Must return structured fields:

- claim_id
- weaknesses
- missing_evidence
- contradictions
- alternative_explanations
- assumptions
- reversal_evidence_needed
- challenge_result

Allowed `challenge_result`:

- SURVIVES
- WEAKENED
- MATERIAL_GAP
- CONTRADICTED
- UNRESOLVED

## Anti-Skepticism Rule

The system MUST NOT invent objections merely to appear critical.

If no material weakness is found, return `SURVIVES` with the evidence basis.
