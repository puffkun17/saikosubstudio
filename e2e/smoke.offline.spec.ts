import { test, expect } from '@playwright/test';
import { waitForStore } from './helpers';

/**
 * After first online load + SW install, the app shell must remain usable with network off.
 * APIs (/api/*) are bypassed by the SW by design — we only assert shell navigation.
 */
test.describe('offline PWA shell', () => {
  test('home remains available after going offline', async ({ page, context }) => {
    await page.goto('/');
    await waitForStore(page);
    const importCta = page.getByTestId('ingest-import-cta');
    await expect(importCta).toBeVisible({ timeout: 20_000 });
    await expect(importCta).toContainText(/导入字幕/);

    // Wait until a service worker controls the page (or is at least registered).
    await page.waitForFunction(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.getRegistration();
      return Boolean(reg);
    }, null, { timeout: 60_000 });

    // Give precache a moment after registration.
    await page.waitForTimeout(1500);

    await context.setOffline(true);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible({ timeout: 20_000 });
    // Prefer visible UI nodes (avoid matching <title>, which is not "visible").
    await expect(
      page.locator('[data-testid="ingest-import-cta"], [data-ingest-add-cta], .ingest-local-add').first(),
    ).toBeVisible({ timeout: 20_000 });

    await context.setOffline(false);
  });
});
