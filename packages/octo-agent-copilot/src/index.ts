import {
  ProviderError,
  type AgentProvider,
  type OpenSessionRequest,
} from '@warmsea/octo-agent-sdk';
import { validate, type CopilotOptions } from './cli-connection.js';
import { capabilities, openCopilotSession } from './copilot-agent-session.js';
export type { CopilotOptions } from './cli-connection.js';

export class CopilotAgentProvider implements AgentProvider {
  private readonly options: CopilotOptions;
  constructor(options: CopilotOptions) {
    validate(options);
    this.options = { ...options };
  }
  async describe() {
    return capabilities;
  }
  async open(request: OpenSessionRequest) {
    if (request.start !== 'fresh')
      throw new ProviderError(
        'unsupported',
        'Copilot adapter cannot restore sessions',
      );
    return openCopilotSession(request.branch, this.options);
  }
}
