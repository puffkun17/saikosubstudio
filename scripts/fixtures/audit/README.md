# Audit reproduction fixtures (V1–V12)

Synthetic cues only — from the pipeline audit (`saikosubstudio-pipeline-audit.md`).
Used by `scripts/tests/merge-audit-repro.test.mjs` and the merge invariant suite.

| ID | Violation | Status in P0/P1 |
|----|-----------|-----------------|
| V1 | Parse-time cueKind blocks pairing | skipped (P3) |
| V2 | Note extraction before timeline | skipped (P3) |
| V3 | Index-proportional offset sampling | skipped (P2) |
| V5 | Industrial coverage-merge drops lines | fixed in P1 |
| V6 | No sort before merge | fixed in P1 |
| V7 | No dedupe of identical same-time cues | fixed in P1 |
| V8 | Score 20–39 strips edge punctuation | fixed in P1 |
| V9 | SRT joins multi-line with spaces | fixed in P1 |
