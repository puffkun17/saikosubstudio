import { test, expect } from '@playwright/test';
import { FIXTURES, readFixture, runMergeAndWait, seedPairedTask, waitForStore } from './helpers';

test.describe('core path: import → merge → export-ready', () => {
  test('seeded import shows task, merge produces rows, preview is export-ready', async ({ page }) => {
    await page.goto('/');
    await seedPairedTask(page, {
      zh: readFixture(FIXTURES.zh),
      en: readFixture(FIXTURES.en),
    });

    // Import ready: task chrome present (title or checklist).
    await expect(page.locator('.ingest-shell, .source-identity-rail, .v4-panel').first()).toBeVisible({ timeout: 15_000 });

    await runMergeAndWait(page);

    const { rowCount, step } = await page.evaluate(() => {
      const s = (window as unknown as { __SAIKO_STORE__: { getState: () => { processedSubs: unknown[] | null; workflowStep: number } } }).__SAIKO_STORE__.getState();
      return { rowCount: s.processedSubs?.length ?? 0, step: s.workflowStep };
    });
    expect(step).toBe(2);
    expect(rowCount).toBeGreaterThanOrEqual(2);

    // Workbench visible; advance to preview (step 3) and confirm rows still present.
    await page.evaluate(() => {
      (window as unknown as { __SAIKO_STORE__: { setState: (s: unknown) => void } }).__SAIKO_STORE__.setState({ workflowStep: 3 });
    });
    await expect.poll(async () =>
      page.evaluate(() => (window as unknown as { __SAIKO_STORE__: { getState: () => { workflowStep: number } } }).__SAIKO_STORE__.getState().workflowStep),
    ).toBe(3);

    const exportReady = await page.evaluate(() => {
      const s = (window as unknown as { __SAIKO_STORE__: { getState: () => { processedSubs: Array<{ text?: string }> | null } } }).__SAIKO_STORE__.getState();
      return Boolean(s.processedSubs && s.processedSubs.some((r) => (r.text || '').length > 0));
    });
    expect(exportReady).toBe(true);
  });

  test('gate toast does not duplicate on workbench tap when empty', async ({ page }) => {
    await page.goto('/');
    await waitForStore(page);

    // Step buttons stay aria-disabled until merge; gate still fires on forced tap (see notice-smoke).
    const workbench = page.locator('button', { has: page.locator('span', { hasText: /^工作台$/ }) })
      .or(page.locator('button').filter({ hasText: /^工作台$/ }))
      .first();
    await workbench.click({ force: true });
    await page.waitForSelector('[data-notice-id="gate-no-files"]', { timeout: 8_000 });
    await workbench.click({ force: true });
    await page.waitForTimeout(150);
    expect(await page.locator('[data-notice-id="gate-no-files"]').count()).toBe(1);
  });
});
