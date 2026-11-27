import { expect, test } from 'vitest';
import {
  type AgentProvider,
  type AgentSession,
  type TurnEvent,
} from '../src/index.js';
import { connectProvider, serveProvider } from '../src/bridge/index.js';
import { channels } from './fixtures/memory-channel.js';

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((r) => (release = r));
  return { promise, release };
}
async function setup() {
  const [client, server] = channels();
  const tasks = new Map<string, ReturnType<typeof deferred>>();
  const calls: string[] = [];
  const caps = {
    tools: false,
    approvals: false,
    resume: false,
    fork: 'tip',
  } as const;
  const provider: AgentProvider = {
    async describe() {
      return caps;
    },
    async open(r) {
      return makeSession(r.branch, null);
    },
    async fork(r) {
      calls.push('fork');
      return makeSession(r.destinationBranch, r.atTurnId);
    },
  };
  function makeSession(branch: string, tip: string | null): AgentSession {
    return {
      binding: { branch, tip },
      capabilities: caps,
      async *prompt(request): AsyncIterable<TurnEvent> {
        const task = deferred();
        tasks.set(branch, task);
        calls.push(request.input);
        yield { type: 'text.delta', text: request.input };
        await task.promise;
        yield { type: 'completed' };
      },
      async cancel() {
        tasks.get(branch)!.release();
      },
      async close() {},
    };
  }
  const service = serveProvider(provider, server);
  const remote = await connectProvider(client, {
    forBranch() {
      throw Error('No history');
    },
  });
  return { tasks, calls, service, remote };
}
const prompt = (session: AgentSession, text: string) =>
  session
    .prompt({ turnId: text, parentTurnId: session.binding.tip, input: text })
    [Symbol.asyncIterator]();
test('control can race completion without interfering with another session', async () => {
  const { service, remote } = await setup();
  try {
    const a = await remote.open({ branch: 'a', start: 'fresh' }),
      b = await remote.open({ branch: 'b', start: 'fresh' });
    const x = prompt(a, 'X'),
      y = prompt(b, 'Y');
    expect(
      (await Promise.all([x.next(), y.next()])).map((v) => v.value.text),
    ).toEqual(['X', 'Y']);
    await a.cancel('X');
    expect((await x.next()).value.type).toBe('completed');
    // Begin the next turn before finishing iteration over the old terminal.
    const next = prompt(a, 'Z');
    expect((await next.next()).value.text).toBe('Z');
    expect((await x.next()).done).toBe(true);
    await a.cancel('Z');
    await b.cancel('Y');
    expect((await next.next()).value.type).toBe('completed');
    expect((await y.next()).value.type).toBe('completed');
  } finally {
    service.close();
  }
});
test('losing a live connection interrupts the stream without resubmission', async () => {
  const { remote, service, calls, tasks } = await setup();
  const a = await remote.open({ branch: 'a', start: 'fresh' });
  const stream = prompt(a, 'side-effect');
  await stream.next();
  const waiting = stream.next();
  service.close();
  await expect(waiting).rejects.toMatchObject({ code: 'outcome_unknown' });
  expect(calls).toEqual(['side-effect']);
  tasks.get('a')!.release();
});
test('a stale saved tip cannot fork a live tip-only session at a past turn', async () => {
  const { remote, service, calls } = await setup();
  try {
    const a = await remote.open({ branch: 'a', start: 'fresh' });
    const first = prompt(a, 'A');
    await first.next();
    await a.cancel('A');
    await first.next();
    await first.next();
    const saved = a.binding;
    const second = prompt(a, 'B');
    await second.next();
    await a.cancel('B');
    await second.next();
    await second.next();
    await expect(
      remote.fork!({
        sourceBinding: saved,
        atTurnId: 'A',
        destinationBranch: 'child',
      }),
    ).rejects.toMatchObject({ code: 'context_unavailable' });
    expect(calls).not.toContain('fork');
  } finally {
    service.close();
  }
});
