# Synthetic corpus (CI)

Tiny dual-track samples committed so `scripts/corpus-baseline.mjs` can run in CI.

Baselines live in `baseline/*.json` (also committed for this synthetic set only).

**Real subtitle corpora must stay outside the repo.** Point at them with:

```bash
CORPUS_DIR=~/path/to/real-corpus \
CORPUS_BASELINE_DIR=~/path/to/real-corpus-baseline \
node scripts/corpus-baseline.mjs --record   # once
CORPUS_DIR=… CORPUS_BASELINE_DIR=… node scripts/corpus-baseline.mjs
```

The harness refuses to store real-corpus baselines inside the git worktree.
