# Decision Insurance

Decision Insurance checks whether the sources you provide actually support a report or recommendation before you act on it.

It accepts a report under examination plus research material from pasted text, PDFs, DOCX files, Markdown, plain text files, public webpages, articles, blog posts, and direct research URLs.

It breaks the main report into important statements, connects those statements to the sources you provide, and shows what is supported, what conflicts, what is assumed, and what still needs evidence. Every material finding must trace back to a source.

## Canonical execution

`INGEST → PARSE → REGISTER → RETRIEVE → STRUCTURE → EVALUATE → CHALLENGE → LOCATE FAILURE → CORRECT → REEVALUATE → RECORD`

## Current build

The first executable revision contains:

* server side webpage reading with private network rejection
* PDF, DOCX, text, and Markdown intake
* source role registration
* local semantic chunk preparation
* atomic claim decomposition
* source linked retrieval
* evidence state classification
* contradiction and unknown states
* claim challenge
* manual classification override
* versioned local examination storage
* the strict protocol package under `protocol/`

When no model adapter is configured, the application runs a deterministic decomposition and lexical retrieval fallback so the evidence workflow remains inspectable.

## Product rule

A model statement is never evidence merely because the model said it.

## Correction loop

The project began with this learning cycle:

```python
optimizer.zero_grad()
predictions = model(inputs)
loss = loss_fn(predictions, targets)
loss.backward()
optimizer.step()
```

Decision Insurance translates that pattern into an evidence correction cycle:

`CLEAR EVALUATION STATE → INGEST REASONING → MEASURE EVIDENCE ERROR → LOCATE FAILURE → UPDATE ANALYSIS → REEVALUATE`

The MVP does not retrain model weights. It updates claims, evidence links, assumptions, contradictions, unknowns, classifications, review rules, and examination state.

## Interface language

User-facing wording follows the first-time usability rules in [UX_LANGUAGE_RULES.md](UX_LANGUAGE_RULES.md). Technical protocol language remains available under `protocol/` without being pushed into the primary interface.
