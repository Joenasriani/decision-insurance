# Claim Extraction Protocol

## Goal

Convert source material into atomic, evaluable propositions.

## Required Extraction

The model MUST identify:

1. main decision/recommendation
2. explicit factual claims
3. evaluative claims
4. causal claims
5. predictive claims
6. assumptions required by reasoning
7. unresolved factual dependencies
8. source spans and provenance

## Atomicity

A claim must be independently evaluable.

Bad:
`Supplier X is financially stable, reliable, and low risk.`

Better:
- Supplier X is financially stable.
- Supplier X is operationally reliable.
- Supplier X is low risk.

## No Over-Extraction

Do not create trivial claims with no decision relevance.

Prioritize claims affecting:

- risk
- feasibility
- cost
- expected outcome
- recommendation
- critical dependency

## Criticality

### CRITICAL
If false/unresolved, the decision could materially change.

### IMPORTANT
Affects confidence or quality.

### SUPPORTING
Secondary context.

## Assumption Extraction

Create an assumption when reasoning requires an unstated or unverified premise.

## Unknown Extraction

Create UNKNOWN when a required fact is absent or cannot be reliably extracted.

Do not fill document gaps with model knowledge unless retrieval is explicitly permitted and provenance is captured.
