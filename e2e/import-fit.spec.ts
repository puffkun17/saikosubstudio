import { test, expect } from '@playwright/test';
import { FIXTURES, readFixture, waitForStore } from './helpers';

/**
 * Folded from scripts/tests/import-fit-playwright.mjs (9497632 rebuild):
 * desktop Import ready-state fits one screen; task bar dedupes show title.
 */
test.describe('import ready-state fit + dedupe', () => {
  for (const { width, height, label } of [
    { width: 1280, height: 720, label: 'desktop-1280x720' },
    { width: 1440, height: 900, label: 'desktop-1440x900' },
  ]) {
    test(`${label}: no doc scroll, CTA visible, titles once`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await waitForStore(page);

      const zh = readFixture(FIXTURES.goldenZh);
      const en = readFixture(FIXTURES.goldenEn);
      await page.evaluate(
        ({ zhBody, enBody }) => {
          const zhFile = {
            id: 'f-zh',
            name: 'Ghost.S01E02.zh.srt',
            lang: 'zh-CN',
            content: zhBody,
            originalContent: zhBody,
            text: zhBody,
            encoding: 'utf-8',
            encodingConfidence: 'high',
            importSource: 'zip',
            size: zhBody.length,
          };
          const enFile = {
            id: 'f-en',
            name: 'Ghost.S01E02.en.srt',
            lang: 'en',
            content: enBody,
            originalContent: enBody,
            text: enBody,
            encoding: 'utf-8',
            encodingConfidence: 'high',
            importSource: 'zip',
            size: enBody.length,
          };
          const task = {
            id: 'task-1',
            title: '攻壳机动队',
            epKey: 'S01E02',
            zh: zhFile,
            en: enFile,
            commentary: null,
            status: 'ready',
            files: [zhFile, enFile],
          };
          (window as unknown as { __SAIKO_STORE__: { setState: (s: unknown) => void } }).__SAIKO_STORE__.setState({
            workflowStep: 1,
            tasks: [task],
            selectedTaskId: 'task-1',
            uploadedFiles: task.files,
            files: { zh: zhFile, en: enFile, commentary: null },
            tmdbData: {
              title: '攻壳机动队 THE GHOST IN THE SHELL',
              originalTitle: '攻殻機動隊 THE GHOST IN THE SHELL',
              year: '2026',
              genres: ['动画', '科幻'],
              posterUrl: null,
              backdropUrl: null,
              overview:
                '在近未来的都市中，公安九课调查一桩与义体化相关的案件。这段简介刻意写得够长，用来验证展开控件与一屏布局。还有更多句子用来撑开行数。',
              voteAverage: 8.2,
              isAnime: true,
            },
            isIngestClearing: false,
            processedSubs: null,
          });
        },
        { zhBody: zh, enBody: en },
      );

      await page.waitForSelector('[data-testid="ingest-primary-cta"]', { timeout: 8_000 });

      const infoBar = page.locator('.workflow-info-bar');
      await expect(infoBar).toBeVisible();
      const infoText = await infoBar.innerText();
      expect(infoText).toMatch(/本次导入/);
      expect(infoText).not.toMatch(/攻壳机动队/);
      expect(infoText).not.toMatch(/THE GHOST IN THE SHELL/);
      expect(infoText).not.toMatch(/\b2026\b/);
      expect(infoText).not.toMatch(/S01E02/);

      const railTitle = page.locator('.source-identity-rail__title');
      await expect(railTitle).toHaveText('攻壳机动队');
      const railText = await page.locator('.source-identity-rail').innerText();
      const ghostCount = (railText.match(/THE GHOST IN THE SHELL/g) || []).length;
      expect(ghostCount).toBeLessThanOrEqual(1);

      const cta = page.getByRole('button', { name: /开始合轴|跳过匹配|正在准备/ });
      await expect(cta.first()).toBeVisible();
      const box = await cta.first().boundingBox();
      expect(box).toBeTruthy();
      expect(box!.y + box!.height).toBeLessThanOrEqual(height);
      expect(box!.y).toBeGreaterThanOrEqual(0);

      const { scrollH, clientH, scrollY } = await page.evaluate(() => ({
        scrollH: document.documentElement.scrollHeight,
        clientH: document.documentElement.clientHeight,
        scrollY: window.scrollY,
      }));
      expect(scrollY).toBe(0);
      expect(scrollH).toBeLessThanOrEqual(clientH + 2);
    });
  }
});
