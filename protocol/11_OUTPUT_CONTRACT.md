# Output Contract

## 1. Canonical Output

The system MUST produce structured state.

Minimum top-level structure:

```json
{
  "analysis_id": "",
  "version": 1,
  "decision": {},
  "sources": [],
  "chunks": [],
  "claims": [],
  "evidence": [],
  "assumptions": [],
  "contradictions": [],
  "unknowns": [],
  "relationships": [],
  "challenges": [],
  "readiness": {},
  "limitations": [],
  "change_log": []
}
```

## 2. Validation Requirements

Before accepting output:

- all IDs unique
- all referenced IDs exist
- every SUPPORTED claim has evidence
- every evidence object has provenance status
- every document-derived evidence item has source_id
- page fields must be null or valid; never invented
- every CRITICAL unresolved claim appears in readiness
- no forbidden object type appears

## 3. Human-Facing Summary

After structured validation, render:

1. decision question
2. evidence-state label
3. critical claims
4. material supporting evidence
5. unsupported claims
6. assumptions
7. contradictions
8. unknowns
9. missing evidence
10. document/retrieval limitations
11. next evidence required

## 4. Citation Display

For document-derived evidence, display when available:

`[Source Title — p. X]`

or

`[Source Title — pp. X–Y — Section]`

If page number is unavailable, use section/chunk locator.

Never invent a locator.

## 5. No Business Verdict

Do not output automatic APPROVE/REJECT/BUY/SELL decisions.

The product reports evidence condition and unresolved risk.
