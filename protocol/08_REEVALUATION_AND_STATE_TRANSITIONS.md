# Reevaluation and State Transition Protocol

## Canonical Loop

`GENERATE/INGEST -> STRUCTURE -> EVALUATE -> CHALLENGE -> LOCATE FAILURE -> CORRECT -> RE-EVALUATE -> RECORD`

## Versioning

Every material change creates a new analysis version.

Examples:

- new evidence added
- claim edited
- source role changed
- contradiction added
- user override applied
- retrieval expanded
- challenge materially changes classification

## State Preservation

Never overwrite prior state.

Store:

- prior status
- new status
- triggering change
- timestamp
- actor: AI|USER|SYSTEM
- affected object IDs

## Human Override

User changes MUST be preserved as explicit overrides.

The AI may flag inconsistency but must not silently undo the override.

## Re-evaluation Scope

Re-evaluate:

- changed object
- directly dependent claims
- decision readiness if any CRITICAL/IMPORTANT object changes

Avoid unnecessarily recomputing unrelated branches.

## Learning Analogy

Use neural-network training only as a conceptual analogy:

`prediction -> error -> correction`

The MVP does NOT update model weights.

It updates:

- classifications
- graph relationships
- prompts
- evidence requirements
- evaluation rules
- review state
