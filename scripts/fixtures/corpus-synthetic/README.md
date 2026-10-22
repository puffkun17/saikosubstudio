# Synthetic corpus (CI)

Tiny dual-track samples committed so `scripts/corpus-baseline.mjs` can run in CI.

Baselines live in `baseline/*.json` (also committed for this synthetic set only).
Recording **format 2** fields: `format`, numeric cue `start`/`end` (ms), `inputs[]` (per-file cue counts), and `loss` (input cues absent from output). Format ≠ 2 baselines fail compare and must be re-recorded.

**Real subtitle corpora must stay outside the repo.** Point at them with:

```bash
CORPUS_DIR=~/path/to/real-corpus \
CORPUS_BASELINE_DIR=~/path/to/real-corpus-baseline \
node scripts/corpus-baseline.mjs --record   # once (or after a format bump)
CORPUS_DIR=… CORPUS_BASELINE_DIR=… node scripts/corpus-baseline.mjs
```

The harness refuses to store real-corpus baselines inside the git worktree.
