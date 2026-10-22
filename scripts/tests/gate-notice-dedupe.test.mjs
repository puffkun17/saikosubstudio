/**
 * Notice channel invariants: gate → toast only; no tray callout / ingest banner.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('gate / notice channel surfaces', () => {
  it('DragZone has no ingest-gate-banner and does not copy gate copy', () => {
    const dragZone = read('src/components/Ingest/DragZone.tsx');
    assert.equal(dragZone.includes('ingest-gate-banner'), false);
    assert.equal(dragZone.includes('请先添加字幕'), false);
    assert.equal(dragZone.includes('添加并整理文件后可进入工作台'), false);
  });

  it('SystemTray emits gate-no-files toast and has no workflow-gate-callout', () => {
    const tray = read('src/components/Global/SystemTray.tsx');
    assert.match(tray, /id:\s*'gate-no-files'/);
    assert.match(tray, /channel:\s*'toast'/);
    assert.equal(tray.includes('workflow-gate-callout'), false);
    assert.equal(tray.includes("'workflow-gated'"), false);
  });

  it('FeedbackCenter is toast-dock only; inline MessageBar is separate', () => {
    const feedback = read('src/components/Global/FeedbackCenter.tsx');
    const inline = read('src/components/Global/InlineMessageBar.tsx');
    assert.match(feedback, /data-testid="toast-dock"/);
    assert.match(feedback, /resolveNoticeChannel\(notice\) === 'toast'/);
    assert.match(inline, /data-testid="inline-message-stack"/);
    assert.match(inline, /aria-live=\{assertive \? 'assertive' : 'polite'\}/);
  });

  it('globals.css drops unused .ingest-gate-banner rule', () => {
    const css = read('src/styles/globals.css');
    assert.equal(css.includes('.ingest-gate-banner'), false);
  });
});

describe('ingest remount flash guards', () => {
  it('IngestStep empty shell does not fade in on remount', () => {
    const ingest = read('src/components/IngestStep.tsx');
    assert.match(ingest, /AnimatePresence mode="wait" initial=\{false\}/);
    assert.match(
      ingest,
      /key="handoff-state"[\s\S]*?initial=\{false\}/,
    );
  });

  it('DragZone empty well skips enter opacity animation', () => {
    const dragZone = read('src/components/Ingest/DragZone.tsx');
    assert.match(dragZone, /key="empty"[\s\S]*?initial=\{false\}/);
  });
});
