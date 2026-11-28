import { expect, test, vi } from 'vitest';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { openCopilotSession } from '../src/copilot-agent-session.js';
import { CopilotAgentProvider } from '../src/index.js';

test('discovers a native executable on an absolute PATH with spaces and inherits the host environment', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'octo path '));
  try {
    const executable = join(
      cwd,
      process.platform === 'win32' ? 'copilot.exe' : 'copilot',
    );
    await writeFile(executable, '', { mode: 0o700 });
    vi.stubEnv('PATH', cwd);
    const session = await openCopilotSession(
      'b',
      { cwd },
      (file, args, options) => {
        expect(file).toBe(executable);
        expect(options.env).toBeUndefined();
        expect(options.shell).toBe(false);
        return spawn(
          process.execPath,
          [
            fileURLToPath(new URL('./fixtures/peer.mjs', import.meta.url)),
            'ok',
            ...args,
          ],
          options,
        );
      },
    );
    await session.close();
  } finally {
    vi.unstubAllEnvs();
    await rm(cwd, { recursive: true, force: true });
  }
});

test('discovery and unsupported resume never launch a CLI or request credentials', async () => {
  const p = new CopilotAgentProvider({
    cwd: process.cwd(),
    executable: resolve('missing-copilot.exe'),
  });
  expect(await p.describe()).toMatchObject({
    resume: false,
    fork: 'none',
    approvals: true,
  });
  await expect(
    p.open({ branch: 'b', start: 'resume', tip: null, resumeToken: 'x' }),
  ).rejects.toMatchObject({ code: 'unsupported' });
  await expect(p.open({ branch: 'b', start: 'fresh' })).rejects.toThrow(
    /executable/i,
  );
});
