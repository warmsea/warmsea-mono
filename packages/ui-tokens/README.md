# @warmsea/ui-tokens

Framework-independent CSS tokens and the default Warmsea light theme. No Vue,
JavaScript runtime, theme manager or reset. The only selector in the distributed
CSS is `:root`; loading it assigns custom properties, not body/control styling.
Public variables use `--wui-*`. Warm ocean teal `#0f766e`, seafoam surfaces,
and restrained scales define the default light theme; M3 is a design reference
where applicable. Consumers retain control through scoped overrides.

## Public export and customization

```ts
import '@warmsea/ui-tokens/style.css';
```

Plain HTML can link the exported CSS directly; no bundler or framework is required.
Load it once, then add consumer CSS:

```css
:root {
  --wui-color-primary: #1d4ed8;
}

.sunlight {
  --wui-color-primary: #fcd34d;
  --wui-color-primary-hover: rgb(221.76 185.68 67.76);
  --wui-color-primary-active: rgb(191.52 160.36 58.52);
  --wui-color-on-primary: #292524;
}
```

The default ocean primary is `#0f766e`. White text over this palette has been
automatically checked in real component tests. An arbitrary custom color does
not come with a contrast guarantee: choose a readable on-primary foreground and
check base, hover, active and focus states.

### Contract

| Tokens                                                          | Defaults / meaning                                          |
| --------------------------------------------------------------- | ----------------------------------------------------------- |
| `--wui-color-primary`, `--wui-color-on-primary`                 | `#0f766e`, white                                            |
| `--wui-color-surface`, `--wui-color-surface-subtle`             | White, seafoam `#f0fdfa`                                    |
| `--wui-color-text`, `--wui-color-border`, `--wui-color-focus`   | Neutral charcoal `#262626`, visible boundary, focus outline |
| `--wui-color-disabled-surface`, `--wui-color-disabled-text`     | Neutral grays `#e5e5e5`, `#666666` for disabled controls    |
| `--wui-color-error`                                             | `#b91c1c` for error text and invalid field boundaries       |
| `--wui-space-1` through `--wui-space-5`                         | 0.25, 0.5, 0.75, 1, 1.25rem                                 |
| `--wui-font-family`                                             | `"Roboto", "Segoe UI", system-ui, sans-serif`               |
| `--wui-font-weight`, `--wui-line-height`                        | 600, 1.25                                                   |
| `--wui-font-size`                                               | 1rem for body text (16px at a 16px root)                    |
| `--wui-font-size-control`, `--wui-line-height-control`          | 0.875rem, `round(140%, 2px)` (14px/20px at a 16px root)     |
| `--wui-font-size-heading-1` through `--wui-font-size-heading-6` | 2.5, 2, 1.75, 1.5, 1.25, 1.125rem                           |
| `--wui-font-weight-regular`, `--wui-font-weight-semibold`       | 400 for body text, 600 for emphasis and headings            |
| `--wui-line-height-heading`                                     | 1.25, unitless heading line-height                          |
| `--wui-radius-control`, `--wui-border-width`                    | 0.5rem, 1px                                                 |
| `--wui-focus-width`, `--wui-focus-offset`                       | 2px, 3px                                                    |
| `--wui-control-padding-block`                                   | 5px above and below each control's content                  |

### Explicit semantic state palettes

This package alone defines the default interaction recipes, in sRGB. Components
and examples consume these public values rather than repeat the formulas.

| Tokens (`--wui-color-` prefix)                                             | Default recipe / consumer role                                   |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `primary-hover`, `primary-active`                                          | Primary mixed with 12% / 24% black; solid primary controls       |
| `primary-container`, `primary-container-hover`, `primary-container-active` | 12% / 20% / 28% primary in surface; tinted controls              |
| `surface-subtle-active`                                                    | Surface-subtle mixed with 8% black; outlined control active fill |
| `subtle-hover`, `subtle-active`                                            | 4% / 8% text in transparent; subtle control states               |
| `surface-hover`, `surface-active`                                          | 4% / 8% text in surface; navigation states                       |
| `action-highlight`                                                         | 8% text in transparent; action-item hover and keyboard focus     |

