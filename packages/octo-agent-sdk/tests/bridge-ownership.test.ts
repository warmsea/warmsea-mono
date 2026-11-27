import { expect, test } from 'vitest';
import {
  type AgentProvider,
  type AgentSession,
  type HostServices,
  type TurnEvent,
} from '../src/index.js';
import {
  connectProvider,
  serveProvider,
  type MessageChannel,
} from '../src/bridge/index.js';
import { channels } from './fixtures/memory-channel.js';

const caps = {
  approvals: true,
  tools: false,
  resume: false,
  fork: 'none',
} as const;
const none: HostServices = {
  forBranch() {
    throw Error('Unexpected history access');
  },
};
const next = (session: AgentSession) =>
  session
    .prompt({ turnId: 't', parentTurnId: null, input: 'hi' })
    [Symbol.asyncIterator]();
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { resolve, promise };
}
function create(
  make: (branch: string, host: HostServices) => AgentSession,
  services = none,
  modify?: (channel: MessageChannel) => MessageChannel,
) {
  const [client, server] = channels();
  const bridge = serveProvider(
    (host): AgentProvider => ({
      async describe() {
        return caps;
      },
      async open(r) {
        return make(r.branch, host);
      },
    }),
    modify ? modify(server) : server,
  );
  return { connected: connectProvider(client, services), close: bridge.close };
}
function base(branch: string) {
  return {
    binding: { branch, tip: null },
    capabilities: caps,
    async *prompt() {
      yield { type: 'completed' };
    },
    async cancel() {},
    async decide() {},
    async close() {},
  } satisfies AgentSession;
}

test('scopes reverse reads to the calling turn with two active branches at the same parent', async () => {
  const finish = deferred(),
    reads: string[] = [];
  const fixture = create(
    (branch, services) => ({
      ...base(branch),
      async *prompt() {
        if (branch === 'b') {
          yield { type: 'text.delta', text: 'ready' };
          await finish.promise;
        } else
          await expect(
            services.forBranch('b').readThrough(null),
          ).rejects.toThrow();
        yield { type: 'completed' };
      },
    }),
    {
      forBranch: (branch) => ({
        async readThrough() {
          reads.push(branch);
          return [];
        },
      }),
    },
  );
  try {
    const provider = await fixture.connected;
    const a = await provider.open({ branch: 'a', start: 'fresh' }),
      b = await provider.open({ branch: 'b', start: 'fresh' });
    const open = next(b);
    await open.next();
    expect((await next(a).next()).value.type).toBe('completed');
    expect(reads).toEqual([]);
    finish.resolve();
    await open.next();
  } finally {
    finish.resolve();
    fixture.close();
  }
});
test('terminal observation closes approval admission even before iterator cleanup settles', async () => {
  const end = deferred(),
    cleanup = deferred(),
    release = deferred();
  let decisions = 0;
  const f = create((branch) => ({
    ...base(branch),
    async *prompt() {
      try {
        yield {
          type: 'approval.requested',
          requestId: 'q',
          action: 'Read',
          choices: ['allow'],
        };
        await end.promise;
        yield { type: 'cancelled' };
      } finally {
        cleanup.resolve();
        await release.promise;
      }
    },
    async decide() {
      decisions++;
    },
    async cancel() {
      end.resolve();
    },
  }));
  try {
    const s = await (await f.connected).open({ branch: 'a', start: 'fresh' }),
      stream = next(s);
    await stream.next();
    await s.cancel('t');
    await cleanup.promise;
    await expect(
      s.decide!({ turnId: 't', requestId: 'q', choice: 'allow' }),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect(decisions).toBe(0);
    release.resolve();
    expect((await stream.next()).value.type).toBe('cancelled');
  } finally {
    release.resolve();
    f.close();
  }
});
test('disconnect releases a cooperative adapter waiting locally without cancelling upstream', async () => {
  const released = deferred();
  let cancelled = false,
    observedLoss = false;
  const f = create((branch) => ({
    ...base(branch),
    async *prompt(_request, loss?: AbortSignal): AsyncIterable<TurnEvent> {
      yield {
        type: 'approval.requested',
        requestId: 'q',
        action: 'Read',
        choices: ['allow'],
      };
      if (!loss) throw Error('Missing connection lifetime');
      if (!loss.aborted)
        await new Promise<void>((resolve) =>
          loss.addEventListener('abort', () => resolve(), { once: true }),
        );
      observedLoss = loss.aborted;
      throw Error('Connection lost');
    },
    async close() {
      released.resolve();
    },
    async cancel() {
      cancelled = true;
    },
  }));
  const p = await f.connected,
    s = await p.open({ branch: 'a', start: 'fresh' }),
    stream = next(s);
  await stream.next();
  p.disconnect();
  await released.promise;
  expect(observedLoss).toBe(true);
  expect(cancelled).toBe(false);
  await expect(stream.next()).rejects.toMatchObject({
    code: 'outcome_unknown',
  });
});
test('duplicate opens leave the first binding intact; close failure can be retried', async () => {
  let opens = 0,
    closes = 0;
  const f = create((branch) => {
    opens++;
    return {
      ...base(branch),
      async close() {
        if (++closes === 1) throw Error('temporarily busy');
      },
    };
  });
  try {
    const p = await f.connected,
      s = await p.open({ branch: 'a', start: 'fresh' });
    await expect(p.open({ branch: 'a', start: 'fresh' })).rejects.toMatchObject(
      { code: 'conflict' },
    );
    expect(opens).toBe(1);
    expect(closes).toBe(0);
    await expect(s.close()).rejects.toMatchObject({ code: 'upstream_failure' });
    await s.close();
    expect(closes).toBe(2);
  } finally {
    f.close();
  }
});
test('proxy does not yield an approval from a peer without negotiated approval support', async () => {
  const f = create(
    (branch) => ({
      ...base(branch),
      async *prompt() {
        yield {
          type: 'approval.requested',
          requestId: 'q',
          action: 'Read',
          choices: ['ok'],
        };
        yield { type: 'completed' };
      },
    }),
    none,
    (channel) => ({
      ...channel,
      async send(frame) {
        const msg = JSON.parse(frame);
        if (msg.result?.capabilities) msg.result.capabilities.approvals = false;
        await channel.send(JSON.stringify(msg));
      },
    }),
  );
  try {
    const s = await (await f.connected).open({ branch: 'a', start: 'fresh' });
    await expect(next(s).next()).rejects.toThrow();
  } finally {
    f.close();
  }
});
