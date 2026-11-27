import {
  AgentProvider,
  AgentSession,
  ProviderError,
  type OpenSessionRequest,
  type PromptRequest,
  type TurnEvent,
} from '@warmsea/octo-agent-sdk';

const caps = {
  approvals: false,
  tools: false,
  resume: false,
  fork: 'none',
} as const;
class EchoProvider extends AgentProvider {
  async describe() {
    return caps;
  }
  async open(request: OpenSessionRequest) {
    if (request.start !== 'fresh')
      throw new ProviderError('unsupported', 'Cannot restore an echo session');
    return new EchoSession(request.branch);
  }
}
class EchoSession extends AgentSession {
  readonly capabilities = caps;
  binding: { branch: string; tip: string | null };
  private active?: string;
  private cancelled = false;
  private closed = false;
  constructor(branch: string) {
    super();
    this.binding = { branch, tip: null };
  }
  async *prompt(request: PromptRequest): AsyncIterable<TurnEvent> {
    if (this.closed || this.active || this.binding.tip !== request.parentTurnId)
      throw new ProviderError(
        'conflict',
        'Session not available at this position',
      );
    this.active = request.turnId;
    try {
      yield { type: 'text.delta', text: request.input };
      if (this.cancelled) {
        yield { type: 'cancelled' };
        return;
      }
      this.binding = { ...this.binding, tip: request.turnId };
      yield { type: 'completed' };
    } finally {
      this.active = undefined;
      this.cancelled = false;
    }
  }
  async cancel(turnId: string) {
    if (this.active !== turnId)
      throw new ProviderError('conflict', 'No matching turn');
    this.cancelled = true;
  }
  async close() {
    if (this.active) throw new ProviderError('conflict', 'Turn in progress');
    this.closed = true;
  }
}
const session = await new EchoProvider().open({
  branch: 'main',
  start: 'fresh',
});
for await (const event of session.prompt({
  turnId: 'first',
  parentTurnId: null,
  input: 'Hello',
})) {
  console.log(event);
}
await session.close();