Defaults are defined on `:root`. Their variable references resolve there, before
inheritance. A local theme must provide the **complete relevant state group**:
changing only local primary, text or surface no longer recalculates inherited
state colors. Explicit hover/active values inherit normally and can be overridden
again on a child without affecting siblings. Replacing a theme means replacing
its related state values together, not just its base colors.

For primary controls, supply primary/on-primary and primary-hover/active (as in
the sunlight example). If tinted controls are also present, supply all three
primary-container values. Changing surface affects the container and surface
state groups; changing text affects subtle, surface and action-highlight groups.
Changing surface-subtle also requires surface-subtle-active. Only provide groups
used by the scope: a text-only Heading or a primary-colored navigation marker
does not consume primary hover/active colors.

The root example above changes the defaults at their definition scope; it is not
a pattern for nested base-only overrides. Local palettes may use explicit color
values; no scope class, Provider, generator or automatic contrast adjustment is
provided. The HTML is a manual demonstration, not a second design contract.

### Test ownership and default contrast

Node reads the actual opaque `#RRGGBB` defaults in `src/index.css`: text and error
against both surface and surface-subtle, and on-primary against primary must reach
4.5:1; border and focus against both surfaces must reach 3:1. Unsupported color
syntax fails explicitly rather than skipping checks. Thresholds stay independent
of palette values; neutral defaults are checked by equal RGB channels, not copies
of each gray value. Public names and the CSS-only/dependency boundary remain checked.

There are no automated HTML-example tests or token browser runner. The former
example recipe, loading and full-page axe checks are intentionally removed; real
component checks are not equivalent coverage of example-specific defects.
Node checks retain public names, resolved reference boundaries and independent
default contrast. Real component browser checks own state-token consumption,
default rendered colors, explicit palette replacement/inheritance/isolation,
focus, disabled behavior and actual adjacent-color accessibility.
Do not add browser arithmetic, `rem`/`var`/`round()` probes or default-tuple copies.
Feature adoption/target changes require compatibility research under the root
policy, separately from these project regressions.

Contrast thresholds cover only the named default pairs, not arbitrary overrides,
transparency/compositing, images, forced colors or disabled controls. Node palette
checks do not establish correct rendered border/focus application, and axe does
not fully check non-text contrast or complete accessibility. Consumers must check
their actual adjacent colors and interaction states.

The font stack prefers installed Roboto, then Segoe UI, the platform UI font,
and generic sans-serif. It names fonts only: no font files are bundled or
downloaded, and there are no CDN imports or `@font-face` declarations.
The rendered font depends on what is available on the user's system.

Typography tokens assign no heading or paragraph styles by themselves. Apply
the heading size for the intended semantic level, semibold weight, and heading
line-height at the use site. Body text uses `--wui-font-size` (1rem)
and `--wui-line-height` (unitless 1.25): 16px text with a 20px line at a 16px
root. The browser/user or consuming app owns the root font size; this package
does not set it or override user preferences. Larger roots scale text and lines.
Body text uses regular weight. `--wui-font-weight` remains 600 for existing
controls; it is not the body-text default. Regular and semibold are visual
weights, not replacements for semantic emphasis such as `<strong>`.

Controls use `--wui-font-size-control` (0.875rem, 14px at a 16px root) and
`--wui-line-height-control` (`round(140%, 2px)`) independently of body
typography. The percentage follows the control font size and rounds to the nearest 2px,
requesting a 20px line at the default size. They use `--wui-control-padding-block`
(5px) above and below their content. A one-line control with 1px top/bottom
borders is 32px at a 16px root: 20px + 5px + 5px + 2px. Padding intentionally
stays 5px when root text grows; the content-sized control grows with the line.
Native form controls may enforce larger font metrics. Treat 20px as the requested
line-height, not a fixed clipping box for native text.
Keep controls content-sized so enlarged text, icons and multiline labels can
grow. Override padding or line-height locally for larger targets. These
defaults are not a guarantee of touch comfort for every interface.

