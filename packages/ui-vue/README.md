# @warmsea/ui-vue

Native-first Vue 3 components. Vue `^3.5.0` is a peer dependency; tokens are a
framework-independent package dependency. There are no third-party UI runtime
libraries. M3 is a design reference, and warm ocean teal `#0f766e` is the default
primary. Consumers own their colors.
The packages are not yet published; the imports below describe the built contract.

## Use

```vue
<script setup lang="ts">
import '@warmsea/ui-tokens/style.css';
import '@warmsea/ui-vue/style.css';
import { Button, Heading, Text } from '@warmsea/ui-vue';
</script>

<template>
  <Heading :level="1">Explore the coast</Heading>
  <Text>A quiet place to begin.</Text>
  <Button @click="console.log('Set sail')">Set sail</Button>
  <Button variant="default">Explore</Button>
  <Button variant="outlined" type="submit">Save</Button>
  <Button variant="subtle">Cancel</Button>
</template>
```

Load tokens, component CSS, then consumer overrides. Importing JavaScript never
installs a theme or mutates the document. The library ships ESM, declarations and
CSS, externalizes Vue, and can be imported without browser globals.
Declarations ship without source maps because component sources are not included
in the package. Follow the repository's
[browser support policy][browser-support].

## Public components

The colocated component Docs are authoritative for detailed props, defaults,
events, slots, native behavior, accessibility and examples. They render as
Storybook Docs. The links below address repository-hosted source files; packed
artifacts contain this overview and public declarations, not the development MDX.
Do not maintain another detailed API reference in this README or AGENTS.

| Component Docs            | Main contract                                                                                                                                                     | Public types                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| [AppBar][app-bar-docs]    | Native icon-only navigation rail; required `items` and decorative `icon` slot, optional `bottomItems` and `activeId`; application-owned navigation and selection. | `AppBarProps`, `AppBarItem`        |
| [Button][button-docs]     | Native button; `variant` is `primary` (default), `default`, `outlined` or `subtle`; `type` defaults to `button`.                                                  | `ButtonProps`                      |
| [Heading][heading-docs]   | Required numeric `level` 1-6 chooses the native heading and matching typography.                                                                                  | `HeadingProps`                     |
| [Input][input-docs]       | Required string `v-model`; text, password, email, search, tel or url; optional label, help/error text and clear action.                                           | `InputProps`, `InputType`          |
| [Select][select-docs]     | Native single-choice select; required `options` and string-or-null `v-model`; null/unknown values show a disabled prompt.                                         | `SelectProps`, `SelectOption`      |
| [Text][text-docs]         | `as` is `p` (default) or `span`; `weight` is `regular` (default) or `semibold`.                                                                                   | `TextProps`                        |
| [Tooltip][tooltip-docs]   | Required plain `text` and one enabled focusable trigger; scoped `describedBy`, logical placement and optional description mode.                                   | `TooltipProps`, `TooltipPlacement` |
| [Textarea][textarea-docs] | Controlled string-only multiline native field, descriptions and native form attributes.                                                                           | `TextareaProps`                    |
| [Dialog][dialog-docs]     | Controlled native modal with required title, content/footer slots and focus restoration.                                                                          | `DialogProps`                      |
| [Menu][menu-docs]         | Labelled action popup with keyboard navigation, dismissal and consumer-owned selection.                                                                           | `MenuProps`, `MenuItem`            |

All components and types are named exports from `@warmsea/ui-vue`.
Native attributes/listeners reach each component's native root, except Input and
Textarea route class/style to their field wrappers and other supported native
attributes/listeners to the input or textarea. See the colocated
[Textarea Docs][textarea-docs] for its full contract.
Tooltip's wrapper does not forward attributes to its slotted trigger.
Menu attributes target its wrapper; use its required label and disabled
props for the trigger.
Input and Select are controlled; cancel native form reset and restore their models
in the parent. See their Docs for naming, descriptions and submission contracts.

## Styling and migration

Tokens belong to `@warmsea/ui-tokens`. Read its [public contract][token-docs]
and Storybook [Typography][typography-docs] and
[Customization][customization-docs] for cross-component styling.
The shared font stack uses installed Roboto, then Segoe UI, system-ui and sans-serif;
no font files are bundled or downloaded.

Body text uses `--wui-font-size` and `--wui-line-height`; Button, Input and Select
use independent `-control` roles and `--wui-control-padding-block`.
At a 16px root, bordered one-line controls nominally measure 32px, but content
and native font metrics may grow them. These defaults do not guarantee touch
comfort. Consumers own root font size and scoped overrides, and must validate
contrast in all states after changing colors. No runtime theme manager, automatic
foreground selection or dark theme is provided.

