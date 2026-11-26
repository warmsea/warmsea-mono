// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const load = async (filename: string) =>
  (await import(new URL(`../${filename}`, import.meta.url).href)).default;

beforeEach(() => {
  vi.resetModules();
  for (const prefix of ['WUI_VUE', 'WUI_STORYBOOK']) {
    vi.stubEnv(`${prefix}_RUN_ID`, undefined);
    vi.stubEnv(`${prefix}_URL`, undefined);
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe.each([
  ['playwright.config.ts', 'WUI_VUE'],
  ['playwright.storybook.config.ts', 'WUI_STORYBOOK'],
])('isolated %s', (filename, prefix) => {
  it('requires the owned host rather than starting or reusing another server', async () => {
    await expect(load(filename)).rejects.toThrow('guarded');
  });

  it('uses the parent run identity and gives separate invocations separate reports', async () => {
    vi.stubEnv(`${prefix}_URL`, 'http://127.0.0.1:54321');
    vi.stubEnv(`${prefix}_RUN_ID`, 'first');
    const first = await load(filename);
    vi.stubEnv(`${prefix}_RUN_ID`, 'second');
    vi.resetModules();
    const second = await load(filename);
    expect(first.outputDir).not.toBe(second.outputDir);
    expect(first.reporter[1][1].outputFolder).not.toBe(
      second.reporter[1][1].outputFolder,
    );
    expect(first.outputDir).toContain('.artifacts');
    expect(first.webServer).toBeUndefined();
    expect(first.use.baseURL).toBe('http://127.0.0.1:54321');
  });

  it('shares the run ID and captured ready URL with worker reloads', async () => {
    const url = 'http://127.0.0.1:54321';
    vi.stubEnv(`${prefix}_URL`, url);
    vi.stubEnv(`${prefix}_RUN_ID`, 'example');
    const controller = await load(filename);
    vi.resetModules();
    const worker = await load(filename);
    expect(worker.outputDir).toBe(controller.outputDir);
    expect(worker.reporter).toEqual(controller.reporter);
    expect(worker.use.baseURL).toBe(url);
  });
});
