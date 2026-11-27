import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const runId = process.env.WUI_STORYBOOK_RUN_ID;
if (!runId || !process.env.WUI_STORYBOOK_URL)
  throw new Error('Use the guarded test:storybook/test:browsers script.');
const artifacts = new URL(`./.artifacts/storybook/${runId}/`, import.meta.url);

export default defineConfig({
  testDir: './tests/storybook',
  outputDir: fileURLToPath(new URL('results/', artifacts)),
  testMatch: '**/*.storybook.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    [
      'html',
      {
        open: 'never',
        outputFolder: fileURLToPath(new URL('report/', artifacts)),
      },
    ],
  ],
  use: {
    browserName: 'chromium',
    baseURL: process.env.WUI_STORYBOOK_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
