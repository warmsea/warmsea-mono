# @warmsea/ui-ai

Reusable Vue 3 AI prompt UI, separate from application execution and persistence.
The only first-release component is ChatInput. Its
[colocated Docs](https://github.com/warmsea/warmsea-mono/blob/main/packages/ui-ai/src/components/chat-input/ChatInput.mdx) define the API.
Source-hosted documentation links also work from extracted packages; development
MDX is not included in the archive.

```vue
<script setup lang="ts">
import { ref } from 'vue';
import '@warmsea/ui-tokens/style.css';
import '@warmsea/ui-vue/style.css';
import '@warmsea/ui-ai/style.css';
import { ChatInput } from '@warmsea/ui-ai';
const draft = ref('');
function submit(value: string) {
  console.log(value);
}
</script>
<template>
  <ChatInput
    v-model="draft"
    label="Message"
    submit-label="Send"
    :can-submit="Boolean(draft.trim())"
    keyboard-hint="Enter to send. Shift+Enter for a new line."
    @submit="submit"
  />
</template>
```

Load tokens, ui-vue CSS, ui-ai CSS, then consumer overrides. JavaScript imports
never mutate the document or install a theme. ESM and declarations use public
exports; Vue is a peer and Vue/ui-vue/ui-tokens are external to the build.
Neither base package may depend on ui-ai, even through development dependencies.
No backend runtime, AI SDK, networking, attachment encoding, model selection, session
state, automatic trimming, or draft clearing belongs here.

Consumers own submission eligibility and admission. A successful submit event
does not mean the application accepted it. Clear only after your acknowledgement
and only if the current draft still matches the submitted draft. Slots receive
interaction state; consumers must disable their own attachment/actions controls.

## Development and acceptance

For repository development, read the source-only
[AGENTS guide](https://github.com/warmsea/warmsea-mono/blob/main/packages/ui-ai/AGENTS.md).
The root [setup](https://github.com/warmsea/warmsea-mono/blob/main/README.md#setup)
and [layered verification](https://github.com/warmsea/warmsea-mono/blob/main/README.md#layered-verification)
are authoritative for runtime pins, command prefixes, gate selection and preparation.
These development commands require a repository checkout, not an extracted package.

After setup, the shortest owner loop is to run from `packages\ui-ai`:

```sh
npm exec --yes --package=bun@1.4.3 -- bun run check:local ChatInput.test.ts workflow.test.ts
```

`check:local` checks owner format/lint/types plus selected tests;
`test:focused <file>` checks only those tests. All selectors must match.
Vitest uses jsdom except Node-annotated tooling
tests; controlled state/events/descriptions are unit assertions, not layout,
native focus/keyboard/IME, token resolution or visual evidence.
Then use root `bun run check:affected --base <trusted-ref> --explain` under the
layered policy. Owner `check:integration` adds Chromium to `check:code`, which covers
all units, packed exports/declarations/CSS and static Storybook.
`check` and `check:ci` add Chromium, Firefox and WebKit browser checks.
`ci:setup` prepares browser assets; routine checks need no credentials.
Root policy defines when complete acceptance is required and prohibits duplicate
full-test/full-check runs. Prepared types/tests require fresh invocation evidence;
source/upstream/output changes invalidate the pass, and concurrent builds fail
rather than sharing a writer. Raw `*:implementation` scripts and `build:self`
alone are not acceptance.
No persistent cache, fixture acceleration or browser parallelism is introduced.
Standalone Storybook builds retain their CLI arguments and hold the owner build
lock; run `build` first to prepare public dependencies.

## Preview the examples

Preview is for manual exploration, not acceptance evidence. After repository-root
setup with the pinned runtime, run from `packages\ui-ai`:

```sh
npm exec --yes --package=bun@1.4.3 -- bun run build
npm exec --yes --package=bun@1.4.3 -- bun x --no-install vite --host 127.0.0.1 --port 4175 --strictPort
```

The build prepares the public dependencies and this package. Vite uses the
installed tool, refuses an occupied port, and does not install an example app.
If the active Node differs, use the root's combined Node/Bun prefix.
Open `http://127.0.0.1:4175/` for the demo or
`http://127.0.0.1:4175/?native` for native interaction checks. Native mode supports
`&clear`, `&required`, `&fieldset` (with optional `&legend`), and `&teleport`.
The Teleport example moves the same ChatInput between enabled, disabled and
first-legend destinations. Stop the preview with Ctrl+C; restart it after
rebuilding public dependencies.

`examples/` uses the public built package. Vite's manual cache is in
`.artifacts/vite-cache`; its watcher excludes generated artifacts and builds.
`storybook` owns a separate manual
preview. Automated tests bind OS-assigned loopback ports and never reuse existing
services. Reports, results, Vite cache and static Storybook stay in `.artifacts`.
These retained artifacts have no automatic expiry; they remain until manual
cleanup. Browser runs isolate `report`, `results` and `vite-cache` in
`.artifacts\browser\<run-id>`. To clean one completed run, confirm the exact
`RUN_ID` and server `PID` from your own test-server output, confirm that run and
its server/writers have stopped, then manually remove only that exact run directory.
Never remove another user's run directory or lock. The manual `.artifacts\vite-cache`
and `.artifacts\storybook-static` directories are shared, not per-run cleanup
targets; do not remove them while any preview, build or check could use them.
Do not delete `.artifacts\workflow\build.lock`; its owner releases it.
Packed-artifact checks use installed tools only; they install no consumers and
automatically clean only their own `.artifacts\package\run-*` temporary directory
in their finalizer.
They resolve and consume the actual packed value, type and CSS export targets
from an independent consumer scope, including typed events, slots and focus.
Autosizing browser checks use uncapped drafts to verify width/font growth and
restoration without overflow; separate cases retain parent edits and height caps.

Test keyboard interaction, descriptions, nested token overrides, content growth,
RTL and narrow screens. Manual screen-reader, real touch, forced-color and actual
zoom checks are separate; automated assertions do not prove those experiences.
