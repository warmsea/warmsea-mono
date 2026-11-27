// @vitest-environment node
import { execFileSync, spawnSync } from 'node:child_process';
import { platform } from 'node:os';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
  execFileSync: vi.fn(),
  execFile: vi.fn(),
}));
vi.mock('node:os', () => ({ platform: vi.fn() }));

const run = vi.mocked(spawnSync);
const load = () =>
  import(new URL('../scripts/check-ci.mjs', import.meta.url).href);

beforeEach(() => {
  vi.resetModules();
  run.mockReset();
  vi.mocked(execFileSync).mockReset();
  vi.mocked(execFileSync).mockReturnValue('fixture-bun.exe' as never);
  run.mockReturnValue({
    pid: 0,
    output: [],
    stdout: Buffer.alloc(0),
    stderr: Buffer.alloc(0),
    status: 0,
    signal: null,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('package CI acceptance', () => {
  it.each(['win32', 'linux'] as const)(
    'preserves complete %s acceptance and selects only supported snapshots',
    async (os) => {
      vi.mocked(platform).mockReturnValue(os);
      await load();
      expect(run.mock.calls.map(([, args]) => args)).toEqual([
        ['run', 'check:code'],
        [
          'run',
          'test:browsers',
          ...(os === 'win32'
            ? []
            : [
                '--project',
                'chromium',
                '--project',
                'firefox',
                '--project',
                'webkit',
              ]),
        ],
      ]);
      for (const [, , options] of run.mock.calls) {
        expect(options?.cwd).toBe(
          fileURLToPath(new URL('../', import.meta.url)),
        );
      }
    },
  );

  it('stops at the first failed command and propagates its exit status', async () => {
    vi.mocked(platform).mockReturnValue('linux');
    run.mockReturnValueOnce({
      pid: 0,
      output: [],
      stdout: Buffer.alloc(0),
      stderr: Buffer.alloc(0),
      status: 7,
      signal: null,
    });
    const stopped = new Error('stopped');
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw stopped;
    });
    await expect(load()).rejects.toThrow(stopped);
    expect(exit).toHaveBeenCalledWith(7);
    expect(run).toHaveBeenCalledOnce();
  });

  it('reports process-start failures instead of continuing acceptance', async () => {
    vi.mocked(platform).mockReturnValue('linux');
    const error = new Error('Cannot start Bun');
    run.mockReturnValueOnce({
      pid: 0,
      output: [],
      stdout: Buffer.alloc(0),
      stderr: Buffer.alloc(0),
      status: null,
      signal: null,
      error,
    });
    await expect(load()).rejects.toThrow(error);
    expect(run).toHaveBeenCalledOnce();
  });

  it('reports runtime discovery failures before starting any acceptance command', async () => {
    const error = new Error('Pinned Bun not on PATH');
    vi.mocked(execFileSync).mockImplementation(() => {
      throw error;
    });
    await expect(load()).rejects.toThrow(error);
    expect(run).not.toHaveBeenCalled();
  });
});
