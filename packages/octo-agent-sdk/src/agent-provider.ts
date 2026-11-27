import type {
  ForkRequest,
  OpenSessionRequest,
  ProviderCapabilities,
} from './contract.js';
import type { AgentSession } from './agent-session.js';

export abstract class AgentProvider {
  abstract describe(): Promise<ProviderCapabilities>;
  abstract open(request: OpenSessionRequest): Promise<AgentSession>;
  fork?(request: ForkRequest): Promise<AgentSession>;
}