When migrating older consumers:

- Replace local base-only interaction overrides with the complete relevant
  semantic state group from the token contract. Components no longer derive
  hover/active colors from local primary, text or surface changes.
- Replace Button's `filled`/`tonal` variants and corresponding classes with
  `primary`/`default`; the old names are not aliases.
- Remove Button/Text `size` props. Move control-specific size and line-height
  overrides to the control roles; body overrides no longer change controls.
- Replace old control-height scales with content sizing and control padding.

## Develop and verify

Use root [setup][setup] for the pinned runtime and command prefix, and
[layered verification][layered-verification] for gate selection, trusted
baselines, dependency preparation, invalidation and single-writer policy.
This section owns the package-specific commands, coverage and artifact lifecycle.

L1: `bun run check:local Input.test.ts` runs formatting/lint/prepared types and
selected Vitest tests. `test:focused <file> [...]` runs just selected tests; each
selector must match. jsdom covers models/events/description relationships and
logic; native layout/focus/keyboard/IME, computed CSS/token overrides and visual
behavior still require browsers (Node-annotated tool tests remain Node).
L2: root `check:affected --base <trusted-ref> --explain` selects transitive
consumers; this owner's `check:integration` retains complete code/package/static
Storybook checks, Chromium interactions and Storybook Playwright assertions.
L3 `check`/platform-aware `check:ci` run the value-stratified browser matrix below,
Windows visuals and representative Storybook integrations.
Raw implementation scripts/build:self alone are not acceptance. Storybook build
and static-output test commands share `.artifacts/workflow/build.lock`;
do not remove a competing writer's lock. No fixture acceleration or increased
browser parallelization is added.
Prepare public dependencies with `build` before standalone Storybook work.
`build:storybook` produces the public site in `storybook-static`.
`build:storybook:test` produces the public site plus private contract fixtures in
`.artifacts/storybook/static`. Rebuild it after source changes before focused
browser checks: an existing index does not prove artifact freshness.
Full gates build this test superset once, then `test:browsers` runs the two native
Playwright configurations sequentially against one owned static server.
Complete Vitest checks use its configured include patterns without file filters,
including documentation command/token regressions. L1 inventory includes those files.
Prefer guarded `test:focused`/`check:local` when npm itself uses another Node.
For a raw Vitest invocation, use the pinned Node executable directly:
`node node_modules\vitest\vitest.mjs run <file>` with the root runtime prefix.

Install at the repository root using its [setup instructions][setup].
Use the root's pinned `npm exec` prefix if Bun is not on PATH. Run the following
from this directory. Choose the path matching your task; these are alternatives,
not one command sequence.

**Complete owner acceptance:** run one gate, without a separate full test/build
first. Run `bun run ci:setup` only if required browser assets/system dependencies
are absent; it is preparation, not an extra acceptance gate.

```sh
bun run check
```

**Focused L1 edit loop:** choose matching unit-test selectors, not the full gate.

```sh
bun run check:local Input.test.ts AppBar.test.ts
```

For tests alone, `bun run test:focused Input.test.ts AppBar.test.ts` omits the
other L1 checks. `bun run typecheck` and `bun run test` are standalone types and
complete unit checks, not prerequisites to `check`.

**Manual Storybook preview:** after preparing public dependencies with `build`,
start the long-running development server. `bun run dev` is an alternative
alias, not a second server command. Stop your server with Ctrl+C when finished;
automated checks neither need nor reuse it.

```sh
bun run storybook
```

| Command        | Coverage                                                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `check:code`   | Formatting, lint, types, unit tests, dependency/library builds, packed-artifact checks and static Storybook build.                                                             |
| `check`        | Code acceptance, browser/visual checks and Storybook verification.                                                                                                             |
| `check:ci`     | Full Windows acceptance; Linux functional acceptance without Windows-only visual snapshots.                                                                                    |
| `ci:setup`     | Installs Playwright Chromium, Firefox and WebKit and their system dependencies.                                                                                                |
| `test:package` | Actual tarballs, exports, dependency metadata, declarations, component styles/token references and a Node import without browser globals. Requires fresh token/library builds. |

**Standalone focused Storybook/browser checks:** the following is one coherent
sequence: prepare fresh dependencies/library output, build the test superset,
then check the selected component and Storybook cases. Rebuild after source
changes; do not substitute an existing static index for freshness.

```sh
bun run build
bun run build:storybook:test
bun run test:browser input.spec.ts app-bar.spec.ts --project=chromium
bun run test:storybook Input.storybook.ts
```

