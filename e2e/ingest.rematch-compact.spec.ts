import { test, expect, type Page } from '@playwright/test';
import { FIXTURES, readFixture, waitForStore } from './helpers';

/**
 * 第 2 页作品卡：空间紧时「手动匹配」收成封面右下角的放大镜，空间够时保留完整按钮。
 */
const LONG =
  '该剧根据米克·赫伦的同名系列小说改编，故事围绕着军情五处内一个不正常的特务组，以及他们讨人厌的老板：臭名满天下的杰克逊·兰姆。他们在真假难辨的间谍世界中努力着，以保卫英国免受邪恶势力的侵害。';
const SHORT = '一群被流放的军情五处特工。';

async function seed(page: Page, overview: string) {
  const zh = readFixture(FIXTURES.goldenZh);
  const en = readFixture(FIXTURES.goldenEn);
  await page.evaluate(
    ({ zhBody, enBody, ov }) => {
      const mk = (id: string, name: string, lang: string, body: string) => ({
        id, name, lang, content: body, originalContent: body, text: body,
        encoding: 'utf-8', encodingConfidence: 'high', importSource: 'zip', size: body.length,
      });
      const zhFile = mk('f-zh', 'Slow.Horses.S04E01.chs.srt', 'zh-CN', zhBody);
      const enFile = mk('f-en', 'Slow.Horses.S04E01.eng.srt', 'en', enBody);
      const task = { id: 'task-1', title: '流人', epKey: 'S04E01', zh: zhFile, en: enFile, commentary: null, status: 'ready', files: [zhFile, enFile] };
      (window as unknown as { __SAIKO_STORE__: { setState: (s: unknown) => void } }).__SAIKO_STORE__.setState({
        workflowStep: 1, tasks: [task], selectedTaskId: 'task-1', uploadedFiles: task.files,
        files: { zh: zhFile, en: enFile, commentary: null },
        tmdbData: { title: '流人', originalTitle: 'Slow Horses', year: '2022', genres: ['犯罪'], posterUrl: null, backdropUrl: null, overview: ov, voteAverage: 8.1, isAnime: false },
        isIngestClearing: false, processedSubs: null, tmdbManualOpen: false,
      });
    },
    { zhBody: zh, enBody: en, ov: overview },
  );
  await page.waitForSelector('.source-identity-rail__overview', { state: 'attached' });
  await page.waitForTimeout(300); // 等 ResizeObserver 的那一帧
}

test('1280x720 长简介：收成放大镜，完整按钮不可达，点击打开手动匹配', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await waitForStore(page);
  await seed(page, LONG);
  const fab = page.getByTestId('rematch-compact');
  await expect(fab).toBeVisible();
  await expect(fab).toHaveAttribute('aria-label', '手动匹配');
  const box = await fab.boundingBox();
  expect(box?.width).toBe(32);
  await expect(page.getByRole('button', { name: '手动匹配', exact: true })).toHaveCount(1); // 只剩放大镜
  const rail = page.locator('.source-identity-rail');
  expect(await rail.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(0);
  await fab.click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __SAIKO_STORE__: { getState: () => { tmdbManualOpen: boolean } } }).__SAIKO_STORE__.getState().tmdbManualOpen))
    .toBe(true);
});

test('1280x900 短简介：空间够，保留完整按钮', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await waitForStore(page);
  await seed(page, SHORT);
  await expect(page.getByTestId('rematch-compact')).toHaveCount(0);
  await expect(page.locator('.source-identity-rail button.ui-action', { hasText: '手动匹配' })).toBeVisible();
});

test('390x844 移动端：不收（单行条，简介隐藏）', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await waitForStore(page);
  await seed(page, LONG);
  await expect(page.getByTestId('rematch-compact')).toHaveCount(0);
});
