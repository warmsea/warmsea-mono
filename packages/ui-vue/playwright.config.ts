import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const runId = process.env.WUI_VUE_RUN_ID;
if (!runId || !process.env.WUI_VUE_URL)
  throw new Error('Use the guarded test:browser/test:browsers script.');
const artifacts = new URL(`./.artifacts/browser/${runId}/`, import.meta.url);

export default defineConfig({
  testDir: './tests/browser',
  outputDir: fileURLToPath(new URL('results/', artifacts)),
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
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
  timeout: 30_000,
  updateSnapshots: 'none',
  use: {
    baseURL: process.env.WUI_VUE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1100, height: 900 },
    colorScheme: 'light',
    locale: 'en-US',
    reducedMotion: 'reduce',
  },
  projects: [
    ...['chromium', 'firefox', 'webkit'].map((browserName) => ({
      name: browserName,
      use: { browserName: browserName as 'chromium' | 'firefox' | 'webkit' },
      testIgnore: '**/*.visual.spec.ts',
      grepInvert: browserName === 'chromium' ? undefined : /@chromium-only/,
    })),
    {
      name: 'visual',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1100, height: 900 },
      },
      testMatch: '**/*.visual.spec.ts',
    },
  ],
});
