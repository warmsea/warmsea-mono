# @warmsea/octo-agent-sdk

Implement one `AgentProvider` per configured integration and one `AgentSession` per writable conversation branch. Import the ESM classes, payload types, Zod `schemas`, `parse`, `parseTurnEvent`, and `ProviderError` from the package root. The root does not import transport code. The public JSON Schema 2020-12 document at `@warmsea/octo-agent-sdk/schemas/octo.agent.v1.json` describes payloads by `$defs` name. The bridge negotiates the protocol ID `octo.agent/v1`, independent of the npm package version.

`describe()` advertises configuration capabilities; `open` returns a session with its actual capabilities. Fresh sessions start at an empty root. A failed `resume` must never silently start fresh. `session.prompt({ turnId, parentTurnId, input })` streams zero or more updates and one terminal event. `cancel` acknowledges a request, not a result. `decide` routes an advertised choice to a particular pending request. Host policy, conversation-wide admission, durable approvals, replay and idempotency are not implemented by the SDK.

Forking creates **independent** context from a historical prefix. History-based implementations ask `host.forBranch(branch).readThrough(parentTurnId)` and append the new input once. Stateful providers may fork only at supported positions; never feed a sibling's later turns to the model. `resumeToken` restores the current binding; `checkpoint` names a historical fork point. Neither is a permission. Agents may have changed external state; rewind does not undo it. The host must scope bindings and persisted tokens to the selected provider configuration. If a turn outcome is unknown, retain the transcript and reconcile or reconstruct before continuing; do not automatically resubmit.

## Optional bridge

```ts
import { serveProvider, connectProvider } from '@warmsea/octo-agent-sdk/bridge';

// Adapter endpoint. Supply a provider directly when it needs no history.
const server = serveProvider((host) => new MyProvider(host), adapterChannel);
// Host endpoint.
const remote = await connectProvider(hostChannel, hostServices);
const session = await remote.open({ start: 'fresh', branch: 'main' });
// Use session exactly as a direct adapter, then release it.
await session.close();
remote.disconnect();
server.close();
```

Supply an ordered duplex `MessageChannel`: `send(string)` resolves when accepted, `subscribe(receive)` returns an unsubscribe function, `signal` aborts on either endpoint closing, and `close()` closes the connection. The protocol exchanges JSON-RPC 2.0 text frames (no batches): `initialize`, `describe`, `open`, `fork`, `prompt`, `decide`, `cancel`, `close`, reverse `history.read`, and nonterminal `turn.event` notifications. The prompt response carries the terminal event. A session handle exists only on its own connection. Approvals and cancellation can proceed while the prompt awaits its result. Connection loss yields uncertain execution, not cancellation. A connection to a native adapter is not a sandbox.

## Development

The adapter-side bridge uses Node's `AsyncLocalStorage` (also available in the pinned Bun runtime) to bind reverse history reads to the calling turn. A `history.read` frame names an active session handle, turn ID and parent; the host resolves the branch, never the adapter. This is routing isolation within a trusted connection, not process sandboxing. The optional second `prompt` argument is a connection-loss `AbortSignal`: an adapter awaiting approval must use it to release local waiters. It is **not** a decision to approve, an upstream cancellation, or proof of termination.

Follow the root README's pinned Node and Bun setup. From this package, `bun run build` builds the public JS, declarations, and schema; then `bun examples/text-provider.ts` runs an offline echo session. With Bun not on PATH, prefix commands with `npm exec --yes --package=bun@1.4.3 --` (use the documented Node override if needed).

`bun run check:local contract.test.ts provider.test.ts bridge.test.ts` is the focused edit loop. `bun run check:integration` also exercises a packed consumer using the system `tar` executable and pinned Node. No provider credentials, child-process transports, or network services are required. A public contract change requires the root L3 `bun run check:ci`.
