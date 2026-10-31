import { test, expect, type Page } from '@playwright/test';
import { FIXTURES, readFixture, waitForStore } from './helpers';

/**
 * 第 2 页作品卡：空间紧时「手动匹配」收成封面右下角的放大镜，空间够时保留完整按钮。
 */
const LONG =
  '该剧根据米克·赫伦的同名系列小说改编，故事围绕着军情五处内一个不正常的特务组，以及他们讨人厌的老板：臭名满天下的杰克逊·兰姆。他们在真假难辨的间谍世界中努力着，以保卫英国免受邪恶势力的侵害。';
const XLONG =
  LONG +
  '第四季里，一桩发生在伦敦市中心的爆炸案把泥潭屋卷进了更大的阴谋：河岸的父亲突然失踪，一名身份可疑的承包商浮出水面，而兰姆不得不在军情五处高层的推诿与掩盖之间，替这群被流放的特工寻找一条活路。旧案、旧友与旧账同时翻出，每个人都要为过去的选择付出代价。';
const SHORT = '一群被流放的军情五处特工。';

type Titles = { title: string; originalTitle: string; year: string };
const SLOW: Titles = { title: '流人', originalTitle: 'Slow Horses', year: '2022' };

async function seed(page: Page, overview: string, titles: Titles = SLOW) {
  const zh = readFixture(FIXTURES.goldenZh);
  const en = readFixture(FIXTURES.goldenEn);
  await page.evaluate(
    ({ zhBody, enBody, ov, t }) => {
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
        tmdbData: { title: t.title, originalTitle: t.originalTitle, year: t.year, genres: ['犯罪'], posterUrl: null, backdropUrl: null, overview: ov, voteAverage: 8.1, isAnime: false },
        isIngestClearing: false, processedSubs: null, tmdbManualOpen: false,
      });
    },
    { zhBody: zh, enBody: en, ov: overview, t: titles },
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

const clampOf = (page: Page) =>
  page.locator('.source-identity-rail__overview').evaluate((el) => (el as HTMLElement).style.webkitLineClamp || null);

test('1280x900 超长简介：封面完整 2:3，简介让位，展开按钮触控 44px 可切换', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await waitForStore(page);
  await seed(page, XLONG);
  const poster = page.locator('.source-identity-rail__poster');
  await expect(poster).toHaveAttribute('data-poster-fit', 'full');
  const pb = await poster.boundingBox();
  expect(Math.round(pb!.height)).toBe(Math.round(pb!.width * 1.5));
  expect(Number(await clampOf(page))).toBeGreaterThanOrEqual(2);
  const toggle = page.locator('.source-identity-rail__toggle');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  // 版面 28px 紧贴简介；触控区由 ::before 上下各扩 8px 到 44px：按钮上下 7px 处点得到它。
  const tb = (await toggle.boundingBox())!;
  expect(Math.round(tb.height)).toBe(28);
  for (const dy of [-7, tb.height + 7]) {
    const hit = await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.source-identity-rail__toggle'), [tb.x + tb.width / 2, tb.y + dy]);
    expect(hit).toBe(true);
  }
  // 「展开全文」与 TMDB 署名之间只留 12px，不再被弹性空白推开。
  const lb = (await page.locator('.source-identity-rail__tmdb').boundingBox())!;
  expect(Math.round(lb.y - (tb.y + tb.height))).toBe(12);
  await expect(page.getByTestId('rematch-compact')).toBeVisible(); // 简介被截断时放大镜出现
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(toggle).toHaveText(/收起简介/);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('1280x720 长简介：最后才缩封面，等比不裁切，简介至少 2 行', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await waitForStore(page);
  await seed(page, LONG);
  const poster = page.locator('.source-identity-rail__poster');
  await expect(poster).toHaveAttribute('data-poster-fit', 'scaled');
  const pb = await poster.boundingBox();
  expect(pb!.height).toBeLessThan(pb!.width * 1.5);
  expect(pb!.height).toBeGreaterThanOrEqual(120);
  expect(await clampOf(page)).toBe('2');
  const rail = page.locator('.source-identity-rail');
  expect(await rail.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(0);
});

test('作品卡标题合成一行：不显示集号，原名与年份同行，年份不落单', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await waitForStore(page);
  await seed(page, SHORT);
  const heading = page.locator('.source-identity-rail__heading');
  await expect(heading).toHaveText('流人 Slow Horses\u00A02022');
  await expect(page.locator('.source-identity-rail__title')).toHaveText('流人');
  await expect(heading).not.toHaveAttribute('title', /.+/);
  expect(await page.locator('.source-identity-rail').innerText()).not.toMatch(/S\d{2}E\d{2}/i);
});

test('长片名：最多 2 行省略，完整标题放进 title 提示；原名与主标题相同只显示一次', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await waitForStore(page);
  await seed(page, SHORT, { title: '奇爱博士', originalTitle: 'Dr. Strangelove or: How I Learned to Stop Worrying and Love the Bomb', year: '1964' });
  const heading = page.locator('.source-identity-rail__heading');
  const lines = await heading.evaluate((el) => Math.round(el.clientHeight / parseFloat(getComputedStyle(el).lineHeight)));
  expect(lines).toBe(2);
  await expect(heading).toHaveAttribute('title', '奇爱博士 Dr. Strangelove or: How I Learned to Stop Worrying and Love the Bomb 1964');

  await seed(page, SHORT, { title: 'Slow Horses', originalTitle: 'Slow Horses', year: '2022' });
  await expect(heading).toHaveText('Slow Horses\u00A02022');
});

test('390x844 移动端：单行条同样不显示集号，标题同一行', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await waitForStore(page);
  await seed(page, LONG);
  await expect(page.locator('.source-identity-rail__heading')).toHaveText('流人 Slow Horses\u00A02022');
  expect(await page.locator('.source-identity-rail').innerText()).not.toMatch(/S\d{2}E\d{2}/i);
});
