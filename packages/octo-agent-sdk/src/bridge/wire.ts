import { z } from 'zod';
import { id, parse, protocol, ProviderError, schemas } from '../contract.js';

/** One reliable, ordered, bidirectional connection. Abort signal fires on either end closing. */
export interface MessageChannel {
  send(frame: string): Promise<void>;
  subscribe(receive: (frame: string) => void): () => void;
  readonly signal: AbortSignal;
  close(): void;
}
export const hello = z.object({ protocol: z.literal(protocol) });
export const descriptor = z.object({
  handle: id,
  binding: schemas.binding,
  capabilities: schemas.capabilities,
});
export const target = z.object({ handle: id });
export const turnTarget = target.extend({ turnId: id });
export const update = turnTarget.extend({ event: schemas.event });
export const historyRequest = turnTarget.extend({
  parentTurnId: id.nullable(),
});
const seq = z.number().int().positive();
const frameSchema = z.union([
  z.strictObject({
    jsonrpc: z.literal('2.0'),
    method: id,
    params: z.json(),
    id: seq.optional(),
  }),
  z.strictObject({ jsonrpc: z.literal('2.0'), result: z.json(), id: seq }),
  z.strictObject({
    jsonrpc: z.literal('2.0'),
    error: z.object({
      code: z.number().int(),
      message: z.string(),
      data: schemas.failure,
    }),
    id: seq,
  }),
]);
type Handler = (
  method: string,
  params: unknown,
  notification: boolean,
) => unknown;
const lost = () =>
  new ProviderError(
    'outcome_unknown',
    'Connection lost; execution outcome unknown',
  );
const limit = 256;

export class Peer {
  private sequence = 0;
  private pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: unknown) => void }
  >();
  private incoming = new Set<number>();
  private unsubscribe: () => void;
  private closed = false;
  constructor(
    private channel: MessageChannel,
    private handle: Handler,
    private cleanup: () => void,
  ) {
    this.unsubscribe = channel.subscribe((frame) => {
      void this.receive(frame).catch(() => this.close());
    });
    channel.signal.addEventListener('abort', this.close, { once: true });
    if (channel.signal.aborted) this.close();
  }
  close = () => {
    if (this.closed) return;
    this.closed = true;
    this.unsubscribe();
    this.channel.signal.removeEventListener('abort', this.close);
    for (const call of this.pending.values()) call.reject(lost());
    this.pending.clear();
    this.channel.close();
    this.cleanup();
  };
  private async send(frame: object) {
    if (this.closed) throw lost();
    try {
      await this.channel.send(JSON.stringify({ jsonrpc: '2.0', ...frame }));
    } catch {
      this.close();
      throw lost();
    }
  }
  request(method: string, params: unknown): Promise<unknown> {
    if (this.closed) return Promise.reject(lost());
    if (this.pending.size >= limit)
      return Promise.reject(
        new ProviderError('conflict', 'Too many pending requests'),
      );
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      void this.send({ id, method, params }).catch(reject);
    });
  }
  notify(method: string, params: unknown) {
    return this.send({ method, params });
  }
  private async receive(raw: string) {
    const frame = parse(frameSchema, JSON.parse(raw));
    if (!('method' in frame)) {
      const call = this.pending.get(frame.id);
      if (!call) throw new Error('Unknown response');
      this.pending.delete(frame.id);
      if ('error' in frame)
        call.reject(
          new ProviderError(frame.error.data.code, frame.error.data.message),
        );
      else call.resolve(frame.result);
      return;
    }
    const { method, params, id } = frame;
    if (id === undefined) {
      await this.handle(method, params, true);
      return;
    }
    if (this.incoming.has(id) || this.incoming.size >= limit)
      throw new Error('Invalid request sequence');
    this.incoming.add(id);
    try {
      const result = await this.handle(method, params, false);
      await this.send({ id, result: result ?? null });
    } catch (error) {
      const code =
        error instanceof ProviderError ? error.code : 'upstream_failure';
      // Adapter exceptions can contain credentials or raw vendor payloads.
      await this.send({
        id,
        error: { code: -32000, message: code, data: { code, message: code } },
      });
    } finally {
      this.incoming.delete(id);
    }
  }
}
