import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import Module from 'node:module';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const outDir = join(tmpdir(), 'saiko-substudio-tmdb-rank-regression');
process.env.NODE_PATH = join(process.cwd(), 'node_modules');
Module._initPaths();

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

execFileSync('npx', [
  'tsc',
  'src/utils/tmdbSearchRank.ts',
  '--target',
  'ES2020',
  '--module',
  'commonjs',
  '--moduleResolution',
  'node',
  '--outDir',
  outDir,
  '--skipLibCheck',
], { stdio: 'inherit' });

const require = createRequire(import.meta.url);
const {
  rankTmdbCandidates,
  compareTmdbRank,
  isHighConfidenceTmdbPick,
  scoreTitleAgainstQuery,
} = require(join(outDir, 'tmdbSearchRank.js'));

{
  const empty = scoreTitleAgainstQuery({ id: 1, title: '盗梦空间' }, 'Inception');
  assert.equal(empty.points, 0, 'CJK-only title must not score against Latin query via empty-string includes');
}

{
  const exact = scoreTitleAgainstQuery(
    { id: 1, title: '盗梦空间', original_title: 'Inception' },
    'Inception',
  );
  const parody = scoreTitleAgainstQuery(
    { id: 2, title: 'Bikini Inception', original_title: 'Bikini Inception' },
    'Inception',
  );
  assert.equal(exact.exact, true);
  assert.equal(parody.queryOnlySubstring, true);
  assert.ok(exact.points > parody.points, 'exact original title must beat substring parody');
}

{
  const ranked = rankTmdbCandidates(
    [
      {
        id: 2,
        title: 'Bikini Inception',
        original_title: 'Bikini Inception',
        popularity: 12,
        vote_count: 40,
        vote_average: 4.2,
      },
      {
        id: 1,
        title: '盗梦空间',
        original_title: 'Inception',
        popularity: 80,
        vote_count: 30000,
        vote_average: 8.4,
      },
    ],
    ['Inception'],
  ).sort(compareTmdbRank);

  assert.equal(ranked[0].item.id, 1, 'Inception (2010) must rank above Bikini Inception');
  assert.equal(isHighConfidenceTmdbPick(ranked[0]), true, 'famous exact hit is high confidence');
  assert.equal(
    isHighConfidenceTmdbPick({
      item: ranked[1].item,
      score: ranked[1].score,
      exactTitle: false,
      queryOnlySubstring: true,
      rejected: false,
    }),
    false,
    'substring parody must not auto-select',
  );
}

console.log('regression-tmdb-rank: ok');
