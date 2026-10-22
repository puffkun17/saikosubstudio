#!/usr/bin/env bash
# Export unpushed commits since 0d2ff69 into the Agent Store artifacts folder.
# Overwrites previous export. Never pushes.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="${UNPUSHED_BASE:-0d2ff69}"
OUT="${PATCH_OUT:-/cursor/stores/self/artifacts/patches}"
mkdir -p "$OUT"
rm -f "$OUT"/*.patch "$OUT"/*.bundle "$OUT"/INDEX.txt 2>/dev/null || true
cd "$ROOT"
if ! git rev-parse --verify "$BASE" >/dev/null 2>&1; then
  echo "base $BASE missing" >&2
  exit 1
fi
COUNT="$(git rev-list --count "${BASE}..HEAD")"
if [[ "$COUNT" -eq 0 ]]; then
  echo "no commits after $BASE" > "$OUT/INDEX.txt"
  exit 0
fi
git format-patch "${BASE}..HEAD" -o "$OUT"
git bundle create "$OUT/cf-pages-hosted-unpushed.bundle" "${BASE}..HEAD"
{
  echo "base: $BASE"
  echo "head: $(git rev-parse HEAD)"
  echo "count: $COUNT"
  git log --oneline "${BASE}..HEAD"
  echo
  echo "files:"
  ls -1 "$OUT"
} > "$OUT/INDEX.txt"
echo "exported $COUNT patch(es) → $OUT"
