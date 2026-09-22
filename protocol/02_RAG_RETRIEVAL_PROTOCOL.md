# RAG Retrieval Protocol

## 1. Retrieval Objective

Retrieval exists to obtain evidence relevant to explicit claims and decision-critical unknowns.

Retrieval MUST be claim-driven.

Do not retrieve broadly without a defined target.

## 2. Retrieval Priority

Default order:

1. exact source span from the primary input
2. uploaded research corpus
3. prior approved evidence objects
4. approved internal corpus
5. approved external retrieval sources, if enabled

The system MUST record which retrieval layer produced each result.

## 3. Retrieval Order Per Claim

For each claim:

1. identify claim text
2. identify claim type
3. identify evidence requirements
4. search primary input context
5. search uploaded corpus
6. search approved additional corpus
7. search approved external sources only if enabled
8. record retrieved evidence
9. evaluate relevance
10. evaluate whether evidence actually supports the claim
11. preserve missing evidence if not found

## 4. Retrieval Query Construction

Each query SHOULD include:

- claim subject
- claim predicate
- date/period when relevant
- exact entity names
- evidence dimension required

Bad:
`Supplier X`

Better:
`Supplier X audited financial statements 2025 debt liquidity`

## 5. Retrieval Unit

Each retrieved evidence item MUST be stored discretely.

Required fields:

- evidence_id
- source_id
- chunk_id when document-based
- source_title
- source_type
- source_locator
- source_date
- page_start/page_end when available
- retrieval_date
- extracted_text
- normalized_fact
- relevance_to_claim_ids
- provenance_status
- retrieval_method

## 6. Source Priority

Prefer:

1. primary source
2. official source
3. direct institutional record
4. audited/regulatory/contractual record
5. reputable secondary source
6. specialist secondary source
7. general source
8. user-supplied unverified material

Source priority does NOT substitute for logical relevance.

## 7. Retrieval Failure

If retrieval returns nothing sufficient:

- do not infer missing facts
- create/preserve UNKNOWN
- set `retrieval_status = INSUFFICIENT`
- record queries attempted when available
- state exact evidence still required

## 8. Duplicate Retrieval

Duplicates MUST NOT inflate support.

Repeated copies of the same underlying source are one evidence lineage, not independent corroboration.

## 9. Temporal Validity

Current claims require current or continuity-valid evidence.

Historical evidence MUST NOT be treated as current proof unless continuity is established.

## 10. Retrieval Stop Rule

Stop when:

- sufficient direct evidence exists
- a material contradiction is established
- approved retrieval budget is exhausted
- no valid retrieval path remains
- source boundary is reached

Stopping retrieval does not itself determine claim status.
