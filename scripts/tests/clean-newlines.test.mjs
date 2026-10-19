/**
 * V9 follow-up: cleanSubtitleContent must keep newlines from ASS \N / SRT multi-line.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './_compile.mjs';

const core = loadCore();
const S = core('utils/subtitleCore');

test('cleanSubtitleContent preserves SRT multi-line newlines', () => {
  const cleaned = S.cleanSubtitleContent('-你去哪\n-回家');
  assert.ok(cleaned.includes('\n'), `expected newline, got ${JSON.stringify(cleaned)}`);
  assert.equal(cleaned, '-你去哪\n-回家');
});

test('cleanSubtitleContent preserves ASS \\N after parseSubtitle', () => {
  const ass = [
    '[Script Info]',
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    'Dialogue: 0,0:00:00.00,0:00:04.00,Default,,0,0,0,,-你去哪\\N-回家',
    '',
  ].join('\n');
  const parsed = S.parseSubtitle(ass);
  assert.equal(parsed[0].text, '-你去哪\n-回家');
  const cleaned = S.cleanSubtitleContent(parsed[0].text);
  assert.equal(cleaned, '-你去哪\n-回家');
  // Packed expand still sees two turns after cleaning.
  const en = S.parseSubtitle([
    '1',
    '00:00:00,000 --> 00:00:01,900',
    'Where to?',
    '',
    '2',
    '00:00:02,000 --> 00:00:04,000',
    'Home.',
    '',
  ].join('\n'));
  const rows = S.mergeSubtitles(parsed, en);
  const expanded = rows.filter((r) => r.provenance?.method === 'expanded-dialogue');
  assert.ok(expanded.length >= 2, `expected expanded rows, got ${rows.map((r) => r.text).join(' | ')}`);
});

test('cleanSubtitleContent still collapses horizontal whitespace', () => {
  assert.equal(S.cleanSubtitleContent('a   b\tc'), 'a b c');
  assert.equal(S.cleanSubtitleContent('Tu viens\u00a0?'), 'Tu viens\u00a0?');
});
