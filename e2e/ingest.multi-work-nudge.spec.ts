import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import JSZip from 'jszip';
import { waitForStore } from './helpers';

/**
 * Item 3: while the multi-work notice is open, the first 整理文件 click only brings the
 * notice into view (wine outline pulse); the second click starts the usual ceremony.
 */
const DIR = '/tmp/e2e-multi-work';
const srt = (t: string) => `1\n00:00:01,000 --> 00:00:03,000\n${t}\n`;

async function fixtures() {
  mkdirSync(DIR, { recursive: true });
  const z = new JSZip();
  const p = 'Ted.Lasso.S04E01.Home.1080p.ATVP.WEB-DL.DDP5.1.Atmos.H.264-FLUX.';
  for (const tag of ['CHS', 'CHT', 'EN', 'EN&CHS', 'EN&CHT']) z.file(`${p}${tag}.srt`, srt(`${tag} 足球就是生活。`));
  for (const tag of ['CHS', 'CHT', 'EN&CHS', 'EN&CHT']) z.file(`${p}${tag}.ass`, srt(tag));
  const zip = `${DIR}/ted.zip`;
  writeFileSync(zip, await z.generateAsync({ type: 'nodebuffer' }));
  const a = `${DIR}/Slow.Horses.S04E01.Identity.Theft.1080p.ATVP.WEB-DL.chs.srt`;
  const b = `${DIR}/Slow.Horses.S04E01.Identity.Theft.1080p.ATVP.WEB-DL.eng.srt`;
  writeFileSync(a, srt('慢马。'));
  writeFileSync(b, srt('Slow horses.'));
  return [zip, a, b];
}

test('multi-work notice: counts files; first 整理文件 nudges, second proceeds', async ({ page }) => {
  await page.route('**/api/tmdb/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"results":[]}' }));
  const files = await fixtures();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await waitForStore(page);
  await page.locator('input[type=file][multiple]').first().setInputFiles(files);
  const notice = page.locator('[data-multi-work-notice]');
  await expect(notice).toBeVisible({ timeout: 20_000 });
  await expect(notice).toContainText('9 个文件');
  await expect(notice).toContainText('2 个文件');

  const process = page.getByRole('button', { name: /整理文件/ }).last();
  await process.click();
  await expect(page.locator('[data-multi-work-nudged]')).toHaveCount(1);
  await expect(page.locator('[data-multi-work-pulse]')).toHaveCount(1);
  await expect(page.locator('[data-ingest-parsing-title]')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __SAIKO_STORE__: { getState: () => { workflowStep: number } } }).__SAIKO_STORE__.getState().workflowStep)).toBe(1);

  await process.click();
  await expect(page.locator('[data-ingest-parsing-title]')).toBeVisible({ timeout: 5_000 });
});