For a public static site instead, use `bun run build:storybook` after dependency
preparation; that build excludes private fixtures and cannot replace the test
superset above.

**Standalone packed-artifact check:** this is a separate coherent sequence, not
an addition to complete acceptance. `build` prepares the dependency DAG,
including tokens; do not prepend a redundant `build:dependencies`.

```sh
bun run build
bun run test:package
```

### Packed-artifact checks

Package checks use only installed tools: no consumer app, dependency installation
or browser server. They validate every shipped `--wui-*` CSS reference against
the packed token definitions, component-local declarations or explicitly known
runtime-owned Tooltip properties. Nested fallback references are checked too.
Temporary archives stay under `.artifacts/package` and are cleaned after checking.
The single packed declaration check consumes package-name exports from an isolated
temporary `node_modules` containing the actual token and Vue tarballs. JS, types
and both CSS resolutions must match those extracted targets, not workspace
fallbacks. Positive and negative snippets cover public types, generated component
props, events, slots and exposed methods with `strict` and without `skipLibCheck`.
Keep these real generated-contract checks; do not replace them with handwritten
declaration mutations or enable `skipLibCheck`.
These checks do not claim independent-project installation or consumer-bundler
integration coverage.

Declaration validations always create a fresh compiler host and semantic program,
with fresh dependency resolution per check. Compiler host/AST/program reuse was
cancelled; do not reintroduce host/AST/`oldProgram` reuse or claim its benchmark
speedup. Successive source, transitive type-target and deletion/restoration
regressions use cold checks in ordered single-compilation
cases, then clean up their shared fixture after the whole sequence.
Never let a timed-out asynchronous loop race per-case fixture cleanup.
Checker self-tests retain a small representative mutation set rather than
recompiling a handwritten declaration for every public contract. The real packed
consumer retains those contracts; the reduced self-tests do not provide equivalent
per-contract mutation sensitivity. Map removed mutation cases to real consumer
assertions. A small evidence object may guard missing groups, but cannot prove
equivalent per-contract sensitivity; do not build a contract registry.
Retain precise diagnostics, keep missing-export and assignment failures distinct,
and require negative-test failures to identify their intended assertion.
No test/global/CI timeout is extended.
Input and Tooltip SSR cases run in Node without window/document, not jsdom.

### Browser coverage

Preserve the existing configuration: component tests use `fullyParallel` with
four workers locally and two in CI; Storybook retains its configured defaults.
Accessibility scans run in Chromium: 15 component scans and one Docs scan.
Button owns its default matrix, actual primary/default/subtle hover and pressed
colors, and the public form. AppBar, Input and Select own their representative
markup; Menu and Tooltip own opened content; shared fields and opened Dialog
have separate scopes. The Docs main scan excludes the already-tested Button form.
Changed-state scans target the changed region rather than unchanged page content.
Narrow/RTL/rotation/enlarged-text geometry and meaningful focus/error/forced-color
assertions remain separate from axe. Repeat scans only for a distinct markup/color
state or responsive semantic change, not every viewport, engine or demonstration.
Typography and mixed-layout fixtures have no independent axe pass. This sampling
does not preserve the previous per-page, per-engine or incidental cross-region
accessibility sensitivity; unit checks and screenshots are not equivalent substitutes.

Manual `storybook` (also `dev`) runs at `http://127.0.0.1:6006`; the independent
4173 entry is retired. Existing manual processes are not managed by test scripts.
Automated browser/Storybook runs own OS-assigned loopback ports and server
lifetimes; they never reuse another server. URLs in tests stay relative to the
captured base URL.
Each run inherits one generated run ID and keeps reports/results under
`.artifacts/{browser,storybook}/<run-id>`.
See [retained run artifacts][retained-run-artifacts] before manual cleanup.
`test:browser`, `test:visual` and `test:storybook` select one group;
`test:browsers` runs both, forwarding filters only to the component group.
The default Windows collection has 88 logical scenarios and 164 executions:

| Group                 | Chromium | Firefox | WebKit | Executions |
| --------------------- | -------: | ------: | -----: | ---------: |
| Component functional  |       69 |      38 |     38 |        145 |
| Windows visual        |        9 |       - |      - |          9 |
| Storybook integration |       10 |       - |      - |         10 |

