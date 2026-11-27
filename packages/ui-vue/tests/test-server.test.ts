// @vitest-environment node
import { EventEmitter } from 'node:events';
import { execFile, spawn } from 'node:child_process';
import { platform } from 'node:os';
import { setImmediate } from 'node:timers/promises';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { preview } from 'vite';

vi.mock('node:child_process', () => ({ spawn: vi.fn(), execFile: vi.fn() }));
vi.mock('node:os', () => ({ platform: vi.fn() }));
vi.mock('vite', () => ({ preview: vi.fn() }));

const close = vi.fn();
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.mocked(platform).mockReturnValue(process.platform);
  vi.mocked(preview).mockResolvedValue({
    httpServer: { address: () => ({ port: 54321 }) },
    close,
  } as never);
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        entries: {
          'wui-contract-button--matrix-and-palette': {},
          'wui-contract-app-bar--navigation': {},
        },
      }),
    }),
  );
  vi.mocked(spawn).mockImplementation(() => {
    const child = Object.assign(new EventEmitter(), { kill: vi.fn() });
    queueMicrotask(() => child.emit('exit', 0));
    return child as never;
  });
});
afterEach(() => vi.unstubAllGlobals());

const load = () =>
  import(new URL('../scripts/test-server.mjs', import.meta.url).href);

it('keeps visual file selectors before the native variadic project option', async () => {
  const { runBrowserChecks } = await load();
  await runBrowserChecks('visual', ['button.visual.spec.ts']);
  expect(vi.mocked(spawn).mock.calls[0]![1]!.slice(-2)).toEqual([
    'button.visual.spec.ts',
    '--project=visual',
  ]);
});

it('serves one owned host while sequential native runners share identity but not reports', async () => {
  const { runBrowserChecks } = await load();
  await runBrowserChecks('all', ['--project=chromium']);
  expect(preview).toHaveBeenCalledOnce();
  expect(spawn).toHaveBeenCalledTimes(2);
  const [component, site] = vi.mocked(spawn).mock.calls;
  expect(component![0]).toBe(process.execPath);
  expect(component![1]).toContain('--project=chromium');
  expect(site![1]).not.toContain('--project=chromium');
  expect(site![1]).toContain('playwright.storybook.config.ts');
  const env = component![2]!.env!;
  expect(env.WUI_VUE_URL).toBe('http://127.0.0.1:54321');
  expect(env.WUI_VUE_URL).toBe(env.WUI_STORYBOOK_URL);
  expect(site![2]!.env).toEqual(env);
  expect(close).toHaveBeenCalledOnce();
});

it.each(['exit', 'error'])(
  'closes its host and stops after child %s failure',
  async (kind) => {
    vi.mocked(spawn).mockImplementationOnce(() => {
      const child = Object.assign(new EventEmitter(), { kill: vi.fn() });
      queueMicrotask(() =>
        child.emit(kind, kind === 'exit' ? 7 : new Error('spawn failed')),
      );
      return child as never;
    });
    const { runBrowserChecks } = await load();
    await expect(runBrowserChecks('all', [])).rejects.toThrow(
      kind === 'exit' ? '(7)' : 'spawn failed',
    );
    expect(spawn).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  },
);

it('rejects a public-only or missing static build before starting tests', async () => {
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    json: async () => ({ entries: {} }),
  } as Response);
  const { runBrowserChecks } = await load();
  await expect(runBrowserChecks('browser', [])).rejects.toThrow(
    'build:storybook:test',
  );
  expect(spawn).not.toHaveBeenCalled();
  expect(close).toHaveBeenCalledOnce();
});

it.each([
  ['win32', 'SIGINT'],
  ['win32', 'SIGTERM'],
  ['linux', 'SIGINT'],
  ['linux', 'SIGTERM'],
] as const)(
  'interrupts its owned child on %s %s and closes the shared host',
  async (os, signal) => {
    vi.mocked(platform).mockReturnValue(os);
    const child = Object.assign(new EventEmitter(), {
      pid: 4242,
      exitCode: null,
      signalCode: null as NodeJS.Signals | null,
      kill: vi.fn(() => {
        child.signalCode = 'SIGTERM';
        queueMicrotask(() => child.emit('exit', null));
        return true;
      }),
    });
    vi.mocked(execFile).mockImplementation((...args: unknown[]) => {
      queueMicrotask(() => {
        child.signalCode = 'SIGTERM';
        child.emit('exit', null);
        (args.at(-1) as () => void)();
      });
      return {} as never;
    });
    vi.mocked(spawn).mockImplementationOnce(() => {
      queueMicrotask(() => process.emit(signal));
      return child as never;
    });
    const listeners = process.listenerCount(signal);
    const { runBrowserChecks } = await load();
    await expect(runBrowserChecks('all', [])).rejects.toThrow('signal');
    if (os === 'win32') {
      expect(execFile).toHaveBeenCalledWith(
        'taskkill',
        ['/PID', '4242', '/T', '/F'],
        expect.any(Function),
      );
      expect(child.kill).not.toHaveBeenCalled();
    } else {
      expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    }
    expect(spawn).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(process.listenerCount(signal)).toBe(listeners);
  },
);

