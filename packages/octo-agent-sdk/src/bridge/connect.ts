import { z } from 'zod';
import {
  AgentProvider,
  AgentSession,
  isTerminal,
  parse,
  protocol,
  ProviderError,
  schemas,
  type HostServices,
  type SessionCapabilities,
  type TurnEvent,
  type PromptRequest,
  type OpenSessionRequest,
  type ForkRequest,
  type ApprovalDecision,
} from '../index.js';
import {
  Peer,
  descriptor,
  hello,
  historyRequest,
  update,
  type MessageChannel,
} from './wire.js';

class Stream {
  readonly buffer: TurnEvent[] = [];
  wake?: () => void;
  failure?: Error;
  detached = false;
  push(event: TurnEvent) {
    if (this.detached) return;
    if (this.buffer.length >= 256)
      throw new ProviderError('protocol_error', 'Event buffer exceeded');
    this.buffer.push(event);
    this.wake?.();
  }
  fail(err: Error) {
    this.failure = err;
    this.wake?.();
  }
  async *read() {
    while (!this.failure) {
      const e = this.buffer.shift();
      if (e) {
        yield e;
        if (isTerminal(e)) return;
      } else
        await new Promise<void>((resolve) => {
          this.wake = resolve;
        });
    }
    throw this.failure;
  }
}
type Active = {
  request: PromptRequest;
  stream: Stream;
  branch: string;
  capabilities: SessionCapabilities;
};
function invalid(): never {
  throw new ProviderError('protocol_error', 'Invalid provider response');
}
export interface ConnectedProvider extends AgentProvider {
  disconnect(): void;
}

export async function connectProvider(
  channel: MessageChannel,
  host: HostServices,
): Promise<ConnectedProvider> {
  const active = new Map<string, Active>();
  const branches = new Map<string, string>();
  const peer = new Peer(
    channel,
    async (method, params, notification) => {
      if (method === 'history.read' && !notification) {
        const { handle, turnId, parentTurnId } = parse(historyRequest, params);
        const turn = active.get(handle);
        if (
          !turn ||
          turn.request.turnId !== turnId ||
          turn.request.parentTurnId !== parentTurnId
        )
          throw new ProviderError(
            'context_unavailable',
            'Outside active branch context',
          );
        return parse(
          z.array(schemas.history),
          await host.forBranch(turn.branch).readThrough(parentTurnId),
        );
      }
      if (method !== 'turn.event' || !notification) invalid();
      const { handle, turnId, event } = parse(update, params);
      const turn = active.get(handle);
      if (
        !turn ||
        turn.request.turnId !== turnId ||
        isTerminal(event) ||
        (event.type === 'approval.requested' && !turn.capabilities.approvals) ||
        (event.type === 'tool.updated' && !turn.capabilities.tools)
      )
        invalid();
      turn.stream.push(event);
    },
    () => {
      branches.clear();
    },
  );
  async function proxy(raw: unknown, branch: string, tip: string | null) {
    const { handle, binding, capabilities } = parse(descriptor, raw);
    if (
      binding.branch !== branch ||
      binding.tip !== tip ||
      branches.has(branch) ||
      [...branches.values()].includes(handle)
    )
      invalid();
    branches.set(branch, handle);
    let aligned = true;
    function live() {
      if (branches.get(branch) !== handle)
        throw new ProviderError('context_unavailable', 'Session closed');
    }
    return new (class extends AgentSession {
      binding = binding;
      capabilities = capabilities;
      async *prompt(value: PromptRequest): AsyncIterable<TurnEvent> {
        live();
        const request = parse(schemas.prompt, value);
        if (
          !aligned ||
          active.has(handle) ||
          request.parentTurnId !== this.binding.tip
        )
          throw new ProviderError('conflict', 'Session tip not available');
        const stream = new Stream();
        active.set(handle, { request, stream, branch, capabilities });
        void peer
          .request('prompt', { handle, request })
          .then((raw) => {
            const event = parse(schemas.event, raw);
            if (!isTerminal(event)) invalid();
            if (event.type === 'completed') {
              this.binding = {
                ...this.binding,
                tip: request.turnId,
                ...(event.resumeToken
                  ? { resumeToken: event.resumeToken }
                  : {}),
              };
            } else aligned = false;
            stream.push(event);
          })
          .catch((e: Error) => {
            aligned = false;
            stream.fail(e);
          })
          .finally(() => {
            if (active.get(handle)?.stream === stream) active.delete(handle);
          });
        try {
          yield* stream.read();
        } finally {
          // Stopping iteration is not a cancellation and must not close sibling sessions.
          stream.detached = true;
          stream.buffer.length = 0;
        }
      }
      async cancel(turnId: string) {
        live();
        parse(z.null(), await peer.request('cancel', { handle, turnId }));
      }
      decide = capabilities.approvals
        ? async (d: ApprovalDecision) => {
            live();
            parse(
              z.null(),
              await peer.request('decide', {
                handle,
                decision: parse(schemas.decision, d),
              }),
            );
          }
        : undefined;
      async close() {
        live();
        parse(z.null(), await peer.request('close', { handle }));
        branches.delete(branch);
      }
    })();
  }
  try {
    parse(hello, await peer.request('initialize', { protocol }));
    return new (class extends AgentProvider implements ConnectedProvider {
      disconnect = peer.close;
      async describe() {
        return parse(schemas.capabilities, await peer.request('describe', {}));
      }
      async open(value: OpenSessionRequest) {
        const request = parse(schemas.open, value);
        return proxy(
          await peer.request('open', request),
          request.branch,
          request.start === 'fresh' ? null : request.tip,
        );
      }
      async fork(value: ForkRequest) {
        const request = parse(schemas.fork, value);
        return proxy(
          await peer.request('fork', request),
          request.destinationBranch,
          request.atTurnId,
        );
      }
    })();
  } catch (error) {
    peer.close();
    throw error;
  }
}