The 38 cross-engine representatives cover native forms, fieldsets, password/clear,
keyboard/focus, menu/tooltip top layers, native modal lifecycle, narrow/RTL geometry,
the known WebKit control-metrics regression and resource cleanup. Another 31
CSS/token/layout or ordinary logic cases use the native `@chromium-only` test tag;
Firefox/WebKit projects exclude it with `grepInvert`, not planned skips.
The nine visual cases retain all 16 reviewed PNGs. Site composition/Controls checks
remain Chromium-only. Synthetic composition is not proof of real-device IME behavior.
Browser product support is unchanged; this deliberately gives up some Firefox/WebKit
style, typography, accessibility and less important edge-combination regression
sensitivity. Do not infer complete cross-engine coverage from support policy.
Node SSR, cold declarations and real packed-export
checks remain independent; a Storybook bundle does not certify tarball exports.
Use separate worktrees for concurrent source edits or builds.

### Retained run artifacts

`scripts/test-server.mjs` logs `RUN_ID`, owns the runner and loopback server, and
cleans them up on completion/failure or interruption. A reported termination
failure may leave its runner alive; confirm exit rather than assuming cleanup.
Playwright writes HTML reports to `report` and test output to `results` inside
each run directory; traces are
retained on failure and screenshots are failure-only. These browser/Storybook
run directories remain after the run: there is no automatic expiry or
age/count-based pruning. Retained output is diagnostic evidence, not proof that
a static build is fresh or that a later gate passed.

For manual cleanup, first match the logged run ID to your own completed run and
confirm its runner/server have exited and no check or report viewer is using the
output. Then inspect and remove only its exact
`.artifacts\browser\<run-id>` and/or `.artifacts\storybook\<run-id>` directory
in this workspace. If ownership or completion is uncertain, leave it in place;
directory age alone is not evidence. Do not recursively delete artifact parents
or use wildcard/age-based cleanup. Never delete shared static builds
(`.artifacts\storybook\static`, `storybook-static`), `dist`, another run's output,
or another writer's `.artifacts\workflow\build.lock`.
This is manual diagnostic cleanup, not a new verification step. The temporary
packed archives under `.artifacts/package` retain their separate automatic
post-check cleanup described above.

## Storybook and documentation ownership

Start with Getting started and Foundations, then a component's Docs, fixed
Demos, or interactive Playground:

| Section               | Contents                                   |
| --------------------- | ------------------------------------------ |
| Getting started       | Overview, Installation                     |
| Foundations           | Colors, Typography, Spacing, Customization |
| Components / AppBar   | Docs, Demos, Playground                    |
| Components / Menu     | Docs, Demos, Playground                    |
| Components / Button   | Docs, Demos, Playground                    |
| Components / Heading  | Docs, Demos, Playground                    |
| Components / Input    | Docs, Demos, Playground                    |
| Components / Select   | Docs, Demos, Playground                    |
| Components / Text     | Docs, Demos, Playground                    |
| Components / Tooltip  | Docs, Demos, Playground                    |
| Components / Textarea | Docs, Demos, Playground                    |
| Components / Dialog   | Docs, Demos, Playground                    |

Component Docs, stories, implementation, styles and unit tests live together.
Maintain component behavior and examples in those Docs/stories, not repeated
README descriptions of each demo. Foundation previews read the real token source
through `docs/token-reference.ts`; do not duplicate canonical token values.
AGENTS holds authoring constraints; this README owns commands and verification.

Use semantic HTML tables in MDX; the setup does not enable GFM pipe tables.
Wrap each guide in one `main` landmark. Wide generated prop tables use named,
keyboard-focusable scroll regions. A 320px Button Docs representative checks the
generated table, keyboard scrolling and MDX accessibility; Installation represents
Vue highlighting, actual Copy and narrow source scrolling. A separate non-Vue
navigation case checks re-highlighting. Other retained site witnesses cover private
story visibility, Button Controls/palette args/embedded form, AppBar hash selection,
Input controlled composition and Select controlled args.
These are shared integration representatives, not per-page Docs/Demos guarantees.
Per-page layout/content, fixed demo args, panel ordering, Foundation token previews
and each component's Controls binding are no longer individually browser-tested.
Keep their authoring guidance; errors specific to unselected pages may need review
to detect. Do not restore page/viewport matrices merely because two pages share a tool.

Code fences use the community Shiki addon with GitHub Light Default, including
Vue SFC templates and TypeScript. Keep `vue` fences for Vue examples.
The MDX `pre` wrapper maps to `div` because Storybook Source already renders `pre`;
this preserves Copy outside the replaced block. Checks distinguish visible
highlighted code from the addon's hidden original.

