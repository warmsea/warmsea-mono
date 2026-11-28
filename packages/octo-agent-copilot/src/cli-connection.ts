import {
  spawn,
  type SpawnOptionsWithStdioTuple,
  type ChildProcessByStdio,
} from 'node:child_process';
import { access, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { delimiter, isAbsolute, join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import * as acp from '@agentclientprotocol/sdk';
import { ProviderError } from '@warmsea/octo-agent-sdk';

export interface CopilotOptions {
  cwd: string;
  executable?: string;
}
type Options = SpawnOptionsWithStdioTuple<'pipe', 'pipe', 'ignore'>;
export type Launch = (
  file: string,
  args: string[],
  options: Options,
) => ChildProcessByStdio<Writable, Readable, null>;
export function validate(options: CopilotOptions) {
  if (!isAbsolute(options.cwd))
    throw new ProviderError(
      'invalid_request',
      'Expected an absolute working directory',
    );
  if (
    options.executable &&
    (!isAbsolute(options.executable) ||
      (process.platform === 'win32' && !/\.exe$/i.test(options.executable)))
  )
    throw new ProviderError(
      'invalid_request',
      'Specify an absolute native executable path',
    );
}
async function executable(override?: string) {
  const name = process.platform === 'win32' ? 'copilot.exe' : 'copilot';
  const candidates = override
    ? [override]
    : (process.env.PATH ?? '')
        .split(delimiter)
        .filter((p) => isAbsolute(p))
        .map((p) => join(p, name));
  for (const p of candidates) {
    try {
      await access(p, constants.X_OK);
      if ((await stat(p)).isFile()) return p;
    } catch (e) {
      if (
        !['ENOENT', 'ENOTDIR', 'EACCES'].includes(
          (e as NodeJS.ErrnoException).code ?? '',
        )
      )
        throw new ProviderError(
          'upstream_failure',
          'Cannot inspect Copilot CLI executable',
        );
    }
  }
  throw new ProviderError(
    'upstream_failure',
    'Copilot CLI executable unavailable. Install it or specify an absolute native executable path.',
  );
}
export function safeError(e: unknown, inTurn = false) {
  if (e instanceof ProviderError) return e;
  if (e instanceof acp.RequestError) {
    if (e.code === -32000)
      return new ProviderError(
        'auth_required',
        'Run copilot login as the OS user running the server, then retry.',
      );
    if (e.code === -32601)
      return new ProviderError(
        'unsupported',
        'Installed CLI does not support the requested ACP operation',
      );
    return new ProviderError(
      'upstream_failure',
      'Copilot CLI rejected the ACP request',
    );
  }
  return inTurn
    ? new ProviderError(
        'outcome_unknown',
        'Copilot connection lost; turn outcome is unknown',
      )
    : new ProviderError(
        'upstream_failure',
        'Could not start the Copilot ACP session',
      );
}
async function bounded<T>(promise: Promise<T>, ms: number, message: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new ProviderError('upstream_failure', message)),
          ms,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export async function connect(
  options: CopilotOptions,
  app: acp.ClientApp,
  launch: Launch = spawn,
) {
  validate(options);
  const child = launch(
    await executable(options.executable),
    ['--acp', '--stdio'],
    {
      cwd: options.cwd,
      stdio: ['pipe', 'pipe', 'ignore'],
      shell: false,
      windowsHide: true,
    },
  );
  const ended = new Promise<void>((resolve) =>
    child.once('close', () => resolve()),
  );
  const spawned = new Promise<void>((resolve, reject) => {
    child.once('spawn', resolve);
    child.on('error', () =>
      reject(
        new ProviderError(
          'upstream_failure',
          'Could not launch Copilot CLI; verify executable, permissions and working directory',
        ),
      ),
    );
  });
  await spawned;
  const rpc = app.connect(
    acp.ndJsonStream(
      Writable.toWeb(child.stdin),
      Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>,
    ),
  );
  let stopping: Promise<void> | undefined;
  function close() {
    return (stopping ??= (async () => {
      rpc.close();
      child.stdin.end();
      try {
        await bounded(ended, 1500, 'Waiting for CLI shutdown');
      } catch {
        child.kill('SIGKILL');
        await bounded(ended, 3000, 'Copilot CLI did not exit');
      }
    })());
  }
  try {
    const session = await bounded(
      (async () => {
        const init = await rpc.agent.request('initialize', {
          protocolVersion: acp.PROTOCOL_VERSION,
          clientCapabilities: {},
        });
        if (init.protocolVersion !== acp.PROTOCOL_VERSION)
          throw new ProviderError(
            'unsupported',
            'Incompatible Copilot ACP version',
          );
        return rpc.agent.request('session/new', {
          cwd: options.cwd,
          mcpServers: [],
        });
      })(),
      15000,
      'Timed out starting Copilot ACP session',
    );
    if (typeof session?.sessionId !== 'string' || !session.sessionId)
      throw new ProviderError(
        'protocol_error',
        'Invalid ACP session identifier',
      );
    return { rpc, id: session.sessionId, close };
  } catch (e) {
    await close();
    throw safeError(e);
  }
}
