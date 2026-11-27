# Vue package guide

- Start with [README](README.md) for the component index and extension recipe.
  Read the current checkout's `src/components/<component>/<Name>.mdx` Docs for
  authoritative detailed public APIs and behavior, not a remote branch snapshot.
  Preserve those contracts and update their owner rather than duplicating APIs here.
- For commands, coverage, artifact freshness/retention and manual checks, use
  README's [verification guide](README.md#develop-and-verify). Root README
  [setup](../../README.md#setup) and [layered verification](../../README.md#layered-verification)
  own generic runtime and gate policy; this guide retains implementation/authoring restrictions.
- Keep package-specific tools, dependencies, test environments, fixture servers
  and documentation here; root policy must not know this package's contents.
- Public classes use `wui-`; CSS variables use `--wui-*`. Preserve warm ocean teal
  `#0f766e` as the default and deliberate consumer overrides. Use M3 as reference.
- Menu, AppBar, Button, Dialog, Heading, Input, Select, Text, Textarea and Tooltip are approved components. Do not add a theme/configuration
  workspace, UI runtime dependency, breaking API or publishing automation.
- Use native elements and `<script setup lang="ts">`; keep public props exported.
- Menu owns a subtle native Button trigger and plain action items, not
  links or nested menus. Preserve disabled-item skipping, empty-menu Escape/Tab,
  dynamic focus repair, outside dismissal and focus return before selection.
  Keep native popovers in the inherited scope and geometry listeners open-only.
- Preserve Button's documented four variants, visible keyboard focus and
  forced-color system boundaries for all.
- Preserve Select's documented controlled native model, prompt, attribute/form
  contracts and parent-owned reset. Keep the native picker/keyboard behavior,
  text-colored logical chevron with reserved space, and native forced-color arrow.
  No custom popup, search, optgroups, slots or multi-select. Select has no
  appearance variant; `--wui-color-primary` is its interaction color.
- Preserve Input's documented string-only types, linked labels/help/error,
  parent-owned validation/reset and wrapper/input attribute routing.
  Clear remains opt-in and native; preserve composition, disabled fieldsets,
  readonly editing guards and focus. Passwords stay masked; no reveal or slots.
  Use the shared error-color role.
- Vue is a peer, external to the ESM build. Never bundle a second Vue runtime.
- Never depend on ui-ai, directly or transitively, including tools, demos,
  documentation and development dependencies. Keep higher-level UI in its owner.
- Consumers load theme CSS explicitly. Do not add document mutation on import.
- Keep token dependencies real in package metadata and styles in `dist/style.css`.
- Keep component-specific CSS in an unscoped `<style>` block inside its SFC.
  Preserve `wui-*` selectors; the build extracts the single public stylesheet.
- Do not add loading/link/polymorphic behavior or another component without scope approval.
- AppBar alone renders native destination links; do not add link mode to Button.
  Keep AppBar selection and routing application-owned. Its required icon slot is
  decorative; labels supply accessible names and immediate Tooltip hints.
  Keep repeated label hints undescribed to avoid duplicate announcements;
  native titles are only the Tooltip fallback for unsupported browsers.
  Use the compact icon-only white rail and short current marker, without badges
  or a text-only fallback.
  Keep the first top link and last bottom link flush with the rail edges;
  do not add outer block padding.
  Animate the shared current marker between measured item positions; keep it
  aligned through layout changes and scrolling, and honor reduced motion.
  Preserve layout observations for unchanged elements; release removed elements
  and disconnect on unmount rather than resubscribing after every update.
  Bottom destinations share the rail's scroll flow.
  AppBar's typed activate(item, MouseEvent) reports native link clicks without
  changing selection or canceling/absorbing native events; consumers own cancellation.
  No router runtime, command items, icon library, or external tooltip/menu dependency.
- Tooltip wraps one enabled native focusable control without cloning or mutating it.
  Keep text plain, opening immediate, and content non-focusable but hoverable.
  Escape dismisses without consuming events or moving focus. No opening timers,
  animations, arrows, click/tap toggles, rich content, or controlled-open API.
  Use the native manual-popover top layer to preserve inherited tokens/direction
  and escape clipping; fallback titles must not coexist with enhanced hints.
  Bind scoped describedBy IDs on the actual trigger, not the wrapper.
  Track geometry/visibility only for active interactions and release resources
  on close/unmount; let native focus scrolling finish before revealing a hint.
- Preserve Heading's documented native rank/typography and Text's closed p/span
  choice, zero margins and consumer-owned spacing; no arbitrary polymorphic roots.
- Button and Text have no size prop. Body text uses `--wui-font-size` (1rem)
  and `--wui-line-height` (1.25). Button, Select and Input
  use `--wui-font-size-control` (0.875rem) and `--wui-line-height-control`
  (`round(140%, 2px)`). Preserve independent scoped overrides, separate
  heading-size roles, and body-sized Tooltip text.
- Preserve Button's existing font-weight token. Body and heading weights use the
  additive regular/semibold tokens, resolved locally for scoped overrides.
- Preserve attribute/listener fallthrough, disabled behavior, safe type defaults,
  focus visibility and native keyboard/form semantics.
- Button, Select and Input use 5px block padding.
  At a 16px root they have 14px text, a 20px line and 32px bordered outer height;
  allow enlarged text, icons and wrapping to grow rather than clipping.
  Native controls may enforce larger font metrics; do not clip them to the
  nominal dimensions. Keep block padding exactly at the token value.
  Preserve AppBar's 44px navigation targets and separate heading typography.
- Consume ui-tokens semantic interaction states without local mixing recipes.
  Local themes supply complete relevant state groups; test explicit overrides,
  nested inheritance, dynamic palette replacement and sibling isolation.
- Implementation, examples, unit tests, browser checks and API docs change together.
- Keep real Storybook stories beside their components and exclude them from declaration output.
- Compose Storybook demos from existing Warmsea UI components wherever suitable,
  including supporting controls and typography (Button, Heading and Text).
  Do not recreate library controls with demo-only HTML/CSS. Use native HTML for
  semantic structure, labels/forms, missing primitives, or native behavior being
  demonstrated. Keep demo-only CSS focused on layout and semantic tokens; do not
  add components or dependencies solely to style demos.
- Colocate narrative component Docs in MDX. Use `Components/<Name>` with a stable
  component ID; keep guides under Getting started and Foundations.
- Do not add in-page tables of contents to Storybook pages. Use section headings
  and the Storybook sidebar. Label Text's p/span comparison "HTML elements".
- Components order Docs, Demos and Playground. Keep Playground interactive-only.
  Combine Button's Variants, States and Types on the separate Demos page,
  not in Playground or individual sidebar stories.
  Disable Controls, Actions and Interactions for Demos and keep its
  configurations fixed. AppBar demos own local selection and cancel demo
  navigation so activation previews styling without scrolling away.
  Hide its addon panel through `.storybook/manager.ts` without
  changing Playground's panel preferences. Keep customization guidance in
  Foundations and local color controls in Playground, not a Demos section.
  Describe the configuration being compared in the button text, not surrounding
  boxes or captions. Only label variants in the Variants section, not other demos.
  Start demo control labels with an uppercase letter; keep prop values unchanged.
  Compare all variants once; use default for other props.
  Keep Types a simple comparison row. Embed the working form example in Docs
  using a docs-only story (`!dev`), without another sidebar entry.
  Show one disabled example and explain that all variants share the same
  borderless disabled appearance. Preserve system-color borders in forced colors.
  Never add fake state props.
- Do not automatically move focus or scroll when either story loads. Exercise
  keyboard focus/tab order in browser tests and through real user interaction.
- Foundation previews read the real token source through `docs/token-reference.ts`.
  Do not duplicate token values or move the canonical contract into the Vue package.
- `.storybook/vite.config.ts` deliberately avoids the library-mode Vite configuration.
- Do not silently accept new visual snapshots or weaken contrast checks.
- Default consumes primary-container state tokens and uses `--wui-color-text`, not the
  primary variant's `--wui-color-on-primary` foreground. Subtle uses the text role
  and subtle state tokens. Preserve explicit scoped palettes and contrast.

## Verification restrictions

- Preserve README's approved [browser coverage](README.md#browser-coverage),
  workers, reviewed snapshots/paths, native/focus/lifecycle witnesses and full
  visual/Storybook gates. Counts or mocks cannot replace behavioral witnesses;
  selection does not change browser support floors.
- Follow README's [packed-artifact checks](README.md#packed-artifact-checks),
  including cold declaration checks, real generated public contracts and
  representative mutation restrictions; do not substitute handwritten declarations.
- Private fixtures use existing CSF, not a registry/DSL or giant page. Keep them
  out of public builds/sidebar/Docs and prefer public stories where sufficient.
  Preserve README's representative axe scopes and shared site witnesses, not
  whole-page or engine/viewport cross-products; reduced sensitivity does not
  remove authoring rules.
- Preserve README's watcher exclusions and owned server/run-artifact lifecycle.
  Manual Storybook may remain running. Use separate worktrees for concurrent
  edits/builds; cleanup must follow the [retention policy](README.md#retained-run-artifacts).
- Follow README's [manual release review](README.md#visual-and-accessibility-release-review);
  automated accessibility checks do not prove full accessibility.