The Storybook Vite configuration is separate from library mode. Its watcher
excludes generated artifacts/build output through `viteFinal` after Storybook
constructs server options. Test fixtures use native CSF in `tests/fixtures`,
reusing public stories where sufficient. Only `build:storybook:test` adds their
glob through `WUI_STORYBOOK_CONTRACTS=1`; normal public builds/dev exclude it.
Their `!dev`/`!autodocs` tags hide sidebar/Docs entries in the test superset,
but tags alone do not exclude stories from a build. Component browser tests load
production-bundled stories, not a separate Vite dev/HMR fixture.

## Package boundaries and extension

Tool configuration, direct development dependencies, fixture servers and tests
belong here. Root policy remains package-agnostic.
ESLint rejects filesystem imports into sibling workspaces and private
`@warmsea/*/src` or `@warmsea/*/dist` imports. Use public exports.
Only the exact token CSS imports in `docs/token-reference.ts` and
`.storybook/preview.ts` may read sibling source; the reader uses `?raw`.
These development exceptions do not permit production cross-package imports.

This base package never depends on higher-level ui-ai, even transitively through
development tools or documentation. Import lint and workspace dependency-path
tests enforce that direction; higher-level packages own their own examples.

For an approved component, add a native-first SFC with typed public props and
unscoped `wui-*` CSS, colocated unit tests, authoritative MDX Docs and stories.
Use a stable `Components/<Name>` story ID and update public exports, this component
index, examples, browser checks and package checks together. Story URLs are
deliberate interfaces. Public declarations exclude tests/stories.
The build extracts all component CSS into the single public stylesheet.
Extract a helper only after real shared usage demonstrates the need.

Additional components, runtime dependencies, breaking APIs, theme packages,
publishing automation and agent-specific tooling require scope approval.

## Visual and accessibility release review

Windows Chromium supplies the reviewed snapshots: 1100x900, light colors,
reduced motion and English locale. For intentional visual changes on Windows:

```sh
bun run build
bun run build:storybook:test
bun run test:visual --update-snapshots=all
bun run test:visual
```

Inspect every changed PNG and obtain human approval. CI never generates or
accepts baselines. Do not mask font-rasterization changes by increasing thresholds.

Before release, manually review native keyboard/form behavior, visible focus,
screen-reader name/role/state, Windows high contrast, real touch devices and
actual 200% zoom. Component Docs identify their additional manual checks.
Automated accessibility, synthetic pointer/composition events, enlarged-root-font
checks and screenshots do not prove those experiences. No completed human
assistive-technology review is claimed.

[browser-support]: https://github.com/warmsea/warmsea-mono/blob/main/README.md#browser-support
[setup]: https://github.com/warmsea/warmsea-mono/blob/main/README.md#setup
[layered-verification]: https://github.com/warmsea/warmsea-mono/blob/main/README.md#layered-verification
[retained-run-artifacts]: https://github.com/warmsea/warmsea-mono/blob/main/packages/ui-vue/README.md#retained-run-artifacts
[token-docs]: https://github.com/warmsea/warmsea-mono/blob/main/packages/ui-tokens/README.md
[typography-docs]: https://github.com/warmsea/warmsea-mono/blob/main/packages/ui-vue/docs/Typography.mdx
[customization-docs]: https://github.com/warmsea/warmsea-mono/blob/main/packages/ui-vue/docs/Customization.mdx
[app-bar-docs]: https://github.com/warmsea/warmsea-mono/blob/main/packages/ui-vue/src/components/app-bar/AppBar.mdx
[button-docs]: https://github.com/warmsea/warmsea-mono/blob/main/packages/ui-vue/src/components/button/Button.mdx
[heading-docs]: https://github.com/warmsea/warmsea-mono/blob/main/packages/ui-vue/src/components/heading/Heading.mdx
[input-docs]: https://github.com/warmsea/warmsea-mono/blob/main/packages/ui-vue/src/components/input/Input.mdx
[select-docs]: https://github.com/warmsea/warmsea-mono/blob/main/packages/ui-vue/src/components/select/Select.mdx
[text-docs]: https://github.com/warmsea/warmsea-mono/blob/main/packages/ui-vue/src/components/text/Text.mdx
[tooltip-docs]: https://github.com/warmsea/warmsea-mono/blob/main/packages/ui-vue/src/components/tooltip/Tooltip.mdx
[textarea-docs]: https://github.com/warmsea/warmsea-mono/blob/main/packages/ui-vue/src/components/textarea/Textarea.mdx
[dialog-docs]: https://github.com/warmsea/warmsea-mono/blob/main/packages/ui-vue/src/components/dialog/Dialog.mdx
[menu-docs]: https://github.com/warmsea/warmsea-mono/blob/main/packages/ui-vue/src/components/menu/Menu.mdx
