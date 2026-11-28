# @warmsea/octo-agent-copilot

Use the installed GitHub Copilot CLI as an `octo.agent/v1` provider. `new CopilotAgentProvider({ cwd, executable? })` requires an authorized absolute working directory; `executable` is an optional trusted absolute native executable path. Construction and `describe()` do not invoke the CLI. Each fresh `open` starts one `copilot --acp --stdio` process. No network listener, CLI installation, hosted model API, or application-owned credentials.

```ts
import { CopilotAgentProvider } from '@warmsea/octo-agent-copilot';
const provider = new CopilotAgentProvider({ cwd: process.cwd() });
// Use directly as an AgentProvider, or pass it to serveProvider(provider, channel).
const session = await provider.open({ branch: 'local', start: 'fresh' });
```

## Identity and trust

Run the Octo server as the OS user who signed in to Copilot CLI, with access to that user's profile and credential store. The child inherits the host environment. The CLI resolves its credentials normally: existing Copilot login, supported environment tokens or `gh` fallback. An environment token or configured alternative model provider can change the effective identity/service; this adapter does not enforce a particular account. Never accept the executable, cwd, environment, or CLI arguments directly from a web client. This is trusted native execution, not a sandbox. Do not launch it from an untrusted `PATH`.

If the host receives `auth_required`, run `copilot login` **on the server as its service user**, then retry. The adapter does not search for, copy, log, or refresh tokens, run `gh auth token`, or start an interactive sign-in. The Octo bridge sanitizes error messages, so a host UI should render that instruction for the error code. Missing executable, ACP incompatibility, policy/permission refusal, and uncertain execution are not reasons to automatically sign in or retry.

## Supported behavior

Text prompts and assistant text chunks, tool activity descriptions, approval choices and cancellation. The ACP session owns context; subsequent turns send only new input. Choices include the exact ACP option kind (e.g. `[allow_once]`); pass the entire advertised choice back to `decide`. Ambiguous choices are not authorized. Do not translate them back into upstream IDs in the host. The CLI executes tools; this adapter offers no ACP filesystem or terminal service and supplies no MCP servers. An agent's own configuration may still permit native actions.

Only `end_turn` is a successful completion. Cancellation, truncation, refusal, unsupported assistant content, and transport loss are not success. Tool status is descriptive; thoughts, plans, usage, slash-command discovery, session metadata and other non-text UI updates are not added to the transcript. The host cannot resume or fork upstream memory with this release. Close an idle session to release its process; interrupted or failed turns invalidate the session. On `outcome_unknown`, do not replay the prompt. Process termination is not proof that external side effects were undone.

## Verification and examples

Follow the root README setup (including the pinned npm exec prefix if Bun is not on PATH). From this workspace, `bun run check:local cli-connection.test.ts session.test.ts bridge.test.ts` uses a real local scripted child over stdin/stdout, never a Copilot account. `bun run check:integration` adds a packed consumer using system `tar`. New public workspaces require root `bun run check:ci`. No API keys or paid provider requests are needed.

After `bun run build`, `bun examples/chat.ts` displays capabilities offline. **Optional live smoke:** from a trusted working directory, invoke the example by absolute path with two quoted prompt arguments. This starts the real CLI, may use quota, and cancels rather than approving tool requests. The target is the stable ACP v1 entry point of `@agentclientprotocol/sdk` 2.8.0; check the installed CLI at runtime via initialization. On Windows the default lookup requires `copilot.exe`; a `.cmd` or `.ps1` wrapper is not executed. On Linux/macOS use an executable `copilot` on an absolute PATH entry. Offline acceptance does not certify a particular installed CLI or credential store.

References: [Copilot ACP server](https://docs.github.com/en/copilot/reference/copilot-cli-reference/acp-server), [CLI authentication](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli).

Verification scope: On Windows, Copilot CLI 1.0.116 completed one live text prompt through the adapter and returned the expected reply without tool activity or an interactive sign-in. This did not establish which credential the CLI used. Linux and macOS execution have not been verified.

Treat approval details as sensitive tool input and show them only to the authorized decision maker. Requests without target details or with oversized details are cancelled rather than presenting an incomplete approval.
