# First-Time User Interface Language Rules

These rules govern user-facing copy in Decision Insurance. The technical protocol may retain precise engineering and research terminology; the primary interface should not require users to understand that terminology.

## First-use success test

A person opening the app for the first time should be able to answer these questions without documentation:

1. What do I add?
2. Which item is the main report or recommendation being checked?
3. What decision am I trying to make?
4. What did the app find?
5. What should I inspect or add next?

If the interface does not answer those five questions, the wording or flow needs revision.

## Language rule

Use the user's task language before the system's implementation language.

Prefer:

- Check the evidence
- Main report or recommendation
- Research or background
- Evidence that challenges it
- Key statements to check
- Linked sources
- Important gaps remain
- Not enough evidence yet
- Stress-test this statement
- Still needed
- Another explanation

Keep these terms out of the primary interface unless an advanced view explicitly needs them:

- RAG
- retrieval
- corpus
- decomposition
- atomic claim
- object schema
- evidence ID
- canonical state
- deterministic
- epistemic
- inference distance
- state transition

## Interaction rules

1. Never silently change a source role selected by the user.
2. Exactly one item should be the main report or recommendation used to generate statements for checking.
3. If a required input is missing, explain what is missing and why it is needed.
4. Do not display raw relevance, similarity, or confidence numbers as if they were calibrated truth probabilities.
5. Status labels must describe what the evidence supports, not what the model feels confident about.
6. Generated explanations must use plain language and name the source problem directly.
7. Technical detail belongs behind the result, not in front of the task.
8. Destructive or user-authored overrides must be explicit and reversible where feasible.
9. Empty states must tell the user what to do next.
10. Loading text should describe the visible task, not the internal computation.

## Status vocabulary

| Internal state | Primary interface |
| --- | --- |
| SUPPORTED | Supported |
| PARTIAL | Partly supported |
| UNSUPPORTED | Not supported |
| ASSUMPTION | Assumption |
| CONTRADICTED | Conflicting evidence |
| UNKNOWN | Not enough information |
| STRONG_EVIDENCE_COVERAGE | Well supported |
| MATERIAL_GAPS_REMAIN | Important gaps remain |
| INSUFFICIENT_EVIDENCE | Not enough evidence yet |
| CRITICAL_CONTRADICTION_PRESENT | Major conflict found |

## Result explanation rule

A result explanation should be understandable without knowing how the engine works.

Good:

> Two linked sources support this statement.

> The available sources support only part of this statement.

> One linked source conflicts with this statement.

> This statement depends on something the sources do not yet establish.

Avoid:

> Retrieval produced multiple high-relevance passages.

> The claim failed the evidence-state transition.

> The corpus does not satisfy the proposition.

## Effectiveness rule

The interface is not successful merely because its terminology is technically correct. It is successful when a first-time user can complete the intended evidence-checking task, understand the result correctly, and know the next useful action without translating software terminology.
