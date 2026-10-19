/**
 * Regression: workflow-gated copy must render in exactly one UI surface.
 * 9729761 intentionally dual-rendered SystemTray callout + DragZone banner;
 * that caused the mobile duplicate Nias reported. Banner is gone; callout stays.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('workflow-gated notice surfaces', () => {
  it('DragZone no longer mounts an ingest-gate-banner', () => {
    const dragZone = read('src/components/Ingest/DragZone.tsx');
    assert.equal(
      dragZone.includes('ingest-gate-banner'),
      false,
      'DragZone must not render the duplicate gate banner',
    );
    assert.equal(
      dragZone.includes('dismissStatusNotice'),
      false,
      'DragZone should not dismiss the tray callout via a second close control',
    );
    // Still reacts to the notice (drop-well highlight + scroll), without copying text.
    assert.match(dragZone, /workflow-gated/);
    assert.match(dragZone, /ingest-drop-zone--gate-hint/);
  });

  it('SystemTray remains the sole textual renderer for workflow-gated', () => {
    const tray = read('src/components/Global/SystemTray.tsx');
    const feedback = read('src/components/Global/FeedbackCenter.tsx');
    const dragZone = read('src/components/Ingest/DragZone.tsx');

    assert.match(tray, /id:\s*'workflow-gated'/);
    assert.match(tray, /workflow-gate-callout/);
    assert.match(tray, /请先添加字幕/);

    assert.match(feedback, /CONTEXTUAL_NOTICE_IDS/);
    assert.match(feedback, /'workflow-gated'/);
    // Floating dock must keep excluding it so we never get a third copy.
    assert.match(
      feedback,
      /filter\(\(notice\)\s*=>\s*!CONTEXTUAL_NOTICE_IDS\.has\(notice\.id\)\)/,
    );

    // Banner text must not be duplicated in DragZone markup.
    assert.equal(dragZone.includes('请先添加字幕'), false);
    assert.equal(dragZone.includes('添加并整理文件后可进入工作台'), false);
  });

  it('globals.css drops unused .ingest-gate-banner rule', () => {
    const css = read('app/globals.css');
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
      'handoff/empty shell must use initial={false} so returning to 导入 does not flash',
    );
  });

  it('DragZone empty well skips enter opacity animation', () => {
    const dragZone = read('src/components/Ingest/DragZone.tsx');
    assert.match(
      dragZone,
      /key="empty"[\s\S]*?initial=\{false\}/,
      'empty drop well remount must not start at opacity 0',
    );
  });
});
