import { execFile, execFileSync, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { glob, mkdir, open, readFile, rm } from 'node:fs/promises';
import {
  delimiter,
  dirname,
  join,
  matchesGlob,
  posix,
  resolve,
} from 'node:path';
import { fileURLToPath } from 'node:url';

const normalize = (path) => path.replaceAll('\\', '/').replace(/\/$/, '');
const dependencySections = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];
const nameOf = (owner) => owner.manifest.name;

function git(root, args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 16 * 1024 * 1024,
  });
}

function baselineTree(root, base) {
  if (!base || typeof base !== 'string')
    throw new Error('Missing trusted baseline');
  try {
    return git(root, [
      'rev-parse',
      '--verify',
      '--end-of-options',
      `${base}^{tree}`,
    ]).trim();
  } catch (cause) {
    throw new Error(`Invalid trusted baseline: ${base}`, { cause });
  }
}

export async function readWorkspaces(root, base) {
  const tree = base === undefined ? undefined : baselineTree(root, base);
  const read = (path) =>
    tree
      ? git(root, ['show', `${tree}:${normalize(path)}`])
      : readFile(join(root, path), 'utf8');
  const manifest = JSON.parse(await read('package.json'));
  if (!Array.isArray(manifest.workspaces) || !manifest.workspaces.length) {
    throw new Error('Invalid workspace registration in root manifest');
  }
  const patterns = manifest.workspaces.map((pattern) => {
    if (
      typeof pattern !== 'string' ||
      pattern.startsWith('!') ||
      pattern.includes('..')
    ) {
      throw new Error(
        'Unsupported workspace registration; full legacy validation required',
      );
    }
    return `${normalize(pattern)}/package.json`;
  });
  const paths = new Set();
  if (tree) {
    for (const path of git(root, [
      'ls-tree',
      '-r',
      '--name-only',
      '-z',
      tree,
    ]).split('\0')) {
      if (patterns.some((pattern) => matchesGlob(path, pattern)))
        paths.add(path);
    }
  } else {
    for await (const path of glob(patterns, { cwd: root }))
      paths.add(normalize(path));
  }
  if (!paths.size) throw new Error('No registered workspaces in manifest tree');
  const owners = [];
  const seen = new Set();
  for (const path of [...paths].sort()) {
    const entry = JSON.parse(await read(path));
    if (!entry.name || typeof entry.name !== 'string' || seen.has(entry.name)) {
      throw new Error(`Invalid or duplicate workspace manifest: ${path}`);
    }
    seen.add(entry.name);
    owners.push({ path: posix.dirname(path), manifest: entry });
  }
  return owners;
}

function diffPaths(output) {
  const parts = output.split('\0');
  const result = [];
  for (let index = 0; index < parts.length - 1;) {
    const status = parts[index++];
    result.push(parts[index++]);
    if (/^[RC]/.test(status)) result.push(parts[index++]);
  }
  return result;
}

export async function changedPaths(root, base) {
  const tree = baselineTree(root, base);
  return [
    ...new Set([
      ...diffPaths(
        git(root, [
          'diff',
          '--name-status',
          '-z',
          '--find-renames',
          '--cached',
          tree,
          '--',
        ]),
      ),
      ...diffPaths(
        git(root, ['diff', '--name-status', '-z', '--find-renames', '--']),
      ),
      ...git(root, ['ls-files', '--others', '--exclude-standard', '-z'])
        .split('\0')
        .filter(Boolean),
    ]),
  ].sort();
}

