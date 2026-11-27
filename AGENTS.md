# Repository operating guide

## Agent-first principle

This repository is optimized primarily for coding agents to understand, modify,
and verify correctly. "Agent-first" describes repository maintainability, not
application features; it does not imply agent orchestration, CLI, MCP, or other
product requirements.

- Prefer explicit contracts, predictable structure, and locally discoverable
  instructions over implicit conventions or knowledge from prior conversations.
- Keep each workspace's purpose, public API, dependencies, runnable examples,
  focused checks, and acceptance commands in its README and AGENTS guide.
- Colocate implementation, tests, examples, and documentation with their owner
  so a bounded change requires a small working context.
- Enforce package boundaries and behavioral contracts with automated checks
  rather than relying only on prose. Use public exports and declared dependencies.
- Make routine verification deterministic and independent of credentials or
  paid external services; document live integration checks separately.
- Keep instructions concise and authoritative at the appropriate scope. Update
  them with contract changes; do not duplicate rules across unrelated packages.

## Ownership

- Root files remain package-agnostic. Do not name packages or encode their source
  layouts, frameworks, test tools, fixtures, ports, or product behavior here.
- Discover workspaces through the root manifest and read the owning README and
  AGENTS before editing. Package guides define their public contracts and scope.
- Packages own their tools, direct dependencies, configuration, examples,
  documentation, generated artifacts, and verification commands.
- Packages may extend neutral root policy; root configuration never imports
  package files. Do not add another workspace merely to share configuration.
- Root scripts and CI use generic workspace contracts only. Keep implementation
  and dependency preparation inside the owner.

## Workflow

1. Discover the owner through `package.json`, then read its README and AGENTS.
   Read the relevant implementation, examples, tests and authoritative API docs.
2. Before designing an approach for any task, proactively check repository prior
   art, framework-native capabilities, official documentation, and established
   ecosystem solutions. Prefer the simplest proven compatible option; explain
   why established options are insufficient before adding custom infrastructure.
   Keep research proportional and reuse verified, applicable findings rather than
   repeating broad searches. Keep changes with their owner.
   For CSS/JS/browser APIs, follow README's [browser support policy](README.md#browser-support):
   check official feature docs and syntax-specific MDN BCD against both supported
   Chrome/Edge/Firefox stable majors and the fixed Safari/iOS minimums, not only
   newest releases. Raising fixed floors requires explicit approval. Reuse findings
   until syntax, targets or relevant evidence changes; test project regressions separately.
3. Update public contracts, exports, examples, tests, and documentation together.
4. Select the required gate using README's [layered verification](README.md#layered-verification).
   Use the owner's documented focused loop while editing; do not substitute a
   focused check for required full acceptance. Report the tier actually run.
5. Report unresolved failures and manual checks not performed honestly.

README's [setup](README.md#setup) is authoritative for pinned Node/Bun commands,
runtime overrides and lockfile updates. Follow its npm exec prefix in workspace
guides unless pinned Bun is already on PATH. Do not search npm's cache for
executables, install dependencies merely to explore, or edit lockfiles by hand.

## Verification

- README owns [repository command contracts](README.md#repository-commands),
  [gate selection and preparation rules](README.md#layered-verification), and the
  [ownership contract](README.md#ownership-contract). Package READMEs own their
  selectors, prerequisites, coverage and platform-specific acceptance.
- Never invent a trusted baseline or report empty selection as success.
  Diagnose invalidated preparation and start a new pass; never delete another
  writer's lock or chain a full test immediately before the same complete check.
- Preserve browser concurrency, fixtures, coverage and reviewed baselines.
  Do not weaken tests to accept a bug or claim checks prove untested properties.
- Root formatting covers repository files; packages format themselves and keep
  generated verification output in their own `.artifacts` directories.

## Definition of done

Public contracts are documented, examples are runnable, existing behavior and
package exports remain correct, and required acceptance checks pass.

Do not commit, publish, deploy, configure repository settings, or add specialized
agents without a request. Keep generated builds, reports, and temporary consumers
out of source control. Clean up only files and processes owned by your checks.
