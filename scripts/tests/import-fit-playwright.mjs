/**
 * Desktop Import ready-state: one screen, no document scroll, primary CTA visible.
 * Seeds a loaded task via __SAIKO_STORE__.
 *
 * Usage: BASE_URL=http://127.0.0.1:4173 node scripts/tests/import-fit-playwright.mjs
 */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173';

const zhBody = readFileSync(join(process.cwd(), 'scripts/fixtures/golden/everyday-srt/zh.srt'), 'utf8');
const enBody = readFileSync(join(process.cwd(), 'scripts/fixtures/golden/everyday-srt/en.srt'), 'utf8');

function fakeSub(id, name, lang, text) {
  return {
    id,
    name,
    lang,
    content: text,
    originalContent: text,
    encoding: 'utf-8',
    encodingConfidence: 'high',
    importSource: 'zip',
  };
}

async function seedLoadedTask(page) {
  await page.waitForFunction(() => Boolean(window.__SAIKO_STORE__));
  await page.evaluate(({ zhBody: zh, enBody: en }) => {
    const zhFile = {
      id: 'f-zh',
      name: 'Ghost.S01E02.zh.srt',
      lang: 'zh-CN',
      content: zh,
      originalContent: zh,
      encoding: 'utf-8',
      encodingConfidence: 'high',
      importSource: 'zip',
    };
    const enFile = {
      id: 'f-en',
      name: 'Ghost.S01E02.en.srt',
      lang: 'en',
      content: en,
      originalContent: en,
      encoding: 'utf-8',
      encodingConfidence: 'high',
      importSource: 'zip',
    };
    const task = {
      id: 'task-1',
      title: '攻壳机动队',
      epKey: 'S01E02',
      zh: zhFile,
      en: enFile,
      commentary: null,
      status: 'ready',
      files: [zhFile, enFile, { ...enFile, id: 'f-en2', name: 'Ghost.S01E02.sdh.srt' }],
    };
    window.__SAIKO_STORE__.setState({
      workflowStep: 1,
      tasks: [task],
      selectedTaskId: 'task-1',
      uploadedFiles: task.files,
      tmdbData: {
        title: '攻壳机动队 THE GHOST IN THE SHELL',
        originalTitle: '攻殻機動隊 THE GHOST IN THE SHELL',
        year: '2026',
        genres: ['动画', '科幻'],
        posterUrl: null,
        backdropUrl: null,
        overview: '在近未来的都市中，公安九课调查一桩与义体化相关的案件。这段简介刻意写得够长，用来验证展开控件与一屏布局。还有更多句子用来撑开行数。',
        voteAverage: 8.2,
        isAnime: true,
      },
      isIngestClearing: false,
      processedSubs: null,
    });
  }, { zhBody, enBody });
  await page.waitForSelector('[data-testid="ingest-primary-cta"]', { timeout: 8000 });
}

async function assertNoDocScroll(page, label) {
  const { scrollH, clientH, scrollY } = await page.evaluate(() => ({
    scrollH: document.documentElement.scrollHeight,
    clientH: document.documentElement.clientHeight,
    scrollY: window.scrollY,
  }));
  assert.equal(scrollY, 0, `${label}: window.scrollY should be 0`);
  assert.ok(
    scrollH <= clientH + 2,
    `${label}: document should fit viewport (scrollHeight=${scrollH}, clientHeight=${clientH})`,
  );
}

async function runViewport(browser, { width, height, label }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await seedLoadedTask(page);
  await page.waitForTimeout(400);

  // Dedupe: task bar must not show show title / year / episode.
  const infoBar = page.locator('.workflow-info-bar');
  await assert.ok(await infoBar.count(), `${label}: info bar present`);
  const infoText = await infoBar.innerText();
  assert.match(infoText, /本次导入/);
  assert.doesNotMatch(infoText, /攻壳机动队/);
  assert.doesNotMatch(infoText, /THE GHOST IN THE SHELL/);
  assert.doesNotMatch(infoText, /\b2026\b/);
  assert.doesNotMatch(infoText, /S01E02/);

  // Work card owns title once (CN main).
  const railTitle = page.locator('.source-identity-rail__title');
  assert.equal(await railTitle.innerText(), '攻壳机动队');
  // Original lines at most once each.
  const rail = page.locator('.source-identity-rail');
  const railText = await rail.innerText();
  const ghostCount = (railText.match(/THE GHOST IN THE SHELL/g) || []).length;
  assert.ok(ghostCount <= 1, `${label}: Latin title at most once in rail, got ${ghostCount}`);

  const cta = page.getByRole('button', { name: /开始合轴|跳过匹配|正在准备/ });
  await assert.ok(await cta.first().isVisible(), `${label}: primary CTA visible`);
  const box = await cta.first().boundingBox();
  assert.ok(box, `${label}: CTA box`);
  assert.ok(box.y + box.height <= height, `${label}: CTA in viewport`);
  assert.ok(box.y >= 0, `${label}: CTA not above viewport`);

  await assertNoDocScroll(page, label);

  await context.close();
  console.log(`ok: ${label}`);
}

const browser = await chromium.launch({ headless: true });
try {
  await runViewport(browser, { width: 1280, height: 720, label: 'desktop-1280x720' });
  await runViewport(browser, { width: 1440, height: 900, label: 'desktop-1440x900' });
  await runViewport(browser, { width: 1024, height: 768, label: 'desktop-1024x768' });
  console.log('import-fit-playwright: passed');
} finally {
  await browser.close();
}
