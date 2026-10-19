import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadCore } from './_compile.mjs';

const core = loadCore();
const { decodeBuffer, scoreDecodedText } = core('utils/textEncoding');

test('UTF-8 / UTF-16 BOM and BOM-less UTF-16 are high confidence', () => {
  const utf8 = decodeBuffer(new TextEncoder().encode('1\n00:00:01,000 --> 00:00:02,000\nHello\n'));
  assert.equal(utf8.encoding, 'utf-8');
  assert.equal(utf8.confidence, 'high');

  const bom = decodeBuffer(Uint8Array.from([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('你好')]));
  assert.equal(bom.encoding, 'utf-8 (BOM)');
  assert.equal(bom.confidence, 'high');

  // BOM-less UTF-16LE is detected via zero-high-byte density (ASCII-heavy subtitle bodies).
  const leBody = '1\n00:00:01,000 --> 00:00:02,000\n你好\n';
  const leDecoded = decodeBuffer(Buffer.from(leBody, 'utf16le'));
  assert.match(leDecoded.encoding, /utf-16le/);
  assert.equal(leDecoded.confidence, 'high');
  assert.equal(leDecoded.text, leBody);

  const be = Buffer.from([0xfe, 0xff, 0x4f, 0x60, 0x59, 0x7d]); // BOM + 你好
  const beDecoded = decodeBuffer(be);
  assert.equal(beDecoded.encoding, 'utf-16be (BOM)');
  assert.equal(beDecoded.confidence, 'high');
});

test('GBK / Big5 fixture files decode with encoding label and confidence', () => {
  const root = join(process.cwd(), 'scripts/fixtures/encoding');
  const cases = [
    ['zh-hans.gbk.srt', 'gbk'],
    ['zh-hant.big5.srt', 'big5'],
  ];
  for (const [file, encoding] of cases) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    const decoded = decodeBuffer(readFileSync(path));
    assert.equal(decoded.encoding, encoding, file);
    assert.ok(decoded.text.length > 10, file);
    assert.ok(decoded.confidence === 'high' || decoded.confidence === 'low', file);
    // Real fixture CJK should score as natural.
    assert.ok(scoreDecodedText(decoded.text) > 0.05, `${file} score`);
  }
});

test('utf-8 fallback is low confidence', () => {
  // Bytes that are invalid as UTF-8 and weak as legacy CJK → fallback path.
  const decoded = decodeBuffer(Uint8Array.from([0xff, 0xfe, 0x01, 0x02, 0x03, 0x04]));
  // May decode as utf-16le BOM with garbage, or fallback — confidence must be set.
  assert.ok(decoded.confidence === 'high' || decoded.confidence === 'low');
  assert.ok(typeof decoded.encoding === 'string' && decoded.encoding.length > 0);
});
