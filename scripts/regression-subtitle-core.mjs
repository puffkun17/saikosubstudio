import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Size-safe restore: reassembles scripts/_reg_parts into the full regression suite.
const dir = dirname(fileURLToPath(import.meta.url));
const partsDir = join(dir, '_reg_parts');
const partCount = 16;
let code = '';
for (let i = 0; i < partCount; i++) {
  code += readFileSync(join(partsDir, String(i).padStart(2, '0') + '.txt'), 'utf8');
}
const assembled = join(dir, '_reg_assembled_' + process.pid + '.mjs');
writeFileSync(assembled, code);
try {
  const result = spawnSync(process.execPath, [assembled], { stdio: 'inherit' });
  process.exit(result.status ?? 1);
} finally {
  try { unlinkSync(assembled); } catch { /* ignore */ }
}
