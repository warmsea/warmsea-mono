import * as acp from '@agentclientprotocol/sdk';
import {
  ProviderError,
  type AgentSession,
  type SessionBinding,
  type ApprovalDecision,
  type PromptRequest,
  type TurnEvent,
} from '@warmsea/octo-agent-sdk';
import {
  connect,
  safeError,
  type CopilotOptions,
  type Launch,
} from './cli-connection.js';
import { Permissions } from './permissions.js';
export const capabilities = Object.freeze({
  tools: true,
  approvals: true,
  resume: false,
  fork: 'none',
} as const);
type Connection = Awaited<ReturnType<typeof connect>>;
type Terminal = Extract<
  TurnEvent,
  { type: 'failed' | 'cancelled' | 'completed' }
>;

class Turn {
  readonly permissions = new Permissions();
  readonly events: TurnEvent[] = [];
  terminal?: Terminal;
  cancelling = false;
  cancelDeadline?: ReturnType<typeof setTimeout>;
  wake?: () => void;
  constructor(readonly id: string) {}
  emit = (e: TurnEvent) => {
    if (this.terminal) return;
    if (this.events.length >= 256) {
      this.finish({
        type: 'failed',
        error: {
          code: 'outcome_unknown',
          message: 'Copilot event buffer exceeded',
        },
      });
      return;
    }
    this.events.push(e);
    this.wake?.();
  };
  finish(e: Terminal) {
    if (this.terminal) return;
    clearTimeout(this.cancelDeadline);
    this.terminal = e;
    this.permissions.clear();
    this.wake?.();
  }
}

export async function openCopilotSession(
  branch: string,
  options: CopilotOptions,
  launch?: Launch,
): Promise<AgentSession> {
  const active: { session?: CopilotSession } = {};
  const app = acp
    .client()
    .onNotification('session/update', ({ params }) =>
      active.session?.update(params),
    )
    .onRequest(
      'session/request_permission',
      ({ params }) =>
        active.session?.permission(params) ?? {
          outcome: { outcome: 'cancelled' },
        },
    );
  const connection = await connect(options, app, launch);
  active.session = new CopilotSession(branch, connection);
  return active.session;
}
class CopilotSession implements AgentSession {
  binding: SessionBinding;
  readonly capabilities = capabilities;
  private turn?: Turn;
  private closed = false;
  constructor(
    branch: string,
    private connection: Connection,
  ) {
    this.binding = { branch, tip: null };
  }
  update(p: acp.SessionNotification) {
    const turn = this.turn;
    if (p.sessionId !== this.connection.id || !turn || turn.terminal) return;
    const u = p.update;
    if (u.sessionUpdate === 'agent_message_chunk') {
      if (u.content.type !== 'text') {
        turn.finish({
          type: 'failed',
          error: {
            code: 'unsupported',
            message: 'Unsupported assistant content',
          },
        });
        return;
      }
      turn.emit({ type: 'text.delta', text: u.content.text });
    } else if (
      u.sessionUpdate === 'tool_call' ||
      u.sessionUpdate === 'tool_call_update'
    ) {
      turn.permissions.observe(u);
      turn.emit({
        type: 'tool.updated',
        toolId: u.toolCallId,
        description: [u.title || u.toolCallId, u.status]
          .filter(Boolean)
          .join(': '),
      });
    }
  }
  permission(
    p: acp.RequestPermissionRequest,
  ): Promise<acp.RequestPermissionResponse> | acp.RequestPermissionResponse {
    const t = this.turn;
    if (!t || t.terminal || t.cancelling || p.sessionId !== this.connection.id)
      return { outcome: { outcome: 'cancelled' } };
    return t.permissions.request(p, t.emit);
  }
  async decide(d: ApprovalDecision) {
    if (
      !this.turn ||
      this.turn.terminal ||
      this.turn.cancelling ||
      this.turn.id !== d.turnId
    )
      throw new ProviderError('conflict', 'No matching approval');
    this.turn.permissions.decide(d);
  }
  async cancel(turnId: string) {
    const t = this.turn;
    if (!t || t.id !== turnId || t.terminal)
      throw new ProviderError('conflict', 'No matching active turn');
    if (t.cancelling) return;
    t.cancelling = true;
    t.permissions.clear();
    t.cancelDeadline = setTimeout(
      () =>
        t.finish({
          type: 'failed',
          error: {
            code: 'outcome_unknown',
            message: 'Copilot did not confirm the cancellation outcome',
          },
        }),
      2000,
    );
    try {
      await this.connection.rpc.agent.notify('session/cancel', {
        sessionId: this.connection.id,
      });
    } catch (e) {
      const error = safeError(e, true);
      t.finish({
        type: 'failed',
        error: { code: error.code, message: error.message },
      });
      throw error;
    }
  }
  async *prompt(
    req: PromptRequest,
    loss?: AbortSignal,
  ): AsyncIterable<TurnEvent> {
    if (this.closed || this.connection.rpc.signal.aborted)
      throw new ProviderError('context_unavailable', 'Copilot session closed');
    if (this.turn || req.parentTurnId !== this.binding.tip)
      throw new ProviderError('conflict', 'Active turn or stale branch tip');
    if (loss?.aborted)
      throw new ProviderError('context_unavailable', 'Octo connection closed');
    const t = new Turn(req.turnId);
    this.turn = t;
    const lost = () =>
      t.finish({
        type: 'failed',
        error: {
          code: 'outcome_unknown',
          message: 'Octo connection lost; upstream outcome unknown',
        },
      });
    loss?.addEventListener('abort', lost, { once: true });
    void this.connection.rpc.agent
      .request('session/prompt', {
        sessionId: this.connection.id,
        prompt: [{ type: 'text', text: req.input }],
      })
      .then(
        (response) => {
          const stopReason = response?.stopReason;
          if (stopReason === 'end_turn') t.finish({ type: 'completed' });
          else if (stopReason === 'cancelled') t.finish({ type: 'cancelled' });
          else if (
            stopReason === 'max_tokens' ||
            stopReason === 'max_turn_requests' ||
            stopReason === 'refusal'
          )
            t.finish({
              type: 'failed',
              error: {
                code: 'upstream_failure',
                message: `Copilot stopped: ${stopReason}`,
              },
            });
          else
            t.finish({
              type: 'failed',
              error: {
                code: 'outcome_unknown',
                message: 'Invalid Copilot prompt response',
              },
            });
        },
        (e) => {
          const error = safeError(e, true);
          t.finish({
            type: 'failed',
            error: { code: error.code, message: error.message },
          });
        },
      );
    let settled = false;
    try {
      for (;;) {
        const e = t.events.shift();
        if (e) {
          yield e;
          continue;
        }
        if (t.terminal) break;
        await new Promise<void>((resolve) => {
          t.wake = resolve;
        });
      }
      if (t.terminal.type === 'completed')
        this.binding = { branch: this.binding.branch, tip: req.turnId };
      else await this.close();
      this.turn = undefined;
      settled = true;
      yield t.terminal;
    } finally {
      loss?.removeEventListener('abort', lost);
      t.permissions.clear();
      if (!settled) {
        this.turn = undefined;
        await this.close();
      }
    }
  }
  async close() {
    this.closed = true;
    this.turn?.finish({
      type: 'failed',
      error: { code: 'outcome_unknown', message: 'Session closed during turn' },
    });
    await this.connection.close();
  }
}