it.each([
  ['win32', 'SIGINT', 'taskkill'],
  ['win32', 'SIGTERM', 'taskkill'],
  ['linux', 'SIGTERM', 'throw'],
  ['linux', 'SIGTERM', 'false'],
  ['linux', 'SIGTERM', 'error'],
] as const)(
  'reports %s %s %s termination failure without awaiting a live child forever',
  async (os, signal, failure) => {
    vi.mocked(platform).mockReturnValue(os);
    const cause = new Error('Access denied');
    const child = Object.assign(new EventEmitter(), {
      pid: 4242,
      exitCode: null as number | null,
      signalCode: null,
      unref: vi.fn(),
      kill: vi.fn(() => {
        if (failure === 'throw') throw cause;
        if (failure === 'error') child.emit('error', cause);
        return false;
      }),
    });
    vi.mocked(execFile).mockImplementation((...args: unknown[]) => {
      queueMicrotask(() => (args.at(-1) as (error: Error) => void)(cause));
      return {} as never;
    });
    vi.mocked(spawn).mockImplementationOnce(() => {
      queueMicrotask(() => process.emit(signal));
      return child as never;
    });
    const listeners = ['SIGINT', 'SIGTERM'].map((name) =>
      process.listenerCount(name),
    );
    const { runBrowserChecks } = await load();
    let settled = false;
    let outcome: unknown;
    const completion = runBrowserChecks('all', []).then(
      () => {
        settled = true;
      },
      (error: unknown) => {
        settled = true;
        outcome = error;
      },
    );
    await setImmediate();
    try {
      expect(settled).toBe(true);
      expect(outcome).toBeInstanceOf(Error);
      expect((outcome as Error).message).toContain('4242');
      expect((outcome as Error).message).toContain(
        failure === 'false' ? 'returned false' : cause.message,
      );
      if (failure !== 'false') expect((outcome as Error).cause).toBe(cause);
      expect(close).toHaveBeenCalledOnce();
      expect(child.unref).toHaveBeenCalledOnce();
      expect(spawn).toHaveBeenCalledOnce();
      expect(
        ['SIGINT', 'SIGTERM'].map((name) => process.listenerCount(name)),
      ).toEqual(listeners);
    } finally {
      // Let the pre-fix implementation settle without a test timeout or leaked listeners.
      if (!settled) {
        child.exitCode = 0;
        child.emit('exit', 0);
      }
      await completion;
    }
  },
);

it('does not report taskkill not-found when the owned child has already exited', async () => {
  vi.mocked(platform).mockReturnValue('win32');
  const child = Object.assign(new EventEmitter(), {
    pid: 4242,
    exitCode: null as number | null,
    signalCode: null,
    unref: vi.fn(),
  });
  vi.mocked(execFile).mockImplementation((...args: unknown[]) => {
    queueMicrotask(() => {
      child.exitCode = 0;
      child.emit('exit', 0);
      (args.at(-1) as (error: Error) => void)(new Error('Process not found'));
    });
    return {} as never;
  });
  vi.mocked(spawn).mockImplementationOnce(() => {
    queueMicrotask(() => process.emit('SIGTERM'));
    return child as never;
  });
  const { runBrowserChecks } = await load();
  await expect(runBrowserChecks('all', [])).rejects.toThrow(
    'checks failed (0)',
  );
  expect(close).toHaveBeenCalledOnce();
  expect(child.unref).not.toHaveBeenCalled();
});

it.each(['exitCode', 'signalCode'] as const)(
  'does not terminate a child whose %s already records exit',
  async (property) => {
    vi.mocked(platform).mockReturnValue('win32');
    const child = Object.assign(new EventEmitter(), {
      pid: 4242,
      exitCode: null as number | null,
      signalCode: null as NodeJS.Signals | null,
    });
    vi.mocked(spawn).mockImplementationOnce(() => {
      queueMicrotask(() => {
        if (property === 'exitCode') child.exitCode = 0;
        else child.signalCode = 'SIGTERM';
        child.emit('exit', child.exitCode);
        process.emit('SIGTERM');
      });
      return child as never;
    });
    const { runBrowserChecks } = await load();
    await expect(runBrowserChecks('all', [])).rejects.toThrow('checks failed');
    expect(execFile).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  },
);
