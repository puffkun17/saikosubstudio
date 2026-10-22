# Synthetic corpus (CI)

Tiny dual-track samples committed so `scripts/corpus-baseline.mjs` can run in CI.

Baselines live in `baseline/*.json` (also committed for this synthetic set only).

Recording **format 3** fields:

- `format`, `sample`, `pairing` (`dual` | `bilingual`), `inputs[]` (per-file cue counts)
- `modes` — per-algorithm recordings:
  - **dual**: `standard` (`mergeSubtitles`), `industrial` (`alignSubtitlesIndustrial`), `auto` (`executeMergeJob` with `mode:'standard'`, may auto-upgrade to industrial)
  - **bilingual**: `bilingual` (`executeMergeJob` with `bilingualSingle: true`)
- Each mode records `usedMode`, `rowCount`, `loss`, and cue fingerprints (`start`/`end` ms, text, type, …)
- Non-deterministic fields (e.g. `elapsedMs` from `Date.now`) are **never** recorded

Format ≠ 3 baselines fail compare and must be re-recorded. Sample folder layout is unchanged.

**Real subtitle corpora must stay outside the repo.** Point at them with:

```bash
CORPUS_DIR=~/path/to/real-corpus \
CORPUS_BASELINE_DIR=~/path/to/real-corpus-baseline \
node scripts/corpus-baseline.mjs --record   # once (or after a format bump)
CORPUS_DIR=… CORPUS_BASELINE_DIR=… node scripts/corpus-baseline.mjs
```

The harness refuses to store real-corpus baselines inside the git worktree.
