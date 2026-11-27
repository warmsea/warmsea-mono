import type { MessageChannel } from '../../src/bridge/index.js';
export function channels(): [MessageChannel, MessageChannel] {
  const controller = new AbortController();
  const make = () => {
    let listener: ((frame: string) => void) | undefined;
    return {
      listen(fn: (frame: string) => void) {
        listener = fn;
        return () => {
          listener = undefined;
        };
      },
      deliver(frame: string) {
        if (!listener) throw Error('not listening');
        listener(frame);
      },
    };
  };
  const a = make(),
    b = make();
  const endpoint = (local: typeof a, remote: typeof a): MessageChannel => ({
    signal: controller.signal,
    subscribe: local.listen,
    async send(frame) {
      controller.signal.throwIfAborted();
      remote.deliver(frame);
    },
    close() {
      controller.abort();
    },
  });
  return [endpoint(a, b), endpoint(b, a)];
}
