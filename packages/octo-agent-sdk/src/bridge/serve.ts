import { z } from 'zod';
import { AsyncLocalStorage } from 'node:async_hooks';
import {
  parse,
  protocol,
  ProviderError,
  schemas,
  isTerminal,
  type ApprovalDecision,
  type PromptRequest,
  type AgentProvider,
  type AgentSession,
  type HostServices,
  type SessionBinding,
} from '../index.js';
import {
  Peer,
  descriptor,
  hello,
  target,
  turnTarget,
  type MessageChannel,
} from './wire.js';

function reject(
  code: 'conflict' | 'unsupported' | 'protocol_error' | 'context_unavailable',
): never {
  throw new ProviderError(code, code);
}
type Approval = { choices: string[]; choice?: string; reply?: Promise<void> };
type State = {
  session: AgentSession;
  binding: SessionBinding;
  busy?: PromptRequest;
  approvals: Map<string, Approval>;
  aligned: boolean;
  closing: boolean;
  terminal: boolean;
};

export function serveProvider(
  source: AgentProvider | ((host: HostServices) => AgentProvider),
  channel: MessageChannel,
): { close(): void } {
  const sessions = new Map<string, State>();
  const opening = new Set<string>();
  const callingTurn = new AsyncLocalStorage<{
    handle: string;
    request: PromptRequest;
  }>();
  let ready = false;
  let disposed = false;
  const peer = new Peer(channel, dispatch, () => {
    disposed = true;
    // A lost peer cannot confirm cancellation. Close idle sessions now and active ones on settlement.
    for (const state of sessions.values())
      if (!state.busy && !state.closing)
        void state.session.close().catch(() => {
          console.error(
            `${protocol}: adapter failed to release a disconnected session`,
          );
        });
    sessions.clear();
  });
  const host: HostServices = {
    forBranch: (branch) => ({
      async readThrough(parentTurnId) {
        const caller = callingTurn.getStore();
        const state = caller && sessions.get(caller.handle);
        if (
          !caller ||
          !state ||
          state.binding.branch !== branch ||
          state.busy !== caller.request ||
          state.terminal ||
          parentTurnId !== caller.request.parentTurnId
        )
          reject('context_unavailable');
        return parse(
          z.array(schemas.history),
          await peer.request('history.read', {
            handle: caller.handle,
            turnId: caller.request.turnId,
            parentTurnId,
          }),
        );
      },
    }),
  };
  let provider: AgentProvider;
  try {
    provider = typeof source === 'function' ? source(host) : source;
  } catch (error) {
    peer.close();
    throw error;
  }

  async function register(
    acquire: () => Promise<AgentSession>,
    branch: string,
    tip: string | null,
  ) {
    if (
      opening.has(branch) ||
      [...sessions.values()].some((s) => s.binding.branch === branch)
    )
      reject('conflict');
    opening.add(branch);
    let session: AgentSession | undefined;
    try {
      session = await acquire();
      if ([...sessions.values()].some((s) => s.session === session)) {
        session = undefined;
        reject('conflict');
      }
      const data = parse(descriptor, {
        handle: crypto.randomUUID(),
        binding: session.binding,
        capabilities: session.capabilities,
      });
      if (
        disposed ||
        data.binding.branch !== branch ||
        data.binding.tip !== tip
      )
        reject('context_unavailable');
      sessions.set(data.handle, {
        session,
        binding: data.binding,
        approvals: new Map(),
        aligned: true,
        closing: false,
        terminal: false,
      });
      return data;
    } catch (error) {
      await session?.close();
      throw error;
    } finally {
      opening.delete(branch);
    }
  }
  async function dispatch(
    method: string,
    p: unknown,
    notification: boolean,
  ): Promise<unknown> {
    if (notification) reject('protocol_error');
    if (method === 'initialize') {
      parse(hello, p);
      if (ready) reject('conflict');
      ready = true;
      return { protocol };
    }
    if (!ready) reject('protocol_error');
    if (method === 'describe')
      return parse(schemas.capabilities, await provider.describe());
    if (method === 'open') {
      const r = parse(schemas.open, p);
      if (r.start === 'resume' && !(await provider.describe()).resume)
        reject('unsupported');
      return register(
        () => provider.open(r),
        r.branch,
        r.start === 'fresh' ? null : r.tip,
      );
    }
    if (method === 'fork') {
      const r = parse(schemas.fork, p);
      const source = [...sessions.values()].find(
        (s) => s.binding.branch === r.sourceBinding.branch,
      );
      const mode =
        source?.session.capabilities.fork ?? (await provider.describe()).fork;
      if (!provider.fork || mode === 'none') reject('unsupported');
      if (source && (!source.aligned || source.busy)) reject('conflict');
      if (r.destinationBranch === r.sourceBinding.branch) reject('conflict');
      if (
        (mode === 'tip' &&
          r.atTurnId !== (source ? source.binding.tip : r.sourceBinding.tip)) ||
        (mode === 'checkpoint' && !r.checkpoint)
      )
        reject('context_unavailable');
      return register(() => provider.fork!(r), r.destinationBranch, r.atTurnId);
    }
    const { handle } = parse(target, p);
    const state = sessions.get(handle) ?? reject('context_unavailable');
    const { session } = state;
    if (state.closing) reject('conflict');
    if (method === 'close') {
      if (state.busy) reject('conflict');
      state.closing = true;
      try {
        await session.close();
        sessions.delete(handle);
        return null;
      } finally {
        state.closing = false;
      }
    }
    if (method === 'cancel') {
      const { turnId } = parse(turnTarget, p);
      if (state.terminal || state.busy?.turnId !== turnId) reject('conflict');
      return session.cancel(turnId);
    }
    if (method === 'decide') {
      const { decision } = parse(
        target.extend({ decision: schemas.decision }),
        p,
      );
      return decide(state, decision);
    }
    if (method !== 'prompt') reject('unsupported');
    const { request } = parse(target.extend({ request: schemas.prompt }), p);
    if (
      !state.aligned ||
      state.busy ||
      request.parentTurnId !== state.binding.tip
    )
      reject('conflict');
    state.busy = request;
    state.terminal = false;
    return callingTurn.run({ handle, request }, async () => {
      try {
        for await (const raw of session.prompt(request, channel.signal)) {
          const event = parse(schemas.event, raw);
          if (isTerminal(event)) {
            state.terminal = true;
            state.approvals.clear();
            state.aligned = event.type === 'completed';
            if (event.type === 'completed')
              state.binding = {
                ...state.binding,
                tip: request.turnId,
                ...(event.resumeToken
                  ? { resumeToken: event.resumeToken }
                  : {}),
              };
            return event;
          }
          if (event.type === 'approval.requested') {
            if (
              !session.capabilities.approvals ||
              !session.decide ||
              state.approvals.has(event.requestId)
            )
              reject('protocol_error');
            state.approvals.set(event.requestId, { choices: event.choices });
          }
          if (event.type === 'tool.updated' && !session.capabilities.tools)
            reject('protocol_error');
          await peer.notify('turn.event', {
            handle,
            turnId: request.turnId,
            event,
          });
        }
        reject('protocol_error');
      } catch (error) {
        state.aligned = false;
        throw error;
      } finally {
        state.busy = undefined;
        state.approvals.clear();
        if (disposed) await session.close();
      }
    });
  }
  function decide(state: State, d: ApprovalDecision) {
    if (!state.session.decide || !state.session.capabilities.approvals)
      reject('unsupported');
    const a = state.approvals.get(d.requestId);
    if (
      !a ||
      state.busy?.turnId !== d.turnId ||
      !a.choices.includes(d.choice) ||
      (a.choice !== undefined && a.choice !== d.choice)
    )
      reject('conflict');
    a.choice = d.choice;
    return (a.reply ??= Promise.resolve().then(() => state.session.decide!(d)));
  }
  return { close: peer.close };
}
