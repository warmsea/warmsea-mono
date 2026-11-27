import { test, expect } from 'vitest';
import {
  AgentProvider,
  AgentSession,
  type ApprovalDecision,
  type OpenSessionRequest,
  type PromptRequest,
  type TurnEvent,
} from '../src/index.js';
import { connectProvider, serveProvider } from '../src/bridge/index.js';
import { channels } from './fixtures/memory-channel.js';

test('negotiates octo.agent/v1 with a peer using the public wire identifier', async () => {
  const [client, server] = channels();
  server.subscribe((frame) => {
    const request = JSON.parse(frame);
    expect(request.params.protocol).toBe('octo.agent/v1');
    void server.send(
      JSON.stringify({
        jsonrpc: '2.0',
        id: request.id,
        result: { protocol: 'octo.agent/v1' },
      }),
    );
  });
  const provider = await connectProvider(client, {
    forBranch() {
      throw new Error('No session opened');
    },
  });
  provider.disconnect();
});

test('approves a streaming turn without blocking control or exposing sibling history', async () => {
  const [client, server] = channels();
  const caps = {
    tools: false,
    approvals: true,
    resume: false,
    fork: 'none',
  } as const;
  const reads: string[] = [];
  const decisions: ApprovalDecision[] = [];
  let finish!: () => void;
  const service = serveProvider(
    (host) =>
      new (class extends AgentProvider {
        async describe() {
          return caps;
        }
        async open(r: OpenSessionRequest) {
          return new (class extends AgentSession {
            binding = { branch: r.branch, tip: null };
            capabilities = caps;
            async *prompt(req: PromptRequest): AsyncIterable<TurnEvent> {
              await host.forBranch(r.branch).readThrough(req.parentTurnId);
              await expect(
                host.forBranch('sibling').readThrough(req.parentTurnId),
              ).rejects.toThrow();
              const wait = new Promise<void>((resolve) => (finish = resolve));
              yield {
                type: 'approval.requested',
                requestId: 'approval',
                action: 'Read file',
                choices: ['allow', 'deny'],
              };
              await wait;
              yield { type: 'completed' };
            }
            async decide(d: ApprovalDecision) {
              decisions.push(d);
            }
            async cancel() {}
            async close() {}
          })();
        }
      })(),
    server,
  );
  const provider = await connectProvider(client, {
    forBranch: (branch) => ({
      async readThrough() {
        reads.push(branch);
        return [];
      },
    }),
  });
  const session = await provider.open({ start: 'fresh', branch: 'selected' });
  const stream = session
    .prompt({ turnId: 't', parentTurnId: null, input: 'hi' })
    [Symbol.asyncIterator]();
  expect((await stream.next()).value.type).toBe('approval.requested');
  await expect(
    session.decide!({ turnId: 't', requestId: 'wrong', choice: 'allow' }),
  ).rejects.toThrow();
  await session.decide!({
    turnId: 't',
    requestId: 'approval',
    choice: 'allow',
  });
  await session.decide!({
    turnId: 't',
    requestId: 'approval',
    choice: 'allow',
  });
  await expect(
    session.decide!({ turnId: 't', requestId: 'approval', choice: 'deny' }),
  ).rejects.toMatchObject({ code: 'conflict' });
  expect(decisions).toHaveLength(1);
  finish();
  expect((await stream.next()).value.type).toBe('completed');
  expect((await stream.next()).done).toBe(true);
  expect(reads).toEqual(['selected']);
  expect(session.binding.tip).toBe('t');
  await session.close();
  service.close();
});
