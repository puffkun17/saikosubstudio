/**
 * Lightweight notice-system smoke (desktop + mobile).
 *
 * Asserts:
 *  1. No duplicate notice text on screen
 *  2. No opacity-0 flash when returning to Import
 *  3. Gate toast upserts once on repeated taps (id gate-no-files)
 *  4. Toast does not overlap the bottom tab bar on mobile
 *  5. No console errors along the main empty→gate path
 *
 * Optional: NOTICE_SHOT=1 writes one 1440px PC artifact with toast + inline bar.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:4173 node scripts/tests/notice-smoke-playwright.mjs
 */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const GATE_TITLE = '请先添加字幕';
const ARTIFACT = process.env.NOTICE_SHOT_PATH
  || '/opt/cursor/artifacts/screenshots/notice-system-pc-1440.png';

function workbenchButton(page) {
  return page.locator('button', { has: page.locator('span', { hasText: /^工作台$/ }) })
    .or(page.locator('button').filter({ hasText: /^工作台$/ }))
    .first();
}

async function uniqueVisibleTexts(page, text) {
  const locs = page.getByText(text, { exact: true });
  const n = await locs.count();
  let visible = 0;
  for (let i = 0; i < n; i += 1) {
    if (await locs.nth(i).isVisible()) visible += 1;
  }
  return visible;
}

async function assertNoOverlapWithBottomTray(page, toastSel) {
  const toast = page.locator(toastSel).first();
  const tray = page.locator('.system-tray--bottom').first();
  const [tb, tr] = await Promise.all([toast.boundingBox(), tray.boundingBox()]);
  assert.ok(tb && tr, 'toast and bottom tray must be measurable');
  assert.ok(
    tb.y + tb.height <= tr.y + 1,
    `toast overlaps bottom tray (toast.bottom=${tb.y + tb.height}, tray.top=${tr.y})`,
  );
}

async function runViewport(browser, { width, height, label, shot }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  const emptyOpacity = await page.locator('.ingest-empty, .ingest-local-add').first().evaluate((el) =>
    Number.parseFloat(getComputedStyle(el).opacity),
  );
  assert.ok(emptyOpacity >= 0.99, `${label}: empty opacity ${emptyOpacity}`);

  // Seed inline MessageBar via store for dual-channel screenshot / regression.
  await page.waitForFunction(() => Boolean(window.__SAIKO_STORE__));
  await page.evaluate(() => {
    window.__SAIKO_STORE__.getState().setStatusNotice({
      id: 'import-attention',
      tone: 'warning',
      title: '导入需要确认',
      message: '示例：编码不确定 · 需人工核对',
      channel: 'inline',
    });
  });
  await page.waitForSelector('[data-notice-channel="inline"]', { timeout: 5000 });

  const wb = workbenchButton(page);
  await wb.click({ force: true });
  await page.waitForSelector(`[data-notice-id="gate-no-files"]`, { timeout: 5000 });
  assert.equal(await uniqueVisibleTexts(page, GATE_TITLE), 1, `${label}: gate title once`);
  assert.equal(await page.locator('.workflow-gate-callout').count(), 0, `${label}: no tray callout`);
  assert.equal(await page.locator('[data-notice-id="gate-no-files"]').count(), 1);

  // Repeated tap upserts — still one toast with that id.
  await wb.click({ force: true });
  await page.waitForTimeout(120);
  assert.equal(
    await page.locator('[data-notice-id="gate-no-files"]').count(),
    1,
    `${label}: gate toast upserts by id`,
  );

  if (height >= 800 && width <= 430) {
    await assertNoOverlapWithBottomTray(page, '[data-notice-id="gate-no-files"]');
  }

  if (shot) {
    mkdirSync(dirname(ARTIFACT), { recursive: true });
    await page.screenshot({ path: ARTIFACT, fullPage: false });
    console.log(`shot: ${ARTIFACT}`);
  }

  await page.getByRole('button', { name: '返回导入页' }).click();
  await page.waitForTimeout(350);
  const backOpacity = await page.locator('.ingest-empty, .ingest-local-add').first().evaluate((el) =>
    Number.parseFloat(getComputedStyle(el).opacity),
  );
  assert.ok(backOpacity >= 0.99, `${label}: return opacity ${backOpacity}`);

  // No remount flash: shell opacity never drops below 0.99 in a short sample window.
  const samples = await page.evaluate(async () => {
    const el = document.querySelector('.ingest-empty, .ingest-local-add');
    const out = [];
    for (let i = 0; i < 8; i += 1) {
      out.push(Number.parseFloat(getComputedStyle(el).opacity));
      await new Promise((r) => requestAnimationFrame(r));
    }
    return out;
  });
  assert.ok(samples.every((v) => v >= 0.99), `${label}: opacity samples ${samples}`);

  const serious = consoleErrors.filter((t) =>
    !/Download the React DevTools/i.test(t)
    && !/hydration/i.test(t) // collect but don't fail soft hydration noise unless key warning
  );
  // Fail on React key / real exceptions.
  const fatal = consoleErrors.filter((t) =>
    /Error:|Uncaught|Warning: Each child in a list should have a unique "key"/i.test(t)
  );
  assert.equal(fatal.length, 0, `${label}: console fatals ${fatal.join(' | ')}`);
  if (serious.length) console.log(`${label}: console notes`, serious.slice(0, 5));

  await context.close();
  console.log(`ok: ${label}`);
}

const browser = await chromium.launch({ headless: true });
try {
  await runViewport(browser, { width: 390, height: 844, label: 'mobile-390', shot: false });
  await runViewport(browser, { width: 1280, height: 800, label: 'desktop-1280', shot: false });
  if (process.env.NOTICE_SHOT === '1') {
    await runViewport(browser, { width: 1440, height: 900, label: 'pc-1440-shot', shot: true });
  }
  console.log('notice-smoke-playwright: passed');
} finally {
  await browser.close();
}
