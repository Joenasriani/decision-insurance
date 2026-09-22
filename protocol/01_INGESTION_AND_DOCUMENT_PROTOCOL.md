# Ingestion and Document Protocol

## 1. Purpose

This protocol governs pasted content and uploaded research files, including PDFs.

Uploaded files may be:

- the report being evaluated
- evidence supporting the report
- a research corpus
- mixed-source reference material

The system MUST identify the role of each document.

## 2. Supported Source Roles

Each source must be classified as one of:

- PRIMARY_INPUT_REPORT
- RESEARCH_SOURCE
- SUPPORTING_EVIDENCE
- COUNTER_EVIDENCE
- USER_REFERENCE
- PRIOR_ANALYSIS
- UNKNOWN_ROLE

A source role may be changed by the user.

## 3. Document Registration

Every uploaded or pasted source MUST receive:

- source_id
- filename or source label
- source_role
- mime/type when known
- ingestion_timestamp
- checksum/hash if implementation supports it
- page count when available
- extraction_status
- provenance_status

## 4. PDF Handling

For PDFs:

1. extract native text when available
2. preserve page boundaries
3. preserve headings/sections when detectable
4. preserve tables as structured blocks when possible
5. preserve captions and footnotes where material
6. record page number for every extracted chunk
7. mark unreadable regions explicitly
8. do not infer missing text

If the PDF is scanned or text extraction is unreliable:

- use OCR only if the implementation supports it
- record `extraction_method = OCR`
- record OCR uncertainty
- do not treat uncertain OCR strings as high-confidence evidence
- mark unresolved passages as unreadable

## 5. Document Chunking

Chunking MUST preserve semantic structure.

Prefer chunk boundaries at:

- headings
- paragraphs
- table sections
- list boundaries
- page boundaries

Avoid arbitrary splitting that destroys claim context.

Each chunk MUST store:

- chunk_id
- source_id
- page_start
- page_end
- section_heading
- raw_text
- normalized_text
- chunk_order
- extraction_method

## 6. Source Span Preservation

Every extracted claim or evidence item originating in a document MUST retain:

- source_id
- chunk_id
- page number(s) when available
- exact source span or short quotation when available

The system MUST be able to navigate from a claim/evidence object back to its source location.

## 7. Multiple Uploaded Research Files

When multiple research files are uploaded:

- do not merge them into one anonymous corpus
- preserve source identity
- detect duplicate or syndicated material
- allow contradictory documents to coexist
- never resolve disagreement by source count alone

## 8. Research as RAG Corpus

Uploaded research documents MAY become the primary RAG corpus.

Retrieval should search the uploaded corpus before external sources unless the user or application configuration specifies otherwise.

## 9. Tables and Structured Data

When a PDF or document contains a table:

- preserve row/column relationships where possible
- do not flatten numbers into prose if that changes meaning
- record units
- record date periods
- distinguish totals from subtotals
- retain table title and page provenance

## 10. Citation Integrity

If a PDF cites another source, that citation is not automatically equivalent to possessing the cited source.

Record:

- `citation_present = true`
- cited reference text if available

Do not upgrade it to verified evidence unless the cited source itself is available or independently retrieved.

## 11. Extraction Failure

If a document is corrupted, password protected, unreadable, or only partially extractable:

- register the source
- set extraction status appropriately
- preserve successfully extracted portions
- do not pretend the entire document was analyzed
- surface the limitation in the final record
