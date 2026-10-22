import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT || 4173);
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;

/**
 * Headless e2e against a built Vite MPA + Workers preview (Switch B).
 * CI: `npm run build` then `npx playwright test`.
 * Local: same, or reuse an already-running preview via BASE_URL + reuseExistingServer.
 *
 * Wrangler config path is resolved after build (CF vite plugin emits under dist/).
 */
const wranglerCandidates = [
  'dist/saikosubstudio/wrangler.json',
  'dist/server/wrangler.json',
  'dist/client/wrangler.json',
  'dist/workers/default/wrangler.json',
];
const wranglerConfig = wranglerCandidates.find((p) => {
  try {
    return require('node:fs').existsSync(p);
  } catch {
    return false;
  }
}) ?? wranglerCandidates[0];

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.E2E_NO_WEBSERVER
    ? undefined
    : {
        // Build first so wrangler.json exists; e2e assumes `npm run build` already ran in CI.
        command: `npx wrangler dev --config ${wranglerConfig} --ip 127.0.0.1 --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
