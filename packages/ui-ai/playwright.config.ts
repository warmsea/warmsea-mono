import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
const runId = (process.env.WUI_AI_RUN_ID ??= randomUUID());
const artifacts = new URL(`./.artifacts/browser/${runId}/`, import.meta.url);
export default defineConfig({
  testDir: './tests/browser',
  outputDir: fileURLToPath(new URL('results/', artifacts)),
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
  workers: 2,
  forbidOnly: !!process.env.CI,
  updateSnapshots: 'none',
  use: {
    baseURL: process.env.WUI_AI_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1100, height: 900 },
    locale: 'en-US',
    colorScheme: 'light',
    reducedMotion: 'reduce',
  },
  projects: ['chromium', 'firefox', 'webkit'].map((browserName) => ({
    name: browserName,
    use: { browserName: browserName as 'chromium' | 'firefox' | 'webkit' },
  })),
  webServer: {
    command: 'node scripts/test-server.mjs',
    cwd: fileURLToPath(new URL('./', import.meta.url)),
    wait: { stdout: /WUI_AI_URL=(?<wui_ai_url>http:\/\/127\.0\.0\.1:\d+)/ },
    stdout: 'pipe',
    reuseExistingServer: false,
  },
});