function graph(owners) {
  const names = new Map(owners.map((owner) => [nameOf(owner), owner]));
  const paths = new Map(
    owners.map((owner) => [normalize(owner.path), nameOf(owner)]),
  );
  const edges = new Map();
  for (const owner of owners) {
    const dependencies = new Set();
    for (const section of dependencySections) {
      const entries = owner.manifest[section] ?? {};
      if (typeof entries !== 'object' || Array.isArray(entries)) {
        throw new Error(`Invalid ${section}: ${nameOf(owner)}`);
      }
      for (const [key, spec] of Object.entries(entries)) {
        if (typeof spec !== 'string')
          throw new Error(`Invalid dependency: ${key}`);
        if (names.has(key)) {
          dependencies.add(key);
        }
        const alias = /^(?:npm|workspace):((?:@[^/]+\/)?[^/@]+)(?:@.*)?$/.exec(
          spec,
        )?.[1];
        if (alias && names.has(alias)) {
          dependencies.add(alias);
          continue;
        }
        const normalizedSpec = normalize(spec);
        if (
          /^(file|link|portal):/.test(spec) ||
          /^workspace:\.\.?\//.test(normalizedSpec)
        ) {
          const target = posix.normalize(
            posix.join(
              normalize(owner.path),
              normalize(spec.slice(spec.indexOf(':') + 1)),
            ),
          );
          const dependency = paths.get(target);
          if (dependency) dependencies.add(dependency);
          else if (
            target !== owner.path &&
            !target.startsWith(`${owner.path}/`)
          ) {
            throw new Error(
              `Unknown local dependency ownership: ${nameOf(owner)} -> ${spec}`,
            );
          }
        } else if (
          spec.startsWith('workspace:') &&
          (!names.has(key) || (alias && /^[A-Za-z@]/.test(alias)))
        ) {
          throw new Error(
            `Missing workspace dependency: ${nameOf(owner)} -> ${key}`,
          );
        }
      }
    }
    edges.set(nameOf(owner), dependencies);
  }
  return edges;
}

export function selectAffected({
  current,
  previous,
  changes = [],
  baselineError,
}) {
  if (!current?.length)
    throw new Error('No registered workspaces; cannot report empty success');
  const all = [...current].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  const full = (reason, legacy = false) => ({
    selected: all,
    full: true,
    legacy,
    reasons: [reason],
  });
  if (baselineError) return full(baselineError);
  if (!previous?.length) return full('Missing old workspace graph');
  let currentGraph;
  let oldGraph;
  try {
    currentGraph = graph(current);
  } catch (error) {
    return full(error.message, true);
  }
  try {
    oldGraph = graph(previous);
  } catch (error) {
    return full(`Invalid old graph: ${error.message}`);
  }
  if (!changes.length)
    return full(
      'No changed paths; explicit full validation, not empty success',
    );
  if (
    current.some(
      (owner) => !previous.some((old) => nameOf(old) === nameOf(owner)),
    )
  ) {
    return full(
      'New or untracked workspace lacks baseline ownership; full validation required',
    );
  }
  const known = [...current, ...previous].sort(
    (a, b) => b.path.length - a.path.length,
  );
  const seeds = new Set();
  const reasons = [];
  for (const change of changes) {
    const path = normalize(change);
    const owner = known.find((item) =>
      path.startsWith(`${normalize(item.path)}/`),
    );
    if (!owner) return full(`Root or unknown ownership: ${path}`);
    if (path === `${normalize(owner.path)}/package.json`) {
      return full(`Workspace manifest/dependency change: ${path}`);
    }
    seeds.add(nameOf(owner));
    reasons.push(`changed owner ${nameOf(owner)}: ${path}`);
  }
  const reverse = new Map();
  for (const dependencies of [currentGraph, oldGraph]) {
    for (const [owner, entries] of dependencies) {
      for (const dependency of entries) {
        if (!reverse.has(dependency)) reverse.set(dependency, new Set());
        reverse.get(dependency).add(owner);
      }
    }
  }
  const selected = new Set(seeds);
  const queue = [...seeds];
  for (const dependency of queue) {
    for (const consumer of reverse.get(dependency) ?? []) {
      if (selected.has(consumer)) continue;
      selected.add(consumer);
      queue.push(consumer);
      reasons.push(
        `transitive consumer ${consumer} <- ${dependency} (old/new graph union)`,
      );
    }
  }
  const owners = all.filter((owner) => selected.has(nameOf(owner)));
  return owners.length
    ? { selected: owners, full: false, legacy: false, reasons }
    : full('No surviving changed owners; full validation required');
}

function preparationOrder(workspaces, selected) {
  const owners = new Map(workspaces.map((owner) => [nameOf(owner), owner]));
  const dependencies = graph(workspaces);
  const visiting = new Set();
  const complete = new Set();
  const order = [];
  const visit = (name) => {
    if (complete.has(name)) return;
    if (visiting.has(name))
      throw new Error(`Dependency cycle prevents preparation: ${name}`);
    if (!owners.has(name))
      throw new Error(`Unknown preparation owner: ${name}`);
    visiting.add(name);
    for (const dependency of [...dependencies.get(name)].sort())
      visit(dependency);
    visiting.delete(name);
    complete.add(name);
    order.push(owners.get(name));
  };
  for (const owner of selected) visit(nameOf(owner));
  if (!order.length) throw new Error('No owners to prepare');
  return order;
}

