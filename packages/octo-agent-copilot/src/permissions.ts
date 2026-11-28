import { randomUUID } from 'node:crypto';
import type {
  RequestPermissionRequest,
  RequestPermissionResponse,
} from '@agentclientprotocol/sdk';
import {
  ProviderError,
  type ApprovalDecision,
  type TurnEvent,
} from '@warmsea/octo-agent-sdk';

export class Permissions {
  private tools = new Map<string, RequestPermissionRequest['toolCall']>();
  observe(tool: RequestPermissionRequest['toolCall']) {
    if (!this.tools.has(tool.toolCallId) && this.tools.size >= 256)
      this.tools.delete(this.tools.keys().next().value!);
    this.tools.set(tool.toolCallId, {
      ...this.tools.get(tool.toolCallId),
      ...tool,
    });
  }
  private requests = new Map<
    string,
    {
      options: Map<string, string>;
      answer?: string;
      resolve: (r: RequestPermissionResponse) => void;
    }
  >();
  request(
    p: RequestPermissionRequest,
    emit: (e: TurnEvent) => void,
  ): Promise<RequestPermissionResponse> {
    const options = new Map(
      p.options.map((o) => [`${o.name} [${o.kind}]`, o.optionId]),
    );
    const tool = { ...this.tools.get(p.toolCall.toolCallId), ...p.toolCall };
    const details = JSON.stringify({
      input: tool.rawInput ?? undefined,
      locations: tool.locations?.length ? tool.locations : undefined,
      content: tool.content?.length ? tool.content : undefined,
    });
    if (
      details === '{}' ||
      details.length > 16384 ||
      !options.size ||
      options.size !== p.options.length ||
      new Set(options.values()).size !== options.size ||
      this.requests.size >= 256
    )
      return Promise.resolve({ outcome: { outcome: 'cancelled' } });
    const requestId = randomUUID();
    return new Promise((resolve) => {
      this.requests.set(requestId, { options, resolve });
      emit({
        type: 'approval.requested',
        requestId,
        action: `${tool.title || tool.toolCallId}: ${details}`,
        choices: [...options.keys()],
      });
    });
  }
  decide(d: ApprovalDecision) {
    const r = this.requests.get(d.requestId),
      optionId = r?.options.get(d.choice);
    if (!r || !optionId || (r.answer !== undefined && r.answer !== d.choice))
      throw new ProviderError('conflict', 'Invalid or stale approval');
    if (r.answer === undefined) {
      r.answer = d.choice;
      r.resolve({ outcome: { outcome: 'selected', optionId } });
    }
  }
  clear() {
    this.tools.clear();
    for (const r of this.requests.values())
      if (r.answer === undefined)
        r.resolve({ outcome: { outcome: 'cancelled' } });
    this.requests.clear();
  }
}
