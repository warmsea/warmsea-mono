import type {
  ApprovalDecision,
  PromptRequest,
  SessionBinding,
  SessionCapabilities,
  TurnEvent,
  TurnId,
} from './contract.js';
export abstract class AgentSession {
  abstract readonly binding: SessionBinding;
  abstract readonly capabilities: SessionCapabilities;
  abstract prompt(
    request: PromptRequest,
    connectionLoss?: AbortSignal,
  ): AsyncIterable<TurnEvent>;
  abstract cancel(turnId: TurnId): Promise<void>;
  decide?(decision: ApprovalDecision): Promise<void>;
  abstract close(): Promise<void>;
}