export async function prepareOnce({
  workspaces,
  selected,
  fingerprint,
  build,
  validateMetadata = async () => {},
}) {
  const prepared = preparationOrder(workspaces, selected);
  await validateMetadata();
  const initialStates = await Promise.all(prepared.map(fingerprint));
  await validateMetadata();
  const initial = new Map(
    prepared.map((owner, index) => [nameOf(owner), initialStates[index]]),
  );
  const evidence = new Map();
  const validate = async () => {
    await validateMetadata();
    const owners = prepared;
    const states = await Promise.all(owners.map(fingerprint));
    for (const [index, owner] of owners.entries()) {
      const state = states[index];
      if (
        JSON.stringify(state) !==
        JSON.stringify(
          evidence.get(nameOf(owner)) ?? initial.get(nameOf(owner)),
        )
      ) {
        throw new Error(
          `Preparation invalidated: source/upstream/output changed for ${nameOf(owner)}; rerun the gate`,
        );
      }
    }
  };
  for (const owner of prepared) {
    await validate();
    const before = initial.get(nameOf(owner));
    await build(owner);
    const after = await fingerprint(owner);
    if (before.inputs !== after.inputs) {
      throw new Error(`Source changed during preparation: ${nameOf(owner)}`);
    }
    if (!after.ready)
      throw new Error(`Build outputs not ready: ${nameOf(owner)}`);
    evidence.set(nameOf(owner), after);
  }
  await validate();
  return {
    prepared,
    evidence,
    async check(owner, run) {
      if (!evidence.has(nameOf(owner)))
        throw new Error(`Owner not prepared: ${nameOf(owner)}`);
      await validate();
      await run();
      await validate();
    },
  };
}

export async function withWriterLock(path, run) {
  await mkdir(dirname(path), { recursive: true });
  let handle;
  try {
    handle = await open(path, 'wx');
  } catch (cause) {
    if (cause.code === 'EEXIST') {
      throw new Error(
        `Build writer locked: ${path}. Do not remove another writer's lock.`,
        { cause },
      );
    }
    throw cause;
  }
  const token = JSON.stringify({ token: randomUUID(), pid: process.pid });
  try {
    await handle.writeFile(token);
    return await run();
  } finally {
    await handle.close();
    if ((await readFile(path, 'utf8')) !== token) {
      throw new Error(
        `Build writer ownership changed: ${path}; foreign lock preserved`,
      );
    }
    await rm(path);
  }
}

export function focusedFiles(files, selectors) {
  if (!selectors.length)
    throw new Error('Focused checks require at least one file selector');
  const selected = new Set();
  for (const selector of selectors) {
    if (!selector || selector.startsWith('-'))
      throw new Error(`Unsupported file selector: ${selector}`);
    const matches = files.filter((file) =>
      normalize(file).includes(normalize(selector)),
    );
    if (!matches.length)
      throw new Error(`Zero files matched selector: ${selector}`);
    for (const file of matches) selected.add(file);
  }
  return [...selected].sort();
}

export function hashRecords(records) {
  const hash = createHash('sha256');
  for (const [name, content] of [...records].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const bytes = Buffer.from(content);
    hash.update(`${Buffer.byteLength(name)}:${name}${bytes.length}:`);
    hash.update(bytes);
  }
  return hash.digest('hex');
}

const contracts = {
  build: 'build:self',
  code: 'check:code',
  full: 'check',
  ci: 'check:ci',
  integration: 'check:integration',
  local: 'check:local',
  focused: 'test:focused',
  test: 'test:prepared',
  typecheck: 'typecheck:prepared',
};
const permitVariable = 'WARMSEA_WORKSPACE_PREPARED';
const legacyVariable = 'WARMSEA_WORKSPACE_LEGACY';
const scriptFile = fileURLToPath(import.meta.url);
const repository = resolve(dirname(scriptFile), '..');

let resolvedBun;
export function availableBun() {
  if (!resolvedBun) {
    const result =
      process.platform === 'win32'
        ? execFileSync(
            process.env.ComSpec ?? 'cmd.exe',
            ['/d', '/s', '/c', 'bun --print process.execPath'],
            { encoding: 'utf8' },
          )
        : execFileSync('bun', ['--print', 'process.execPath'], {
            encoding: 'utf8',
          });
    resolvedBun = result.trim();
    if (!resolvedBun)
      throw new Error('Pinned Bun is not available on the current PATH');
  }

  return resolvedBun;
}

