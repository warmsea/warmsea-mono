import { expect, test } from 'vitest';
import {
  AgentProvider,
  AgentSession,
  ProviderError,
  type ContextRecord,
  type ForkRequest,
  type HostServices,
  type OpenSessionRequest,
  type PromptRequest,
  type SessionBinding,
  type TurnEvent,
} from '../src/index.js';
import { connectProvider, serveProvider } from '../src/bridge/index.js';
import { channels } from './fixtures/memory-channel.js';

const capabilities = {
  tools: false,
  approvals: false,
  resume: false,
  fork: 'history',
} as const;
class HistoryProvider extends AgentProvider {
  constructor(readonly host: HostServices) {
    super();
  }
  async describe() {
    return capabilities;
  }
  async open(request: OpenSessionRequest) {
    if (request.start !== 'fresh')
      throw new ProviderError('unsupported', 'Cannot restore');
    return this.session({ branch: request.branch, tip: null });
  }
  async fork(request: ForkRequest) {
    return this.session({
      branch: request.destinationBranch,
      tip: request.atTurnId,
    });
  }
  private session(binding: SessionBinding) {
    const history = this.host.forBranch(binding.branch);
    return new (class extends AgentSession {
      binding = binding;
      capabilities = capabilities;
      async *prompt(req: PromptRequest): AsyncIterable<TurnEvent> {
        if (req.parentTurnId !== this.binding.tip)
          throw new ProviderError('conflict', 'Stale parent');
        const records = await history.readThrough(req.parentTurnId);
        yield {
          type: 'text.delta',
          text: [...records.map((r) => r.input), req.input].join(' '),
        };
        this.binding = { ...this.binding, tip: req.turnId };
        yield { type: 'completed' };
      }
      async cancel() {}
      async close() {}
    })();
  }
}

test.each(['direct', 'bridged'])(
  '%s adapter receives only the selected prefix and the original can continue',
  async (mode) => {
    const paths = new Map<string, ContextRecord[]>([['original', []]]);
    const host: HostServices = {
      forBranch: (branch) => ({
        async readThrough(tip) {
          const path = paths.get(branch)!;
          expect(path.at(-1)?.turnId ?? null).toBe(tip);
          return path;
        },
      }),
    };
    const [client, server] = channels();
    const service = serveProvider((h) => new HistoryProvider(h), server);
    try {
      const provider =
        mode === 'direct'
          ? new HistoryProvider(host)
          : await connectProvider(client, host);
      const original = await provider.open({
        branch: 'original',
        start: 'fresh',
      });
      async function run(s: AgentSession, turnId: string) {
        let output = '';
        for await (const e of s.prompt({
          turnId,
          parentTurnId: s.binding.tip,
          input: turnId,
        })) {
          if (e.type === 'text.delta') output += e.text;
        }
        paths.get(s.binding.branch)!.push({ turnId, input: turnId, output });
        return output;
      }
      await run(original, 'A');
      await run(original, 'B');
      await run(original, 'C');
      paths.set('child', paths.get('original')!.slice(0, 2));
      const child = await provider.fork!({
        sourceBinding: original.binding,
        atTurnId: 'B',
        destinationBranch: 'child',
      });
      expect(await run(child, 'D')).toBe('A B D');
      expect(await run(original, 'E')).toBe('A B C E');
      await expect(
        provider.open({
          start: 'resume',
          branch: 'restored',
          tip: 'E',
          resumeToken: 'invalid',
        }),
      ).rejects.toMatchObject({ code: 'unsupported' });
      await child.close();
      await original.close();
    } finally {
      service.close();
    }
  },
);
