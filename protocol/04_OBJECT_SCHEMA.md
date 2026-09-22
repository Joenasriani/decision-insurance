# Canonical Object Schema

All canonical state must use explicit objects and relationships.

## Allowed Object Types

- DECISION
- CLAIM
- EVIDENCE
- ASSUMPTION
- CONTRADICTION
- UNKNOWN
- SOURCE
- CHUNK

## SOURCE

```json
{
  "id": "S1",
  "type": "SOURCE",
  "label": "",
  "source_role": "PRIMARY_INPUT_REPORT|RESEARCH_SOURCE|SUPPORTING_EVIDENCE|COUNTER_EVIDENCE|USER_REFERENCE|PRIOR_ANALYSIS|UNKNOWN_ROLE",
  "mime_type": "",
  "page_count": null,
  "extraction_status": "COMPLETE|PARTIAL|FAILED|NOT_REQUIRED",
  "provenance_status": "VERIFIED|USER_SUPPLIED|UNVERIFIED"
}
```

## CHUNK

```json
{
  "id": "K1",
  "type": "CHUNK",
  "source_id": "S1",
  "page_start": 1,
  "page_end": 1,
  "section_heading": "",
  "raw_text": "",
  "chunk_order": 1,
  "extraction_method": "NATIVE|OCR|PASTED"
}
```

## DECISION

```json
{
  "id": "D1",
  "type": "DECISION",
  "question": "",
  "original_recommendation": "",
  "created_at": "",
  "version": 1
}
```

## CLAIM

```json
{
  "id": "C1",
  "type": "CLAIM",
  "text": "",
  "normalized_text": "",
  "criticality": "CRITICAL|IMPORTANT|SUPPORTING",
  "status": "SUPPORTED|PARTIAL|UNSUPPORTED|ASSUMPTION|CONTRADICTED|UNKNOWN",
  "evidence_ids": [],
  "assumption_ids": [],
  "contradiction_ids": [],
  "unknown_ids": [],
  "source_id": "",
  "chunk_id": "",
  "source_span": "",
  "human_override": false
}
```

## EVIDENCE

```json
{
  "id": "E1",
  "type": "EVIDENCE",
  "source_id": "",
  "chunk_id": "",
  "source_title": "",
  "source_type": "",
  "source_locator": "",
  "page_start": null,
  "page_end": null,
  "source_date": "",
  "retrieval_date": "",
  "quoted_or_extracted_text": "",
  "normalized_fact": "",
  "strength": "HIGH|MEDIUM|LOW|UNASSESSED",
  "provenance_status": "VERIFIED|USER_SUPPLIED|UNVERIFIED",
  "supports_claim_ids": [],
  "contradicts_claim_ids": []
}
```

## ASSUMPTION

```json
{
  "id": "A1",
  "type": "ASSUMPTION",
  "text": "",
  "required_by_claim_ids": [],
  "evidence_ids": [],
  "status": "OPEN|SUPPORTED|REJECTED"
}
```

## CONTRADICTION

```json
{
  "id": "X1",
  "type": "CONTRADICTION",
  "description": "",
  "claim_ids": [],
  "evidence_ids": [],
  "severity": "CRITICAL|MATERIAL|MINOR"
}
```

## UNKNOWN

```json
{
  "id": "U1",
  "type": "UNKNOWN",
  "question": "",
  "required_for_claim_ids": [],
  "required_evidence": "",
  "retrieval_status": "NOT_ATTEMPTED|INSUFFICIENT|EXHAUSTED"
}
```

## Relationships

Allowed:

- SUPPORTS
- CONTRADICTS
- DEPENDS_ON
- LEADS_TO
- MISSING_FOR
- CONTAINED_IN
- EXTRACTED_FROM

Every relationship must contain explicit source and target IDs.

IDs MUST remain stable across reevaluations.
