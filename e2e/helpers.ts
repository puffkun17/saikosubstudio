import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';

export const FIXTURES = {
  zh: join(process.cwd(), 'e2e/fixtures/tiny-zh.srt'),
  en: join(process.cwd(), 'e2e/fixtures/tiny-en.srt'),
  goldenZh: join(process.cwd(), 'scripts/fixtures/golden/everyday-srt/zh.srt'),
  goldenEn: join(process.cwd(), 'scripts/fixtures/golden/everyday-srt/en.srt'),
};

export function readFixture(path: string) {
  return readFileSync(path, 'utf8');
}

export async function waitForStore(page: Page) {
  await page.waitForFunction(() => Boolean((window as unknown as { __SAIKO_STORE__?: unknown }).__SAIKO_STORE__), null, {
    timeout: 20_000,
  });
}

/** Seed a paired bilingual task and land on Import ready-state. */
export async function seedPairedTask(page: Page, opts?: { zh?: string; en?: string; title?: string; epKey?: string }) {
  const zhBody = opts?.zh ?? readFixture(FIXTURES.zh);
  const enBody = opts?.en ?? readFixture(FIXTURES.en);
  await waitForStore(page);
  await page.evaluate(
    ({ zh, en, title, epKey }) => {
      const zhFile = {
        id: 'e2e-zh',
        name: 'Sample.S01E01.zh.srt',
        lang: 'zh-CN',
        content: zh,
        originalContent: zh,
        text: zh,
        encoding: 'utf-8',
        encodingConfidence: 'high',
        importSource: 'file',
        size: zh.length,
      };
      const enFile = {
        id: 'e2e-en',
        name: 'Sample.S01E01.en.srt',
        lang: 'en',
        content: en,
        originalContent: en,
        text: en,
        encoding: 'utf-8',
        encodingConfidence: 'high',
        importSource: 'file',
        size: en.length,
      };
      const task = {
        id: 'e2e-task-1',
        title: title || 'Sample Show',
        epKey: epKey || 'S01E01',
        zh: zhFile,
        en: enFile,
        commentary: null,
        status: 'paired',
        files: [zhFile, enFile],
        isBilingualSingle: false,
      };
      (window as unknown as { __SAIKO_STORE__: { setState: (s: unknown) => void } }).__SAIKO_STORE__.setState({
        workflowStep: 1,
        tasks: [task],
        selectedTaskId: task.id,
        uploadedFiles: task.files,
        files: { zh: zhFile, en: enFile, commentary: null },
        tmdbData: null,
        isIngestClearing: false,
        processedSubs: null,
        isProcessing: false,
      });
    },
    {
      zh: zhBody,
      en: enBody,
      title: opts?.title,
      epKey: opts?.epKey,
    },
  );
}

export async function runMergeAndWait(page: Page) {
  await waitForStore(page);
  await page.evaluate(() => {
    const store = (window as unknown as { __SAIKO_STORE__: { getState: () => { runSubtitleMerge: () => void } } }).__SAIKO_STORE__;
    store.getState().runSubtitleMerge();
  });
  await page.waitForFunction(
    () => {
      const s = (window as unknown as { __SAIKO_STORE__: { getState: () => { processedSubs: unknown[] | null; workflowStep: number; isProcessing: boolean } } }).__SAIKO_STORE__.getState();
      return Boolean(s.processedSubs && s.processedSubs.length > 0 && s.workflowStep === 2 && !s.isProcessing);
    },
    null,
    { timeout: 60_000 },
  );
}