function nodeEnvironment(env) {
  const key =
    Object.keys(env).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
  // Windows CLI shims find node.exe, not the npm-provided node.cmd.
  return {
    ...env,
    NODE: process.execPath,
    npm_node_execpath: process.execPath,
    [key]: [dirname(process.execPath), env[key]]
      .filter(Boolean)
      .join(delimiter),
  };
}

function runBun(directory, args, env = process.env, capture = false) {
  const result = spawnSync(availableBun(), ['run', ...args], {
    cwd: directory,
    env: nodeEnvironment(env),
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = new Error(
      `Command failed (${result.status ?? result.signal}): ${args.join(' ')}${capture ? `\n${result.stderr}\n${result.stdout}` : ''}`,
    );
    error.exitCode = result.status ?? 1;
    throw error;
  }
  return result.stdout?.trim();
}

function captureScript(directory, args) {
  return new Promise((resolveResult, reject) => {
    execFile(
      availableBun(),
      ['run', ...args],
      {
        cwd: directory,
        env: nodeEnvironment(process.env),
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
      },
      (cause, stdout, stderr) => {
        if (cause) {
          const error = new Error(
            `Owner metadata command failed: ${args.join(' ')}\n${stderr}\n${stdout}`,
            { cause },
          );
          error.exitCode = typeof cause.code === 'number' ? cause.code : 1;
          reject(error);
        } else {
          resolveResult(stdout.trim());
        }
      },
    );
  });
}

async function rootDigest(root) {
  const records = [];
  for await (const path of glob(
    [
      'package.json',
      'bun.lock',
      'tsconfig.base.json',
      '.node-version',
      '.bun-version',
      '.prettierignore',
      '.prettierrc.json',
      '.gitignore',
      '.gitattributes',
      'AGENTS.md',
      'README.md',
      'scripts/**/*.mjs',
      'tests/**/*.mjs',
      '.github/**/*.yml',
      '.github/**/*.yaml',
    ],
    { cwd: root },
  )) {
    records.push([normalize(path), await readFile(join(root, path))]);
  }
  if (resolve(root) !== repository)
    records.push(['workflow-tool', await readFile(scriptFile)]);
  records.push(['node-version', Buffer.from(process.version)]);
  return hashRecords(records);
}

async function fingerprintWithRoot(root, state) {
  if (
    typeof state.inputs !== 'string' ||
    typeof state.outputs !== 'string' ||
    typeof state.ready !== 'boolean'
  ) {
    throw new Error('Invalid owner fingerprint; cannot trust prepared outputs');
  }
  return {
    ...state,
    inputs: hashRecords([
      ['owner', Buffer.from(state.inputs)],
      ['repository', Buffer.from(await rootDigest(root))],
    ]),
  };
}

function requireNode() {
  if (process.version !== 'v24.20.0')
    throw new Error(`Use Node 24.20.0; received ${process.version}`);
}

function requireBun() {
  const version = execFileSync(availableBun(), ['--version'], {
    encoding: 'utf8',
  }).trim();
  if (version !== '1.4.3')
    throw new Error(`Use Bun 1.4.3; received ${version}`);
}

async function runGate({
  root,
  workspaces,
  selected,
  mode,
  selectors = [],
  legacy = false,
}) {
  requireBun();
  if (!selected.length)
    throw new Error('No selected owners; refusing empty success');
  if (mode === 'local' || mode === 'focused') {
    if (selected.length !== 1)
      throw new Error('Focused checks require exactly one owner');
    const files = JSON.parse(
      await captureScript(join(root, selected[0].path), [
        'workflow:select',
        ...selectors,
      ]),
    );
    if (!Array.isArray(files) || !files.length)
      throw new Error('Zero selected files; check not verified');
  }
  if (legacy) {
    console.log(
      '[L3] Full legacy fallback: dependency preparation cannot be reused safely',
    );
    const env = { ...process.env, [legacyVariable]: '1' };
    delete env[permitVariable];
    for (const owner of workspaces) {
      runBun(
        join(root, owner.path),
        [mode === 'build' ? 'build' : 'check:ci'],
        env,
      );
    }
    return;
  }
  const started = performance.now();
  const fingerprint = async (owner) =>
    fingerprintWithRoot(
      root,
      JSON.parse(
        await captureScript(join(root, owner.path), ['workflow:inputs']),
      ),
    );
  const metadata = (owners) =>
    JSON.stringify(
      owners
        .map(({ path, manifest }) => [path, manifest])
        .sort(([a], [b]) => a.localeCompare(b)),
    );
  const discovered = metadata(workspaces);
  const validateMetadata = async () => {
    if (metadata(await readWorkspaces(root)) !== discovered) {
      throw new Error(
        'Workspace dependency metadata changed since discovery; rerun gate',
      );
    }
  };
  const gate = await prepareOnce({
    workspaces,
    selected,
    fingerprint,
    validateMetadata,
    build: async (owner) => {
      console.log(`[prepare] ${nameOf(owner)} build:self`);
      runBun(join(root, owner.path), ['build:self']);
    },
  });
  console.log(
    `[prepare] ${gate.prepared.length} owners, each once, ${((performance.now() - started) / 1000).toFixed(2)}s`,
  );
  if (mode === 'build') return;
  const env = {
    ...process.env,
    [permitVariable]: JSON.stringify({
      root: resolve(root),
      run: randomUUID(),
      states: [...gate.evidence],
    }),
  };
  delete env[legacyVariable];
  const tier =
    mode === 'full' || mode === 'ci'
      ? 'L3'
      : mode === 'integration'
        ? 'L2'
        : 'L1';
  for (const owner of selected) {
    const ownerStarted = performance.now();
    console.log(`[${tier}] ${nameOf(owner)} ${contracts[mode]}`);
    await gate.check(owner, async () => {
      runBun(join(root, owner.path), [contracts[mode], ...selectors], env);
    });
    console.log(
      `[${tier}] ${nameOf(owner)} passed, ${((performance.now() - ownerStarted) / 1000).toFixed(2)}s`,
    );
  }
  console.log(
    `[${tier}] Gate passed; ${((performance.now() - started) / 1000).toFixed(2)}s including preparation`,
  );
}

export async function packageEntry({
  directory,
  root,
  name,
  mode,
  selectors = [],
  state,
  files,
  lock,
  commands,
}) {
  try {
    requireNode();
    if (mode === 'inputs') {
      console.log(JSON.stringify(await state()));
      return;
    }
    const artifactMode = ['artifact-build', 'artifact-check'].includes(mode);
    if (
      selectors.length &&
      !artifactMode &&
      !['select', 'local', 'focused'].includes(mode)
    ) {
      throw new Error(
        'File selectors are only supported by local/focused checks; use test:focused',
      );
    }
    if (
      !['build', 'build-self', 'artifact-build', 'artifact-check'].includes(
        mode,
      ) &&
      !files?.length
    ) {
      throw new Error('Zero owner test files; checks not verified');
    }
    const selectedFiles = ['select', 'local', 'focused'].includes(mode)
      ? focusedFiles(files, selectors)
      : files;
    if (mode === 'select') {
      console.log(JSON.stringify(selectedFiles));
      return;
    }
    const tasks =
      typeof commands === 'function' ? commands(selectedFiles) : commands;
    if (!tasks[mode]?.length && mode !== 'build')
      throw new Error(`Unknown or empty owner check: ${mode}`);
    const execute = async (actions) => {
      for (const args of actions) runBun(directory, args);
    };
    if (mode === 'build-self' || artifactMode) {
      requireBun();
      const actions = artifactMode
        ? tasks[mode].map((args) => [...args, ...selectors])
        : tasks[mode];
      await withWriterLock(lock, () => execute(actions));
      return;
    }
    if (process.env[legacyVariable] === '1') {
      if (!tasks['legacy-prepare']?.length)
        throw new Error('Owner does not implement safe legacy preparation');
      await execute(tasks['legacy-prepare']);
      if (mode !== 'build') await execute(tasks[mode]);
      return;
    }
    const rawPermit = process.env[permitVariable];
    if (rawPermit) {
      const permit = JSON.parse(rawPermit);
      if (
        resolve(permit.root) !== resolve(root) ||
        !permit.run ||
        !Array.isArray(permit.states)
      ) {
        throw new Error('Invalid preparation invocation evidence');
      }
      const expected = new Map(permit.states).get(name);
      const validate = async () => {
        if (
          !expected ||
          JSON.stringify(expected) !==
            JSON.stringify(await fingerprintWithRoot(root, await state()))
        ) {
          throw new Error(
            `Preparation invalidated or owner not prepared: ${name}; rerun gate`,
          );
        }
      };
      await validate();
      if (mode !== 'build') await execute(tasks[mode]);
      await validate();
      return;
    }
    console.log(
      `[prepare] No invocation evidence for ${name}; preparing a fresh owner/dependency pass`,
    );
    const workspaces = await readWorkspaces(root);
    const selected = workspaces.filter((owner) => nameOf(owner) === name);
    await runGate({ root, workspaces, selected, mode, selectors });
  } catch (error) {
    console.error(error.message);
    process.exitCode = error.exitCode ?? 1;
  }
}

async function main(args) {
  requireNode();
  let mode = args.shift();
  if (mode !== 'affected' && !contracts[mode])
    throw new Error(`Unknown workflow mode: ${mode}`);
  let root = repository;
  let base;
  let ownerName;
  let explain = false;
  let dryRun = false;
  const selectors = [];
  const value = (option) => {
    const item = args.shift();
    if (!item || item.startsWith('-'))
      throw new Error(`Missing value for ${option}`);
    return item;
  };
  while (args.length) {
    const arg = args.shift();
    if (arg === '--root') root = resolve(value(arg));
    else if (arg === '--base') base = value(arg);
    else if (arg === '--owner') ownerName = value(arg);
    else if (arg === '--explain') explain = true;
    else if (arg === '--dry-run') dryRun = true;
    else if (arg.startsWith('-'))
      throw new Error(`Unknown workflow option: ${arg}`);
    else selectors.push(arg);
  }
  if (selectors.length && !['affected', 'local', 'focused'].includes(mode)) {
    throw new Error(
      'File selectors are only supported by local/focused checks',
    );
  }
  if (ownerName && !['local', 'focused'].includes(mode)) {
    throw new Error(
      'Cannot narrow a whole-root gate with --owner; use the owner package command',
    );
  }
  if (base && mode !== 'affected') {
    throw new Error('--base is only supported by affected selection');
  }
  const workspaces = await readWorkspaces(root);
  let selected = ownerName
    ? workspaces.filter((owner) => nameOf(owner) === ownerName)
    : workspaces;
  if (!selected.length) throw new Error(`Unknown owner: ${ownerName}`);
  let legacy = false;
  if (mode === 'affected') {
    if (ownerName || selectors.length)
      throw new Error('Affected selection cannot be narrowed manually');
    let previous;
    let changes;
    let baselineError;
    try {
      if (!base) throw new Error('Missing trusted baseline');
      previous = await readWorkspaces(root, base);
      changes = await changedPaths(root, base);
    } catch (error) {
      baselineError = `Baseline cannot be trusted: ${error.message}`;
    }
    const selection = selectAffected({
      current: workspaces,
      previous,
      changes,
      baselineError,
    });
    ({ selected, legacy } = selection);
    mode = selection.full ? 'ci' : 'integration';
    console.log(
      selection.full
        ? '[L3] affected -> full fallback'
        : '[L2] affected selection',
    );
    console.log(
      `Selected (${selected.length}): ${selected.map(nameOf).join(', ')}`,
    );
    for (const reason of explain
      ? selection.reasons
      : selection.reasons.slice(0, 1))
      console.log(`Reason: ${reason}`);
  }
  try {
    preparationOrder(workspaces, selected);
  } catch (error) {
    legacy = true;
    selected = workspaces;
    if (mode !== 'build') mode = 'ci';
    console.log(`[L3] full fallback: ${error.message}`);
  }
  if (dryRun) {
    console.log('DRY RUN: no checks executed; not verified');
    return;
  }
  if (legacy) {
    throw new Error(
      'Cannot safely prepare the current dependency graph; full acceptance is blocked until metadata is repaired',
    );
  }
  if (['code', 'full', 'ci'].includes(mode)) {
    requireBun();
    runBun(root, ['check:root']);
  }
  await runGate({ root, workspaces, selected, mode, selectors, legacy });
}

if (process.argv[1] && resolve(process.argv[1]) === scriptFile) {
  try {
    await main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = error.exitCode ?? 1;
  }
}
