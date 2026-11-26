# Token package guide

- Read [README](README.md) for the public CSS contract, consumer overrides,
  owner commands and acceptance coverage. Follow root
  [setup](../../README.md#setup) and
  [layered verification](../../README.md#layered-verification) policy.
- Edit `src/index.css`; build output is a byte-for-byte copy, never a second source.
- Keep tokens framework-independent, CSS-only and prefixed `--wui-`.
- Never depend on ui-ai, directly or transitively, including tools, demos,
  documentation and development dependencies.
- Prefer installed Roboto, then Segoe UI, system-ui and sans-serif.
  Specify names only: no font assets, font loading, CDN imports or @font-face.
- Keep the warm ocean teal default `#0f766e` and preserve deliberate consumer
  overrides. Use M3 as a design reference where applicable.
- Keep default text, disabled text and disabled surfaces neutral, not brand-tinted.
- Use `--wui-color-error` for error text and invalid boundaries; retain scoped
  overrides and check contrast against the local surface.
- Do not style body, native elements or consumer classes here.
- Own default interaction recipes here; consumers use semantic state tokens.
  Local themes supply complete relevant state groups. Base-only local overrides
  do not recalculate inherited states; explicit state overrides inherit normally.
- `examples/index.html` must run without Vue; show new public roles there.
- No dark mode, theme package, runtime color generator or automatic text-color API.
- Keep public names/exports, boundaries, neutral defaults and independent default
  contrast thresholds in Node checks reading actual CSS. Real consumers own
  rendered state/override/accessibility checks. HTML is manual demonstration only:
  no automated example tests, arithmetic probes or copies of every default tuple.
- Update relevant token/consumer assertions with intentional public changes.
- Keep body font size at 1rem with unitless 1.25 line-height. Controls use
  0.875rem and `round(140%, 2px)` line-height with 5px block padding.
  At a 16px root, body is 16px and controls are 14px, both on 20px lines;
  bordered one-line controls are 32px. Preserve independent scoped overrides
  and content growth. Heading sizes and line-height remain separate.
- Own tool configs, direct development dependencies, fixture servers and test
  selection here; never move package details into root configuration.
- No additional theme/configuration workspace or UI runtime dependency without
  approval. Coordinate token contract changes with dependent package checks.

Use README's [focused editing loop](README.md#focused-editing-loop) during edits
and [acceptance and coverage](README.md#acceptance-and-coverage) for verification.
Its [long-running manual preview](README.md#long-running-manual-preview) is
separate from checks. Node checks are not browser evidence.
