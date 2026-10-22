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

## Follow-up verification: 2026-10-22

- Locked graph confirmed: `mammoth@1.13.0 → argparse@1.0.10 → sprintf-js@1.0.3`.
- The authoritative GitHub advisory `GHSA-hp3w-g68c-fv3c` (CVE-2026-97058) lists affected `sprintf-js` versions through 1.1.3 and **no patched version**. See https://github.com/advisories/GHSA-hp3w-g68c-fv3c .
- Mammoth upstream issue https://github.com/mwilliamson/mammoth.js/issues/491 reports that `argparse` is CLI-only and the library interface does not load `argparse` or `sprintf-js`. This project's isolated child-process regression now tests that assertion against the pinned dependency graph; CI #68 passed the new test (21/21 total).
- This establishes **module-import non-reachability for the tested library entry point**, not complete vulnerability non-reachability, exploit absence, or production security clearance. Future Mammoth upgrades must rerun the test.
- No compatible patched `sprintf-js` version is currently available. Do not force a major Mammoth downgrade or override `argparse` across unsupported major ranges solely to silence `npm audit`. Await upstream compatible remediation or independently implement and test a supported replacement.
- The dependency audit continues to report three moderate package findings. Keep the advisory visible, tracked, and non-gating until a justified risk decision is made.
- Browser-level end-to-end verification **NOT RUN**: the browser connector reported that an originating connected browser context was required. The production build passing is not equivalent to browser interaction validation.

**Release disposition unchanged: DEVELOP FURTHER / NOT READY.**
