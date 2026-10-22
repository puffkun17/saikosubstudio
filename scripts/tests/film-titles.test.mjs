import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadCore } from './_compile.mjs';

const require = loadCore();
const { resolveFilmTitles, splitMixedTitle } = require('utils/filmTitles');

describe('resolveFilmTitles', () => {
  it('keeps CN main and Latin original once when title is mixed', () => {
    const r = resolveFilmTitles('攻壳机动队 THE GHOST IN THE SHELL', 'THE GHOST IN THE SHELL');
    assert.equal(r.main, '攻壳机动队');
    assert.equal(r.originalLatin, 'THE GHOST IN THE SHELL');
    assert.equal(r.originalScript, null);
  });

  it('does not repeat original when it matches main', () => {
    const r = resolveFilmTitles('攻壳机动队', '攻壳机动队');
    assert.equal(r.main, '攻壳机动队');
    assert.equal(r.originalScript, null);
    assert.equal(r.originalLatin, null);
  });

  it('shows script + latin from original when title is localized CN', () => {
    const r = resolveFilmTitles('攻壳机动队', '攻殻機動隊 THE GHOST IN THE SHELL');
    assert.equal(r.main, '攻壳机动队');
    assert.equal(r.originalScript, '攻殻機動隊');
    assert.equal(r.originalLatin, 'THE GHOST IN THE SHELL');
  });

  it('splitMixedTitle handles plain Latin', () => {
    const s = splitMixedTitle('Ghost in the Shell');
    assert.equal(s.latin, 'Ghost in the Shell');
    assert.equal(s.script, null);
  });
});
