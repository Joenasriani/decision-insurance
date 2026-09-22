# Decision Insurance

Decision Insurance inspects the evidence structure behind a recommendation before action.

It accepts a report under examination plus research material from pasted text, PDFs, DOCX files, Markdown, plain text files, public webpages, articles, blog posts, and direct research URLs.

The system separates claims from evidence, assumptions, contradictions, and unknowns. Every material finding must trace back to a registered source.

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
