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

/** 标题区的几何与字体：排法、各段字体、年份是否完整可见且在第 1 行。 */
async function titleInfo(page: Page) {
  return page.locator('.source-identity-rail__heading').evaluate((h) => {
    const hb = h.getBoundingClientRect();
    const year = h.querySelector<HTMLElement>('.source-identity-rail__year');
    const alts = Array.from(h.querySelectorAll<HTMLElement>('.source-identity-rail__alt'));
    const yb = year?.getBoundingClientRect();
    const firstRow = h.firstElementChild!.getBoundingClientRect();
    const rows = Array.from(h.children).filter((c) => (c as HTMLElement).offsetHeight > 0).length;
    return {
      mode: h.getAttribute('data-title-mode'),
      text: (h.textContent ?? '').replace(/\s+/g, ' ').trim(),
      rows,
      titleAttr: h.getAttribute('title'),
      bodyFont: getComputedStyle(document.body).fontFamily,
      mainFont: getComputedStyle(h.querySelector('.source-identity-rail__title')!).fontFamily,
      altFonts: alts.map((el) => getComputedStyle(el).fontFamily),
      altColors: alts.map((el) => getComputedStyle(el).color),
      yearVisible: Boolean(
        year && yb && year.scrollWidth <= year.clientWidth + 1 && yb.right <= hb.right + 0.5 && yb.left >= hb.left - 0.5 &&
          yb.top >= firstRow.top - 0.5 && yb.bottom <= firstRow.bottom + 0.5,
      ),
    };
  });
}

async function altLine(page: Page) {
  return page.locator('.source-identity-rail__heading').evaluate((h) => {
    const a = h.querySelector<HTMLElement>('.source-identity-rail__alt-line')!;
    const fs = (el: Element | null) => (el ? parseFloat(getComputedStyle(el).fontSize) : NaN);
    return {
      fontPx: fs(a),
      fits: a.scrollWidth <= a.clientWidth + 1,
      headingPx: fs(h),
      mainPx: fs(h.querySelector('.source-identity-rail__title')),
      yearPx: fs(h.querySelector('.source-identity-rail__year')),
    };
  });
}

function expectSansSecondary(info: Awaited<ReturnType<typeof titleInfo>>) {
  // 原名 / 年份与正文同一套 UI 无衬线（Geist 打头），不能落到宋体或 serif 回退。
  expect(info.bodyFont).toMatch(/^"?Geist Sans"?/);
  expect(info.altFonts.length).toBeGreaterThan(0);
  for (const f of info.altFonts) {
    expect(f).toBe(info.bodyFont);
    expect(f).not.toMatch(/Serif|Songti|(^|,\s*)serif\s*$/);
  }
}

test('作品卡标题一行：「流人 Slow Horses 2022」，不显示集号，次级部分走无衬线', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await waitForStore(page);
  await seed(page, SHORT);
  const info = await titleInfo(page);
  expect(info.mode).toBe('one');
  expect(info.text).toBe('流人 Slow Horses 2022');
  expect(info.rows).toBe(1);
  expect(info.yearVisible).toBe(true);
  expect(info.titleAttr).toBeNull();
  expectSansSecondary(info);
  expect(info.mainFont).toMatch(/Noto Serif SC/); // 主标题保留思源宋体（DESIGN.md：宋体只给片名）
  await expect(page.locator('.source-identity-rail__title')).toHaveText('流人');
  expect(await page.locator('.source-identity-rail').innerText()).not.toMatch(/S\d{2}E\d{2}/i);
});

test('长片名：两行「中文名 年份」/「原名」，年份永远可见，完整标题放进 title；同名只显示一次', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await waitForStore(page);
  const long = 'Dr. Strangelove or: How I Learned to Stop Worrying and Love the Bomb';
  await seed(page, SHORT, { title: '奇爱博士', originalTitle: long, year: '1964' });
  let info = await titleInfo(page);
  expect(info.mode).toBe('two');
  expect(info.rows).toBe(2);
  expect(info.text).toBe(`奇爱博士 1964 ${long}`);
  expect(info.yearVisible).toBe(true);
  expect(info.titleAttr).toBe(`奇爱博士 ${long} 1964`);
  expectSansSecondary(info);
  // 原名在第 2 行先逐档缩字（不低于 11px），11px 仍放不下才省略；中文名和年份不缩。
  let alt = await altLine(page);
  expect(alt.fontPx).toBe(11);
  expect(alt.fits).toBe(false);
  expect(alt.mainPx).toBeCloseTo(alt.headingPx, 1);
  expect(alt.yearPx).toBeCloseTo(alt.headingPx * 0.75, 1);

  // 缩一点就能放下：字号介于 11px 与基准之间，不省略，也不需要 title 提示
  await seed(page, SHORT, { title: '瞬息全宇宙', originalTitle: 'Everything Everywhere All at Once', year: '2022' });
  info = await titleInfo(page);
  expect(info.mode).toBe('two');
  alt = await altLine(page);
  expect(alt.fontPx).toBeGreaterThanOrEqual(11);
  expect(alt.fontPx).toBeLessThan(alt.yearPx);
  expect(alt.fits).toBe(true);
  expect(info.titleAttr).toBeNull();
  expect(info.yearVisible).toBe(true);

  // 中文名本身就超长：省略中文名，年份不省略
  await seed(page, SHORT, { title: '一个非常非常非常非常非常非常非常长的中文片名测试', originalTitle: 'X', year: '1999' });
  info = await titleInfo(page);
  expect(info.mode).toBe('two');
  expect(info.yearVisible).toBe(true);
  const main = page.locator('.source-identity-rail__title');
  expect(await main.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  expect(info.titleAttr).toBe('一个非常非常非常非常非常非常非常长的中文片名测试 X 1999');

  await seed(page, SHORT, { title: 'Slow Horses', originalTitle: 'Slow Horses', year: '2022' });
  info = await titleInfo(page);
  expect(info.text).toBe('Slow Horses 2022');
  expect(info.mode).toBe('one');
});

test('390x844 移动端：单行条同样不显示集号，标题同一套排法', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await waitForStore(page);
  await seed(page, LONG);
  const info = await titleInfo(page);
  expect(info.text).toMatch(/^流人 (Slow Horses 2022|2022 Slow Horses)$/);
  expect(info.yearVisible).toBe(true);
  expectSansSecondary(info);
  expect(await page.locator('.source-identity-rail').innerText()).not.toMatch(/S\d{2}E\d{2}/i);
});
