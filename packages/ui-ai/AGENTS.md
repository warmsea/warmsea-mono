# AI UI package guide

- Read [README.md](README.md) and the colocated
  [ChatInput MDX contract](src/components/chat-input/ChatInput.mdx) before editing.
  This guide is source-only; README's source-hosted links also serve extracted packages.
- Own reusable prompt input interactions, not chat sessions, models, attachments,
  request admission, retry, or draft persistence. ChatInput is the only
  approved first-release component.
- Use public ui-vue and ui-tokens exports. Vue is a peer and all three packages
  remain external to the JavaScript build. Never import backend runtimes or app code.
- ui-vue and ui-tokens must never depend on ui-ai, including transitively or
  through development tools, examples and documentation.
- Keep string models controlled. Never trim, submit to a network, or clear them.
  Consumers own eligibility, attachment processing and conditional clearing.
- Share submission guards across button, form and Enter; preserve IME,
  Shift+Enter, readonly and disabled-fieldset behavior.
- Use embedded Textarea and native Button. Preserve their editing/control states,
  description merging and visible focus. Slot owners must honor exposed state.
- Keep public props/types, implementation, unit tests, MDX and stories colocated.
  Use wui-* classes and existing tokens; no new global theme or UI runtime.
- Own configuration and test servers here. Keep reports and caches in .artifacts;
  automated servers own OS-assigned loopback ports and never reuse services.
  Follow README's artifact retention and exact per-run cleanup instructions;
  confirm ownership and stopped servers/writers, never remove foreign runs or locks.
- Follow root [setup](../../README.md#setup) and
  [layered verification](../../README.md#layered-verification) for authoritative
  runtime, gate-selection, preparation/freshness and writer-lock policy.
  Use [README's owner loop and coverage](README.md#development-and-acceptance)
  for commands; [preview](README.md#preview-the-examples) is not acceptance.
  Package tests verify built exports, declarations, dependencies and CSS
  without installing consumers.
- Manual screen-reader, touch, zoom and forced-color checks remain separate.
