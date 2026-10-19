/**
 * Playwright: gated 工作台 tap shows 「请先添加字幕」 at most once (mobile + desktop).
 * Also checks returning to 导入 does not leave the empty shell at opacity 0.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:4173 node scripts/tests/gate-notice-playwright.mjs
 */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const GATE_TITLE = '请先添加字幕';

async function countGateTitles(page) {
  return page.locator(`text=${GATE_TITLE}`).count();
}

async function runViewport(browser, { width, height, label }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  // Empty import shell should be fully opaque after load (no stuck flash frame).
  const emptyOpacity = await page.locator('.ingest-empty, .ingest-local-add').first().evaluate((el) => {
    return Number.parseFloat(getComputedStyle(el).opacity);
  });
  assert.ok(
    emptyOpacity >= 0.99,
    `${label}: empty ingest shell opacity should be 1 after load, got ${emptyOpacity}`,
  );
  assert.equal(
    await page.locator('.ingest-gate-banner').count(),
    0,
    `${label}: ingest-gate-banner must not exist`,
  );

  // Tap 工作台 with no files → one transient callout only.
  // Buttons use aria-disabled (still clickable); aria-label swaps to a gate hint,
  // so match by visible segment label, not accessible name.
  const workbench = page.locator('button', { has: page.locator('span', { hasText: /^工作台$/ }) })
    .or(page.locator('button').filter({ hasText: /^工作台$/ }))
    .first();
  await workbench.click({ force: true });
  await page.waitForSelector(`text=${GATE_TITLE}`, { timeout: 5000 });
  const afterGate = await countGateTitles(page);
  assert.equal(
    afterGate,
    1,
    `${label}: expected exactly one 「${GATE_TITLE}」, got ${afterGate}`,
  );
  assert.equal(
    await page.locator('.ingest-gate-banner').count(),
    0,
    `${label}: banner must stay absent while callout is visible`,
  );
  assert.equal(
    await page.locator('.workflow-gate-callout').count(),
    1,
    `${label}: SystemTray callout should be the single surface`,
  );

  // Return to 导入 via brand and ensure no opacity flash residue.
  await page.getByRole('button', { name: '返回导入页' }).click();
  await page.waitForTimeout(350);
  const backOpacity = await page.locator('.ingest-empty, .ingest-local-add').first().evaluate((el) => {
    return Number.parseFloat(getComputedStyle(el).opacity);
  });
  assert.ok(
    backOpacity >= 0.99,
    `${label}: after return to 导入, opacity should be 1 (no remount fade), got ${backOpacity}`,
  );

  await context.close();
  console.log(`ok: ${label}`);
}

const browser = await chromium.launch({ headless: true });
try {
  await runViewport(browser, { width: 390, height: 844, label: 'mobile-390' });
  await runViewport(browser, { width: 1280, height: 800, label: 'desktop-1280' });
  console.log('gate-notice-playwright: all viewports passed');
} finally {
  await browser.close();
}
