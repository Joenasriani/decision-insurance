# Dependency security review (pre-release, not a clearance)

Audit baseline: GitHub Actions run #65 on 2026-10-22, Node.js 22, locked npm dependency installation.

## Findings
The npm audit reports **three moderate entries**: direct dependency `mammoth@1.13.0`, transitive `argparse`, and transitive `sprintf-js`. These are a connected dependency chain, not evidence of three independent exploit paths. The `sprintf-js` advisory is [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c).

The audit metadata suggests `mammoth@0.3.29` as a semver-major fix. That is a substantial downgrade, not a demonstrated compatible patch. Do **not** apply `npm audit fix --force` or mark the issue resolved without testing extraction compatibility and reviewing the actual dependency graph.

## Exposure and controls
The application accepts user-supplied DOCX through `app/api/ingest/route.ts` and calls `mammoth.extractRawText`. It limits file size to 20 MB. This establishes an ingestion attack surface but does **not** demonstrate that the reported `sprintf-js` vulnerability is reachable through this code path. No exploitability assessment, sandboxing review, archive decompression limits, or hostile-document testing has been completed.

## Next defensible actions
1. Review the full advisory details and affected transitive versions against the committed lockfile.
2. Determine whether a compatible fixed `mammoth` or transitive dependency override exists, and test with real DOCX files including tables, malformed archives and boundary-size inputs.
3. Add negative-path tests and a resource-exhaustion assessment before treating untrusted file ingestion as production-safe.
4. Re-run `npm audit`, regression tests, typecheck and build on the exact remediation candidate.
5. Record any accepted residual risk explicitly; do not claim security clearance from a passing CI run.

**Disposition: OPEN / NOT READY FOR PUBLIC RELEASE.** This is a documented security triage, not a completed remediation or scientific result.
