# Warmsea monorepo

This root owns workspace installation and repository-wide policy, not package
implementation. Discover workspaces through `package.json`; each workspace's
README and AGENTS guide describes its purpose, public API, development tools,
and verification requirements.

## Setup

Install Node **24.20.0** with npm first. Node and Bun **1.4.3** are pinned in
`.node-version`, `.bun-version`, and the root manifest.

After cloning, run these commands from the repository root:

```sh
npm exec --yes --package=bun@1.4.3 -- bun install --frozen-lockfile
npm exec --yes --package=bun@1.4.3 -- bun run build
```

`npm exec` downloads the pinned Bun into npm's cache as needed and makes it
available to the command and its child processes. No global Bun installation,
manual PATH changes, or terminal restart is required. Initial setup needs network
access to download tools and dependencies.

The commands below and workspace guides use `bun` as shorthand. Unless the pinned
Bun is already on PATH, prefix each command with
`npm exec --yes --package=bun@1.4.3 --`, including commands run from a workspace.
Do not invoke cached executable paths directly.

After intentional manifest changes, run
`npm exec --yes --package=bun@1.4.3 -- bun install` and include the generated
`bun.lock`. Do not edit the lockfile by hand.

If the active Node version differs from the pin, use
`npm exec --yes --package=node@24.20.0 --package=bun@1.4.3 --` for the commands
below. The runtime shim provides the executable to child processes; do not
search the cache or persist executable paths.
Guarded gates bind child npm fork-runtime metadata to their validated Node
executable and prepend that executable's directory only in the child environment.
Windows CLI shims otherwise can use system Node despite npm's node.cmd prefix.

## Repository commands

Root commands delegate to all registered workspaces without naming packages or
knowing their sources, frameworks, fixtures, or test tools.

| Command                | Contract                                          |
| ---------------------- | ------------------------------------------------- |
| `bun run build`        | Build each workspace                              |
| `bun run format`       | Format repository files and each workspace        |
| `bun run format:check` | Check repository and workspace formatting         |
| `bun run lint`         | Run each workspace's lint checks                  |
| `bun run typecheck`    | Run each workspace's type checks                  |
| `bun run test`         | Run each workspace's unit/contract tests          |
| `bun run check:code`   | Run each workspace's code/build acceptance        |
| `bun run ci:setup`     | Prepare each workspace's external test assets     |
| `bun run check`        | Run each workspace's full local acceptance        |
| `bun run check:ci`     | Run each workspace's platform-aware CI acceptance |

Run focused development and verification commands from the owning workspace,
following its README. Specialized commands are intentionally not root aliases.
Workspaces own their prerequisites and must propagate command failures.

The GitHub Actions **Verify** workflow is manual-only; pushes and pull requests
do not trigger it. Once the workflow is on the default branch, run it from
**Actions > Verify > Run workflow**.

## Working on a change

