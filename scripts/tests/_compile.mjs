// Compiles src/core (+ the utils it imports) to CommonJS once per process, returns a require().
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let cached;
export function loadCore() {
  if (cached) return cached;
  const out = mkdtempSync(join(tmpdir(), 'saiko-core-'));
  const core = readdirSync('src/core').filter((f) => f.endsWith('.ts') && f !== 'mergeClient.ts').map((f) => `src/core/${f}`);
  // Extra utils not always pulled in via core imports (ingest helpers, encoding, summary).
  const extras = [
    'src/utils/ingestJunk.ts',
    'src/utils/importSummary.ts',
    'src/utils/textEncoding.ts',
  ].filter((file) => existsSync(file));
  execFileSync('npx', ['tsc', ...core, ...extras, '--target', 'ES2022', '--module', 'commonjs', '--moduleResolution', 'node', '--outDir', out, '--skipLibCheck', '--rootDir', 'src', '--lib', 'ES2022,DOM'], { stdio: 'inherit' });
  const req = createRequire(join(out, 'x.js'));
  cached = (p) => req(`./${p}.js`);
  return cached;
}
