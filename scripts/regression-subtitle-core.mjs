import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const dir = dirname(fileURLToPath(import.meta.url));

// Fetch known-good pre-corruption blob, inject extras, then run.
const BASE_URL =
  'https://raw.githubusercontent.com/puffkun17/saikosubstudio/2dc1c634b44d2e7fecec3c7ed5d58622fa659d03/scripts/regression-subtitle-core.mjs';

async function main() {
  const res = await fetch(BASE_URL);
  if (!res.ok) throw new Error(`Failed to fetch base regression script: ${res.status}`);
  let code = await res.text();

  // Expose review-queue helpers alongside analyzeAlignmentDiff.
  const requireNeedle = 'const { analyzeAlignmentDiff } = require(join(outDir, \'utils/timeline/alignmentDiff.js\'));';
  const requireReplacement =
    "const { analyzeAlignmentDiff, buildMergeReviewQueue, filterMergeReviewQueue } = require(join(outDir, 'utils/timeline/alignmentDiff.js'));";
  if (!code.includes(requireNeedle)) {
    throw new Error('analyzeAlignmentDiff require not found in base regression script');
  }
  code = code.replace(requireNeedle, requireReplacement);

  const extras = [
    readFileSync(join(dir, 'regression-coverage-extra.inc.js'), 'utf8'),
    readFileSync(join(dir, 'regression-review-queue.inc.js'), 'utf8'),
  ].join('\n');

  const anchor = '  // Greedy look-ahead: one extra EN must not derail the rest.';
  const idx = code.indexOf(anchor);
  if (idx < 0) throw new Error('Anchor not found in base regression script');
  const brace = code.lastIndexOf('{', idx);
  if (brace < 0) throw new Error('Greedy block brace not found');
  code = code.slice(0, brace) + extras + code.slice(brace);

  const assembled = join(dir, '_reg_assembled_' + process.pid + '.mjs');
  writeFileSync(assembled, code);
  try {
    const result = spawnSync(process.execPath, [assembled], { stdio: 'inherit' });
    process.exit(result.status ?? 1);
  } finally {
    try { unlinkSync(assembled); } catch { /* ignore */ }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