Discover the owning workspace through `package.json`, then read its README and
AGENTS before editing. Its README supplies the focused command and acceptance
coverage; [layered verification](#layered-verification) below determines which
gate is required. Run one acceptance gate, not a standalone full test/build
followed by a gate that already prepares and checks them.

## Browser support

This section is the single source of truth for browser compatibility targets.
**Chrome, Edge and Firefox support the most recent two regular, generally
released Stable major versions**, a rolling current/previous-major window.
Patch releases do not count as separate major versions. Limited Early Stable,
beta/dev/nightly, Safari Technology Preview, Extended Stable and ESR do not
replace the regular Stable window.

**Safari has fixed functional minimums**, set by policy on 2026-11-23:
Safari browser, iOS and iPadOS are all **27.2 minimum**.
Support includes those minimums and later regular stable releases. Raising any
minimum requires an explicit policy decision; new Safari or OS releases do not
silently drop the supported minimum. Use the latest security patches, but a patch
recommendation does not raise the functional compatibility floor.
No latest-macOS-only minimum is imposed:
Safari browser compatibility and its host OS requirements are distinct.
Versions outside the rolling window or below these floors, and embedded WebViews,
are not guaranteed without separate approval.

### Verified target snapshot: 2026-11-23

The desktop release builds below verify each supported major, not an exhaustive
latest-patch inventory or a claim of testing every browser/device. Desktop version
numbers do not identify mobile variants.

| Browser | Current regular Stable                                   | Previous regular Stable                                    |
| ------- | -------------------------------------------------------- | ---------------------------------------------------------- |
| Chrome  | **158**: [158.0.8127.36/.37, November 17][chrome-stable] | **157**: [157.0.8103.78/.79, November 11][chrome-previous] |
| Edge    | **158**: [158.0.4370.33, November 19][edge-stable]       | **157**: [157.0.4341.42, November 5][edge-previous]        |
| Firefox | **160**: [160.0.1, November 17][firefox-release]         | **159**: [159.0.1, November 3][firefox-previous]           |

Chrome's paired patches are Windows/macOS releases; Linux uses `.36` and `.78`
respectively. [Chrome 159 Early Stable, November 18][chrome-early] is upcoming,
not part of this window, even though the [Stable API][chrome-current] lists it.

| Safari platform | Fixed browser minimum | Fixed system minimum / host distinction                                   | Official evidence                                             |
| --------------- | --------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------- |
| macOS           | **27.2**              | No new macOS floor; Safari 27.2 is also released for macOS 26 and Sequoia | [Safari release, October 26][safari-release]                  |
| iOS / iPadOS    | **27.2**              | **iOS 27.2 / iPadOS 27.2**, separately from the browser version           | [Safari and supported OS release, October 26][safari-release] |

**Evidence limits:** The [iOS/iPadOS 27.2.1 security update, November 9][ios-release]
and [Apple's current OS releases][apple-releases] are patch/release evidence, not
functional minimums. OS versions are not Safari version numbers; an independent
Safari patch/build for those systems was not verified. Do not invent
"Safari 27.2.1" or reuse the original 27.2 build as a current OS build.
Chrome blog direct retrieval was rate-limited (HTTP 429); its official indexed
announcements and Version History API supplied the release/channel evidence.

Before adopting new CSS, JavaScript or browser APIs, recheck the official release
sources and refresh the dated Chrome/Edge/Firefox current/previous window when
regular Stable majors advance, even without a new feature. Preserve Safari/iOS
minimums unless explicitly approved to raise them; retain policy changes in
normal version-control history. Record unresolved evidence gaps, never infer
versions from schedules or test tools. Check official feature documentation and
[MDN browser compatibility data][bcd] for **both supported stable majors and the
fixed Safari/iOS/iPadOS 27.2 minimums**, including exact syntax, options, platform limitations
and known issues, not just the newest release. For example,
`round(140%, 2px)` requires the [mixed-type parameter support entry][round-bcd],
not just generic `round()` support.

Reuse applicable compatibility findings while source syntax and targets remain
unchanged; revisit changed evidence or reported engine regressions. Compatibility
qualification is separate from testing whether our CSS, data, loading or consumer
behavior regressed. Keep the existing project regression and acceptance gates.
[Pinned Playwright browsers][playwright-browsers] do not prove the whole window or fixed floors:
Playwright WebKit is not current Safari/macOS/iOS certification. Record actual
tested browser/OS versions and untested targets separately; this policy does not
upgrade binaries, change test defaults or create a new test mandate.

[chrome-stable]: https://chromereleases.googleblog.com/2026/11/stable-channel-update-for-desktop_01699533288.html
[chrome-previous]: https://chromereleases.googleblog.com/2026/11/stable-channel-update-for-desktop_01744469280.html
[chrome-early]: https://chromereleases.googleblog.com/2026/11/early-stable-update-for-desktop_01707050408.html
[chrome-current]: https://versionhistory.googleapis.com/v1/chrome/platforms/win/channels/stable/versions?pageSize=3
[edge-stable]: https://learn.microsoft.com/en-us/deployedge/microsoft-edge-relnote-stable-channel
[edge-previous]: https://learn.microsoft.com/en-us/deployedge/microsoft-edge-relnote-archive-stable-channel
[firefox-release]: https://www.firefox.com/en-US/firefox/160.0.1/releasenotes/
[firefox-previous]: https://www.firefox.com/en-US/firefox/159.0.1/releasenotes/
[safari-release]: https://developer.apple.com/documentation/safari-release-notes/safari-27_2-release-notes
[apple-releases]: https://support.apple.com/en-us/100100
[ios-release]: https://support.apple.com/en-us/149715
[bcd]: https://github.com/mdn/browser-compat-data
[round-bcd]: https://raw.githubusercontent.com/mdn/browser-compat-data/main/css/types/round.json
[playwright-browsers]: https://playwright.dev/docs/browsers

## Layered verification

- **L1:** from the owner, `bun run check:local <test-file-selector> [...]`
  checks formatting, lint, prepared types and focused tests. Every selector must
  match; an empty selector list fails before preparation. Owners document their
  test environment and behaviors requiring browsers.
- **L2:** from root, `bun run check:affected --base <trusted-ref> --explain`.
  This includes changes relative to that tree, staged/unstaged/untracked paths,
  both rename sides and deletions, then transitive consumers from the old/new
  dependency graphs (including dev/peer/optional/local and aliased dependencies).
  Owner `check:integration` adapters retain relevant browser/public-artifact checks.
  Manifest/root/lock/unknown changes, new owners and absent/invalid baselines
  conservatively promote to full `check:ci`; do not guess a trusted ref or create
  a commit to obtain one. Zero changed owners also promotes rather than claiming
  empty success. `--dry-run` explains the selection without verifying anything.
- **L3:** `bun run check:ci` is the actual complete, platform-aware acceptance;
  `bun run check` is complete local acceptance. Both keep all owner checks.
  Required for merge/release, public contracts/dependencies, unknown impact or an
  explicitly requested full check. L1/L2 are not substitutes for a required L3.

Every gate prepares the current workspace dependency DAG through each owner's
`build:self` once, then consumes that pass through guarded prepared commands.
Root `check:root` formatting/policy regressions run exactly once for complete
root gates, including an affected gate promoted to L3. Discovery metadata is
bound to the pass and all dependency-closure inputs are captured before builds;
later downstream changes cannot become an accepted initial snapshot.
Standalone prepared commands without evidence create a fresh pass. Root handles
metadata/dispatch only; owners inventory inputs/outputs and own native/tool
preparation. A source, upstream or output change invalidates the gate and fails
explicitly; diagnose and rerun. No persistent cache or passed-test receipts exist.
Build locks refuse a second writer; never delete another writer's lock.
Owners use the same lock for shared generated-artifact builds and consuming checks.
An unsafe current dependency graph still selects full scope but fails before
building: repair its metadata and rerun complete acceptance. It must not enter
recursive legacy builds, invent an order or claim a successful empty gate.

CI checks formatting before external test-asset setup and still runs the actual
`check:ci`; it does not add a duplicate affected/full run. Browser concurrency,
fixtures, platform-specific checks and acceptance coverage remain owner-defined.
Do not automatically run a full test and then the same full check.
Use console gate/preparation durations for the workload actually executed;
focused and complete checks are different workloads, not comparable speedups.

Root policy/helper regressions: `bun run test:workflow` runs the entire Node suite.
For a focused policy edit, put Node flags before filenames, for example
`node --test --test-name-pattern="dependency" tests\workspaces.test.mjs`
with the pinned runtime prefix. Appending Node flags after the script's file
glob does not make `test:workflow` focused.

## Ownership contract

- Root policy must not import package files, enumerate package names, scan package
  source trees, or configure package-specific tools.
- Workspaces declare the tools they directly use, even if installation hoists them.
- Shared formatting policy and `tsconfig.base.json` are package-agnostic; packages
  opt in and define their own inputs, environments, outputs, and execution.
- Root formatting covers root files and `.github`; workspaces format themselves.
- Every workspace implements the common script contracts above. CI invokes only
  those contracts and collects package-owned `.artifacts` directories.
- Guarded verification also requires owner `check:local`, `check:integration`,
  `build:self`, `typecheck:prepared`, `test:prepared`, `workflow:inputs` and
  `workflow:select` adapters. Owners define input/output inventories, file
  selectors and integration coverage; root dispatch reads registration,
  dependency metadata and Git paths, not package source layouts.
- Workspace registration and the generated shared lockfile describe installation
  metadata; they do not move package implementation responsibilities into root.

Adding a conforming workspace does not require editing root command dispatch,
tool configuration, CI package lists, or package-specific documentation.
