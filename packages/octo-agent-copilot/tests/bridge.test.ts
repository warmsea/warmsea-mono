import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import {
  serveProvider,
  connectProvider,
  type MessageChannel,
} from '@warmsea/octo-agent-sdk/bridge';
import {
  capabilities,
  openCopilotSession,
} from '../src/copilot-agent-session.js';

function pair(): [MessageChannel, MessageChannel] {
  const stop = new AbortController();
  const receivers = new Map<number, (frame: string) => void>();
  const endpoint = (i: number): MessageChannel => ({
    signal: stop.signal,
    close: () => stop.abort(),
    subscribe(fn) {
      receivers.set(i, fn);
      return () => receivers.delete(i);
    },
    async send(frame) {
      const fn = receivers.get(1 - i);
      if (!fn) throw Error('Closed');
      fn(frame);
    },
  });
  return [endpoint(0), endpoint(1)];
}
test.each(['auth', 'ok'])(
  'Octo bridge preserves ACP %s behavior',
  async (scenario) => {
    const [c, s] = pair();
    const server = serveProvider(
      {
        async describe() {
          return capabilities;
        },
        async open(r) {
          return openCopilotSession(
            r.branch,
            { cwd: process.cwd(), executable: process.execPath },
            (f, a, o) =>
              spawn(
                f,
                [
                  fileURLToPath(
                    new URL('./fixtures/peer.mjs', import.meta.url),
                  ),
                  scenario,
                  ...a,
                ],
                o,
              ),
          );
        },
      },
      s,
    );
    try {
      const provider = await connectProvider(c, {
        forBranch() {
          throw Error('Stateful provider must not read app history');
        },
      });
      const fresh = provider.open({ start: 'fresh', branch: 'b' });
      if (scenario === 'auth') {
        await expect(fresh).rejects.toMatchObject({ code: 'auth_required' });
        return;
      }
      const session = await fresh;
      const events = [];
      for await (const e of session.prompt({
        parentTurnId: null,
        input: 'hello',
        turnId: '1',
      }))
        events.push(e);
      expect(events).toEqual([
        { type: 'text.delta', text: 'hello' },
        { type: 'completed' },
      ]);
      await session.close();
    } finally {
      server.close();
    }
  },
);
