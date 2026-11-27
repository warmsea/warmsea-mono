import { z } from 'zod';

export const protocol = 'octo.agent/v1';
export const id = z.string().min(1);
const position = id.nullable();
const capabilities = z.object({
  tools: z.boolean(),
  approvals: z.boolean(),
  resume: z.boolean(),
  fork: z.enum(['none', 'tip', 'checkpoint', 'history']),
});
const binding = z.object({
  branch: id,
  tip: position,
  resumeToken: id.optional(),
});
const errorCode = z.enum([
  'invalid_request',
  'unsupported',
  'context_unavailable',
  'auth_required',
  'upstream_failure',
  'outcome_unknown',
  'conflict',
  'protocol_error',
]);
const failure = z.object({ code: errorCode, message: z.string() });
const prompt = z.object({
  turnId: id,
  parentTurnId: position,
  input: z.string(),
});
const open = z.discriminatedUnion('start', [
  z.object({ start: z.literal('fresh'), branch: id }),
  z.object({
    start: z.literal('resume'),
    branch: id,
    tip: position,
    resumeToken: id,
  }),
]);
const fork = z.object({
  sourceBinding: binding,
  atTurnId: id,
  destinationBranch: id,
  checkpoint: id.optional(),
});
const decision = z.object({ turnId: id, requestId: id, choice: id });
const events = [
  z.object({ type: z.literal('text.delta'), text: z.string() }),
  z.object({
    type: z.literal('tool.updated'),
    toolId: id,
    description: z.string(),
  }),
  z.object({
    type: z.literal('approval.requested'),
    requestId: id,
    action: id,
    choices: z.array(id).min(1),
  }),
  z.object({
    type: z.literal('completed'),
    resumeToken: id.optional(),
    checkpoint: id.optional(),
  }),
  z.object({ type: z.literal('cancelled') }),
  z.object({ type: z.literal('failed'), error: failure }),
] as const;
const event = z.discriminatedUnion('type', events);
const history = z.object({
  turnId: id,
  input: z.string(),
  output: z.string(),
  providerContext: z.json().optional(),
});
export const schemas = {
  capabilities,
  binding,
  failure,
  open,
  fork,
  prompt,
  decision,
  event,
  history,
};
export type ProviderCapabilities = z.infer<typeof capabilities>;
export type SessionCapabilities = ProviderCapabilities;
export type SessionBinding = z.infer<typeof binding>;
export type OpenSessionRequest = z.infer<typeof open>;
export type ForkRequest = z.infer<typeof fork>;
export type PromptRequest = z.infer<typeof prompt>;
export type ApprovalDecision = z.infer<typeof decision>;
export type TurnEvent = z.infer<typeof event>;
export type ContextRecord = z.infer<typeof history>;
export type TurnId = string;
export type FailureCode = z.infer<typeof errorCode>;

export class ProviderError extends Error {
  readonly code: FailureCode;
  constructor(code: FailureCode, message: string) {
    super(message);
    this.code = code;
  }
}

export function parse<S extends z.ZodType>(
  schema: S,
  value: unknown,
): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const path = result.error.issues[0]?.path.join('.') || '$';
    throw new ProviderError('invalid_request', `Invalid field: ${path}`);
  }
  return result.data;
}
export const parseTurnEvent = (value: unknown): TurnEvent =>
  parse(event, value);
export function isTerminal(
  e: TurnEvent,
): e is Extract<TurnEvent, { type: 'completed' | 'cancelled' | 'failed' }> {
  return (
    e.type === 'completed' || e.type === 'cancelled' || e.type === 'failed'
  );
}
