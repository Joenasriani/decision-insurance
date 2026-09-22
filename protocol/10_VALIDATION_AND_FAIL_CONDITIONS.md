# Validation and Fail Conditions

## Required Validation Cases

### A. Well-supported conclusion
Do not invent weaknesses.

### B. Unsupported conclusion
Identify insufficient evidence.

### C. Correct evidence, invalid inference
Separate fact from inference.

### D. Hidden assumption
Expose the assumption.

### E. Contradictory evidence
Preserve both sides and classify appropriately.

### F. Unknown information
Do not fill gaps.

### G. Mixed-strength report
Classify claim-by-claim.

### H. User correction
Preserve overrides.

### I. Uploaded PDF with page provenance
Claims/evidence must map to page/chunk.

### J. Scanned or partially unreadable PDF
Unreadable sections must remain unresolved.

### K. Conflicting uploaded research
Do not resolve by document count.

### L. Duplicate sources
Do not count duplicated material as independent support.

## Hard Fail Conditions

Return failure/unresolved state if:

- no usable source content exists
- source extraction fails completely
- canonical output cannot be validated
- required IDs are missing or duplicated
- claim status references nonexistent evidence
- page provenance is fabricated
- document role cannot be determined and affects interpretation
- structured output is malformed after retry limit

## Soft Fail Conditions

Continue with explicit limitation if:

- some pages are unreadable
- metadata is missing
- retrieval is incomplete
- a source date is unknown
- source authority is uncertain

Soft failures must appear in final limitations.
