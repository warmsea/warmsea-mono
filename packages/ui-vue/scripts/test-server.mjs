import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { platform } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';

const file = fileURLToPath(import.meta.url);
const directory = fileURLToPath(new URL('../', import.meta.url));
const cli = createRequire(import.meta.url).resolve('@playwright/test/cli');

export async function runBrowserChecks(suite, args) {
  assert.ok(
    ['browser', 'storybook', 'visual', 'all'].includes(suite),
    'Unknown browser suite',
  );
  const runId = randomUUID();
  let server;
  let child;
  let childError;
  let rejectChild;
  let interrupted = false;
  let termination;
  const terminateChild = async () => {
    const target = child;
    if (!target?.pid) return;
    const exited = () => target.exitCode !== null || target.signalCode !== null;
    if (exited()) return;
    try {
      if (platform() === 'win32') {
        await new Promise((accept, reject) => {
          execFile(
            'taskkill',
            ['/PID', String(target.pid), '/T', '/F'],
            (error) => (error ? reject(error) : accept()),
          );
        });
      } else if (!target.kill('SIGTERM')) {
        throw childError ?? new Error('kill(SIGTERM) returned false');
      }
    } catch (error) {
      if (exited()) return;
      target.unref();
      throw new Error(
        `Failed to terminate owned browser runner PID ${target.pid}: ${error.message}; process may still be running`,
        { cause: error },
      );
    }
  };
  const interrupt = () => {
    interrupted = true;
    if (!termination) {
      termination = terminateChild();
      void termination.catch((error) => rejectChild?.(error));
    }
  };
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  try {
    server = await preview({
      configFile: false,
      root: directory,
      build: { outDir: '.artifacts/storybook/static' },
      preview: { host: '127.0.0.1', port: 0, strictPort: true },
    });
    const address = server.httpServer.address();
    assert.ok(address && typeof address !== 'string');
    const url = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${url}/index.json`);
    assert.ok(response.ok, 'Run build:storybook:test before browser checks');
    const index = await response.json();
    for (const id of [
      'wui-contract-button--matrix-and-palette',
      'wui-contract-app-bar--navigation',
    ]) {
      assert.ok(
        index.entries?.[id],
        'Run build:storybook:test before browser checks',
      );
    }
    const env = {
      ...process.env,
      WUI_VUE_URL: url,
      WUI_STORYBOOK_URL: url,
      WUI_VUE_RUN_ID: runId,
      WUI_STORYBOOK_RUN_ID: runId,
    };
    console.log(
      `WUI_HOST_URL=${url} RUN_ID=${runId} PID=${process.pid} NODE=${process.version}`,
    );
    const configurations =
      suite === 'all'
        ? ['browser', 'storybook']
        : [suite === 'visual' ? 'browser' : suite];
    for (const name of configurations) {
      if (interrupted) throw new Error('Browser checks interrupted');
      const config =
        name === 'browser'
          ? 'playwright.config.ts'
          : 'playwright.storybook.config.ts';
      const selected =
        suite === 'all' && name === 'storybook'
          ? []
          : suite === 'visual'
            ? [...args, '--project=visual']
            : args;
      const code = await new Promise((accept, reject) => {
        rejectChild = reject;
        childError = undefined;
        child = spawn(
          process.execPath,
          [cli, 'test', '--config', config, ...selected],
          {
            cwd: directory,
            env,
            stdio: 'inherit',
          },
        );
        child.once('error', (error) => {
          childError = error;
          reject(error);
        });
        child.once('exit', (code) => accept(code));
      });
      child = undefined;
      if (code !== 0 || interrupted) {
        const error = new Error(`${name} checks failed (${code ?? 'signal'})`);
        error.exitCode = typeof code === 'number' && code !== 0 ? code : 1;
        throw error;
      }
    }
  } finally {
    rejectChild = undefined;
    try {
      await (termination ?? terminateChild());
    } finally {
      try {
        await server?.close();
      } finally {
        process.removeListener('SIGINT', interrupt);
        process.removeListener('SIGTERM', interrupt);
      }
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === file) {
  try {
    await runBrowserChecks(process.argv[2], process.argv.slice(3));
  } catch (error) {
    console.error(error);
    process.exitCode = error.exitCode ?? 1;
  }
}