There is no small/medium/large font-size or control-height scale. Use
`--wui-font-size` / `--wui-line-height` for body text and the corresponding
`-control` roles for controls. Body-size overrides no longer change controls;
migrate control-specific overrides to the control roles.

Override typography tokens on any consumer scope. The plain HTML example shows
both inherited outer overrides and more specific nested overrides without
changing the root theme.

Follow the repository's [browser support policy](https://github.com/warmsea/warmsea-mono/blob/main/README.md#browser-support).
No older-browser polyfills, dark mode or presets.

## Develop and verify

The root [setup](https://github.com/warmsea/warmsea-mono/blob/main/README.md#setup) and
[layered verification](https://github.com/warmsea/warmsea-mono/blob/main/README.md#layered-verification) sections are
authoritative for runtime/install requirements, tier selection and prepared-build
policy. The commands below run from this directory with the pinned Bun prefix.

### Focused editing loop

L1 runs formatting, lint, prepared types and selected Node Vitest tests:

```sh
npm exec --yes --package=bun@1.4.3 -- bun run check:local tokens.test.ts
```

For a narrower task, choose one alternative rather than a sequence:

- Selected Node tests:
  `npm exec --yes --package=bun@1.4.3 -- bun run test:focused tokens.test.ts`.
- CSS build only:
  `npm exec --yes --package=bun@1.4.3 -- bun run build` copies source CSS to the
  distributed file.

`test:focused <file> [...]` accepts multiple selectors; every selector must match.
These narrower commands are not acceptance gates.

### Acceptance and coverage

Choose the affected or complete root gate according to the root verification
policy. For owner-only acceptance:

```sh
npm exec --yes --package=bun@1.4.3 -- bun run check
```

`check`, `check:code`, `check:integration` and `check:ci` prepare their own build
dependencies and run formatting, lint, types and Node contracts. Do not run
standalone full tests or builds first as acceptance prerequisites. `ci:setup` is
a no-op: this owner has no external test assets.

Owner checks cover public names/exports, boundaries, neutral defaults and
independent contrast thresholds read from actual source CSS, not computed CSS,
layout or mixing. This owner has no browser runner. Root acceptance includes the
consumers' packed-artifact, component/browser, visual and Storybook checks; owner
Node results are not evidence of that coverage. See
[test ownership and default contrast](#test-ownership-and-default-contrast) for
the precise contracts and limitations.

### Long-running manual preview

Start this persistent service separately from verification:

```sh
npm exec --yes --package=bun@1.4.3 -- bun run dev
```

Open `http://127.0.0.1:4174/examples/`. The strict-port preview may remain running;
checks never stop or reuse it. It is a manual demonstration, not an acceptance
gate.

### Ownership and extension

Tool configuration and direct development dependencies belong to this package.
This base package never depends on ui-ai, even transitively through development
tools or documentation. Import lint and dependency-path tests enforce that rule.
ESLint rejects filesystem imports into sibling workspaces and private
`@warmsea/*/src` or `@warmsea/*/dist` imports. Use public package exports instead;
imports within this package remain allowed. Boundary tests belong to the Node
suite.
Generated output must not be committed. Use separate worktrees for concurrent
source edits or builds.

`src/index.css` is the contract. `scripts/build.mjs` copies it unchanged to
`dist/style.css`. `tests` validates Node token contracts and package boundaries.
`examples/index.html` demonstrates the palette, nested scopes and light brands.
The Vue package's packed-artifact check verifies this CSS and its shipped export
without installing a separate consumer app. Token export/dependency changes need
consumer acceptance under the root verification policy, not a duplicate owner
gate before that complete pass.

To extend: name the semantic role, add only needed values, document it here,
demonstrate it in the HTML example, and update relevant token/consumer tests. Treat token
removal or changed meaning as a public API change.
Additional themes, dark mode, runtime color generators and automatic foreground
selection remain out of scope. Do not add runtime dependencies or expand scope
without approval.
