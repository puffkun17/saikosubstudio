import { test, expect } from '@playwright/test';

test.describe('entry pages smoke', () => {
  test('home (导入) loads empty stage', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText(/添加本地字幕|选择文件|拖入此处/).first()).toBeVisible({ timeout: 20_000 });
  });

  test('about page loads', async ({ page }) => {
    await page.goto('/about');
    await expect(page.locator('main')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('feedback page loads', async ({ page }) => {
    await page.goto('/feedback');
    await expect(page.locator('main')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/问题反馈|功能建议|反馈/).first()).toBeVisible();
  });
});
