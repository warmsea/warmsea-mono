import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

let workflow = {};
try {
  workflow = await import('../scripts/workspaces.mjs');
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}

function required(name) {
  assert.equal(
    typeof workflow[name],
    'function',
    `Missing workspace workflow behavior: ${name}`,
  );
  return workflow[name];
}

const workspace = (name, dependencies = {}, extra = {}) => ({
  path: `owners/${name}`,
  manifest: { name, dependencies, ...extra },
});
const current = [
  workspace('base'),
  workspace('component', { base: 'workspace:*' }),
  workspace('consumer', { component: 'workspace:*' }),
  workspace('independent'),
];
const names = (selection) =>
  selection.selected.map(({ manifest }) => manifest.name);

test('missing or invalid trusted baselines select every current owner, never empty success', () => {
  for (const reason of [
    'Missing trusted baseline',
    'Invalid baseline',
    'Invalid old graph',
  ]) {
    const selection = required('selectAffected')({
      current,
      baselineError: reason,
    });
    assert.equal(selection.full, true);
    assert.deepEqual(names(selection), [
      'base',
      'component',
      'consumer',
      'independent',
    ]);
    assert.ok(selection.reasons.some((item) => item.includes(reason)));
  }
  assert.throws(
    () =>
      required('selectAffected')({
        current: [],
        baselineError: 'Missing baseline',
      }),
    /No registered workspaces/,
  );
});

test('changed owners include consumers from both dependency graphs and every dependency section', () => {
  const old = [
    workspace('base'),
    workspace('old-consumer', {}, { devDependencies: { base: '*' } }),
    workspace('app', {}, { peerDependencies: { 'old-consumer': '*' } }),
    workspace('new-consumer'),
    workspace('independent'),
  ];
  const next = [
    workspace('base'),
    workspace('old-consumer'),
    workspace(
      'app',
      {},
      { optionalDependencies: { alias: 'npm:new-consumer@*' } },
    ),
    workspace('new-consumer', {}, { devDependencies: { base: 'workspace:*' } }),
    workspace('independent'),
  ];
  const selection = required('selectAffected')({
    current: next,
    previous: old,
    changes: ['owners/base/src/a.ts'],
  });
  assert.equal(selection.full, false);
  assert.deepEqual(names(selection), [
    'app',
    'base',
    'new-consumer',
    'old-consumer',
  ]);
  assert.ok(selection.reasons.some((item) => item.includes('consumer')));
});

test('local and aliased workspace dependencies propagate while package-owned vendor files remain owned', () => {
  const owners = [
    workspace('base'),
    workspace('file-consumer', { renamed: 'file:../base' }),
    workspace(
      'link-consumer',
      {},
      { devDependencies: { renamed: 'link:../file-consumer' } },
    ),
    workspace(
      'alias-consumer',
      {},
      { peerDependencies: { alias: 'workspace:link-consumer@*' } },
    ),
    workspace('vendor-owner', { external: 'file:./vendor/external' }),
  ];
  assert.deepEqual(
    names(
      required('selectAffected')({
        current: owners,
        previous: owners,
        changes: ['owners/base/src/a.ts'],
      }),
    ),
    ['alias-consumer', 'base', 'file-consumer', 'link-consumer'],
  );
  assert.deepEqual(
    names(
      required('selectAffected')({
        current: owners,
        previous: owners,
        changes: ['owners/vendor-owner/vendor/external/src/a.ts'],
      }),
    ),
    ['vendor-owner'],
  );
});

test('unknown ownership, manifests, locks, missing local dependencies and zero changes fall back to full', () => {
  for (const changes of [
    ['unknown/a.ts'],
    ['bun.lock'],
    ['owners/base/package.json'],
    [],
  ]) {
    const selection = required('selectAffected')({
      current,
      previous: current,
      changes,
    });
    assert.equal(selection.full, true);
    assert.equal(selection.selected.length, 4);
  }
  const broken = [
    workspace('base'),
    workspace('consumer', { missing: 'workspace:*' }),
  ];
  assert.equal(
    required('selectAffected')({
      current: broken,
      previous: broken,
      changes: ['owners/base/src/a.ts'],
    }).full,
    true,
  );
  const unknownLocal = [workspace('base', { external: 'file:../../unknown' })];
  assert.equal(
    required('selectAffected')({
      current: unknownLocal,
      previous: unknownLocal,
      changes: ['owners/base/src/a.ts'],
    }).full,
    true,
  );
});

test('dependency values cannot be hidden by a key matching another workspace, including alias and Windows local paths', () => {
  for (const dependencies of [
    { base: 'npm:component@*' },
    { alias: 'npm:component' },
    { alias: 'file:..\\component' },
  ]) {
    const owners = [
      workspace('base'),
      workspace('component'),
      workspace('consumer', dependencies),
    ];
    assert.deepEqual(
      names(
        required('selectAffected')({
          current: owners,
          previous: owners,
          changes: ['owners/component/src/a.ts'],
        }),
      ),
      ['component', 'consumer'],
    );
  }
});

test('new owners and malformed previous dependency metadata require explained full validation', () => {
  const selection = required('selectAffected')({
    current,
    previous: [current[0]],
    changes: ['owners/base/src/a.ts'],
  });
  assert.equal(selection.full, true);
  assert.equal(selection.selected.length, 4);
  const malformed = [workspace('base', {}, { devDependencies: ['not-a-map'] })];
  const previous = required('selectAffected')({
    current,
    previous: malformed,
    changes: ['owners/base/src/a.ts'],
  });
  assert.equal(previous.full, true);
  assert.match(previous.reasons.join(' '), /Invalid old graph/);
});

test('deleted and renamed owners preserve old consumers even when old edges no longer exist', () => {
  const previous = [
    workspace('removed'),
    workspace('app', { removed: '*' }),
    workspace('other'),
  ];
  const next = [workspace('app'), workspace('other')];
  const selection = required('selectAffected')({
    current: next,
    previous,
    changes: ['owners/removed/src/a.ts', 'owners/app/src/new.ts'],
  });
  assert.deepEqual(names(selection), ['app']);
});

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'warmsea-workflow-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const put = async (path, contents) => {
    await mkdir(join(directory, path, '..'), { recursive: true });
    await writeFile(join(directory, path), contents);
  };
  const git = (...args) => {
    const result = execFileSync('git', args, {
      cwd: directory,
      encoding: 'utf8',
    }).trim();
    if (args[0] === 'init') {
      execFileSync('git', ['config', 'core.autocrlf', 'false'], {
        cwd: directory,
      });
    }
    return result;
  };
  return { directory, put, git };
}

test('Git collection retains committed-tree, staged, unstaged, untracked, deletion and rename paths', async (t) => {
  const { directory, put, git } = await fixture(t);
  git('init', '--quiet');
  for (const name of [
    'staged',
    'unstaged',
    'deleted',
    'renamed',
    'cancelled',
  ]) {
    await put(`${name}.txt`, 'before\n');
  }
  git('add', '.');
  const base = git('write-tree');
  await put('staged.txt', 'staged\n');
  await put('cancelled.txt', 'staged then restored\n');
  git('add', 'staged.txt', 'cancelled.txt');
  await put('cancelled.txt', 'before\n');
  await put('unstaged.txt', 'unstaged\n');
  await rm(join(directory, 'deleted.txt'));
  git('mv', 'renamed.txt', 'new name.txt');
  await put('untracked.txt', 'new\n');
  const paths = await required('changedPaths')(directory, base);
  assert.deepEqual(paths.sort(), [
    'cancelled.txt',
    'deleted.txt',
    'new name.txt',
    'renamed.txt',
    'staged.txt',
    'unstaged.txt',
    'untracked.txt',
  ]);
  await assert.rejects(
    () => required('changedPaths')(directory, '--bad-ref'),
    /baseline/i,
  );
});

test('workspace discovery uses manifest registration and rejects malformed or absent old metadata', async (t) => {
  const { directory, put, git } = await fixture(t);
  git('init', '--quiet');
  await put('package.json', JSON.stringify({ workspaces: ['owners/*'] }));
  await put('owners/base/package.json', JSON.stringify({ name: 'base' }));
  git('add', '.');
  const base = git('write-tree');
  await put('owners/new/package.json', JSON.stringify({ name: 'new' }));
  assert.deepEqual(
    (await required('readWorkspaces')(directory))
      .map(({ manifest }) => manifest.name)
      .sort(),
    ['base', 'new'],
  );
  assert.deepEqual(
    (await required('readWorkspaces')(directory, base)).map(
      ({ manifest }) => manifest.name,
    ),
    ['base'],
  );
  await put('owners/new/package.json', '{invalid');
  await assert.rejects(
    () => required('readWorkspaces')(directory),
    /manifest|JSON/i,
  );
  await assert.rejects(
    () => required('readWorkspaces')(directory, 'absent'),
    /baseline/i,
  );
});

test('preparation builds dependencies once in topological order before any checks', async () => {
  const events = [];
  const states = new Map(
    current.map(({ manifest }) => [
      manifest.name,
      { inputs: 'source', outputs: 'absent', ready: false },
    ]),
  );
  const gate = await required('prepareOnce')({
    workspaces: current,
    selected: current.slice(0, 3),
    fingerprint: async ({ manifest }) =>
      structuredClone(states.get(manifest.name)),
    build: async ({ manifest }) => {
      events.push(`build:${manifest.name}`);
      states.set(manifest.name, {
        inputs: 'source',
        outputs: 'built',
        ready: true,
      });
    },
  });
  await gate.check(current[2], async () => events.push('check:consumer'));
  await gate.check(current[1], async () => events.push('check:component'));
  assert.deepEqual(events, [
    'build:base',
    'build:component',
    'build:consumer',
    'check:consumer',
    'check:component',
  ]);
  assert.deepEqual(
    gate.prepared.map(({ manifest }) => manifest.name),
    ['base', 'component', 'consumer'],
  );
});

test('source, upstream and output mutation invalidates preparation before or after a check', async () => {
  for (const [owner, field] of [
    ['consumer', 'inputs'],
    ['base', 'inputs'],
    ['base', 'outputs'],
  ]) {
    const states = new Map(
      current.map(({ manifest }) => [
        manifest.name,
        { inputs: 'source', outputs: 'built', ready: true },
      ]),
    );
    const gate = await required('prepareOnce')({
      workspaces: current,
      selected: [current[2]],
      fingerprint: async ({ manifest }) =>
        structuredClone(states.get(manifest.name)),
      build: async () => {},
    });

    states.get(owner)[field] = 'changed';
    let checked = false;
    await assert.rejects(
      () =>
        gate.check(current[2], async () => {
          checked = true;
        }),
      /changed|invalidated/i,
    );
    assert.equal(checked, false);
  }
  let revision = 'before';
  const gate = await required('prepareOnce')({
    workspaces: [current[0]],
    selected: [current[0]],
    fingerprint: async () => ({
      inputs: revision,
      outputs: 'built',
      ready: true,
    }),
    build: async () => {},
  });
  await assert.rejects(
    () =>
      gate.check(current[0], async () => {
        revision = 'during';
      }),
    /changed|invalidated/i,
  );
});

test('downstream inputs changed during an earlier build cannot become a new accepted initial snapshot', async () => {
  const states = new Map(
    current.map(({ manifest }) => [
      manifest.name,
      { inputs: 'original', outputs: 'built', ready: true },
    ]),
  );
  const built = [];
  await assert.rejects(
    () =>
      required('prepareOnce')({
        workspaces: current,
        selected: [current[2]],
        fingerprint: async ({ manifest }) =>
          structuredClone(states.get(manifest.name)),
        build: async ({ manifest }) => {
          built.push(manifest.name);
          if (manifest.name === 'base')
            states.get('component').inputs = 'changed metadata/source';
        },
      }),
    /changed|invalidated/i,
  );
  assert.deepEqual(built, ['base']);
});

test('failed builds, missing outputs, changing inputs and dependency cycles cannot yield a prepared success', async () => {
  const one = [current[0]];
  await assert.rejects(
    () =>
      required('prepareOnce')({
        workspaces: one,
        selected: one,
        fingerprint: async () => ({ inputs: 'a', outputs: 'b', ready: true }),
        build: async () => {
          throw new Error('compiler failed');
        },
      }),
    /compiler failed/,
  );
  await assert.rejects(
    () =>
      required('prepareOnce')({
        workspaces: one,
        selected: one,
        fingerprint: async () => ({ inputs: 'a', outputs: 'b', ready: false }),
        build: async () => {},
      }),
    /output|ready/i,
  );
  let revision = 'before';
  await assert.rejects(
    () =>
      required('prepareOnce')({
        workspaces: one,
        selected: one,
        fingerprint: async () => ({
          inputs: revision,
          outputs: 'b',
          ready: true,
        }),
        build: async () => {
          revision = 'during';
        },
      }),
    /changed|invalidated/i,
  );
  const cycle = [workspace('a', { b: '*' }), workspace('b', { a: '*' })];
  await assert.rejects(
    () =>
      required('prepareOnce')({
        workspaces: cycle,
        selected: cycle,
        fingerprint: async () => ({ inputs: 'a', outputs: 'b', ready: true }),
        build: async () => {},
      }),
    /cycle/i,
  );
});

test('single-writer lock refuses concurrent writers, preserves foreign locks and releases owned failures', async (t) => {
  const { directory } = await fixture(t);
  const lock = join(directory, 'writer.lock');
  let release;
  let entered;
  const entering = new Promise((resolve) => {
    entered = resolve;
  });
  const holding = required('withWriterLock')(lock, async () => {
    entered();
    await new Promise((resolve) => {
      release = resolve;
    });
  });
  await entering;
  await assert.rejects(
    () => required('withWriterLock')(lock, async () => {}),
    /writer|locked/i,
  );
  const original = await readFile(lock, 'utf8');
  assert.ok(original);
  release();
  await holding;
  await assert.rejects(
    () =>
      required('withWriterLock')(lock, async () => {
        throw new Error('failed');
      }),
    /failed/,
  );
  await required('withWriterLock')(lock, async () => {});
  await writeFile(lock, 'foreign owner');
  await assert.rejects(
    () => required('withWriterLock')(lock, async () => {}),
    /writer|locked/i,
  );
  assert.equal(await readFile(lock, 'utf8'), 'foreign owner');
});

test('focused selection is nonempty, explicit, deduplicated and cannot silently ignore an unmatched selector', () => {
  const files = ['src/A.test.ts', 'src/B.test.ts', 'tests/c.test.mjs'];
  assert.deepEqual(
    required('focusedFiles')(files, ['A.test.ts', 'src\\A.test.ts']),
    ['src/A.test.ts'],
  );
  assert.throws(
    () => required('focusedFiles')(files, []),
    /selector|required/i,
  );
  assert.throws(
    () => required('focusedFiles')(files, ['missing']),
    /zero|matched no/i,
  );
  assert.throws(
    () => required('focusedFiles')(files, ['A.test.ts', 'missing']),
    /zero|matched no/i,
  );
  assert.throws(
    () => required('focusedFiles')(files, ['--unknown']),
    /selector|unsupported/i,
  );
});

test('invocation evidence cannot authorize a different package or tolerate failed checks', async () => {
  const gate = await required('prepareOnce')({
    workspaces: current,
    selected: [current[0]],
    fingerprint: async () => ({
      inputs: 'source',
      outputs: 'built',
      ready: true,
    }),
    build: async () => {},
  });
  await assert.rejects(
    () => gate.check(current[2], async () => {}),
    /not prepared/i,
  );
  await assert.rejects(
    () =>
      gate.check(current[0], async () => {
        throw new Error('assertion failed');
      }),
    /assertion failed/,
  );
});

test('owner-supplied record digests detect byte/name changes and are independent of inventory order', () => {
  const digest = required('hashRecords');
  const records = [
    ['a', Buffer.from('bc')],
    ['b', Buffer.from('de')],
  ];
  assert.equal(digest(records), digest([...records].reverse()));
  assert.notEqual(
    digest([['a', Buffer.from('bc')]]),
    digest([['ab', Buffer.from('c')]]),
  );
  assert.notEqual(
    digest(records),
    digest([['a', Buffer.from('changed')], records[1]]),
  );
});

async function commandFixture(t) {
  required('packageEntry');
  const { directory, put, git } = await fixture(t);
  await put(
    'package.json',
    JSON.stringify({
      workspaces: ['owners/*'],
      scripts: { 'check:root': 'node root-check.mjs' },
    }),
  );
  await put(
    'root-check.mjs',
    `
    import { appendFile } from 'node:fs/promises';
    await appendFile('root-checks.txt', 'checked\\n');
    if (process.env.WARMSEA_FIXTURE_ROOT_FAIL === '1') process.exit(24);
  `,
  );
  const url = new URL('../scripts/workspaces.mjs', import.meta.url).href;
  for (const name of ['base', 'consumer']) {
    const manifest = {
      name,
      dependencies: name === 'consumer' ? { base: 'workspace:*' } : {},
      scripts: {
        'workflow:inputs': 'node adapter.mjs inputs',
        'workflow:select': 'node adapter.mjs select',
        'build:self': 'node adapter.mjs build-self',
        'artifact:build': 'node adapter.mjs artifact-build',
        'artifact:check': 'node adapter.mjs artifact-check',
        'artifact:build:implementation': 'node worker.mjs artifact-build',
        'artifact:check:implementation': 'node worker.mjs artifact-check',
        'check:code': 'node adapter.mjs code',
        'check:local': 'node adapter.mjs local',
        'check:integration': 'node adapter.mjs integration',
        check: 'node adapter.mjs full',
        'check:ci': 'node adapter.mjs ci',
        'test:focused': 'node adapter.mjs focused',
        'test:prepared': 'node adapter.mjs test',
        'typecheck:prepared': 'node adapter.mjs typecheck',
        'build:implementation': 'node worker.mjs build',
        'check:implementation': 'node worker.mjs check',
        'ci:implementation': 'node worker.mjs ci',
      },
    };
    await put(`owners/${name}/package.json`, JSON.stringify(manifest));
    await put(`owners/${name}/source.txt`, 'original');
    await put(
      `owners/${name}/case.test.mjs`,
      'import { test } from "node:test"; test("fixture", () => {});',
    );
    await put(
      `owners/${name}/worker.mjs`,
      `
        import { appendFile, writeFile } from 'node:fs/promises';
        import { basename } from 'node:path';
        const mode = process.argv[2];
        await appendFile('../../events.txt', basename(process.cwd()) + ':' + mode + '\\n');
        if (mode === 'build') await writeFile('output.txt', 'built');
        if (mode === 'check') await writeFile('runtime.json', JSON.stringify({
          executable: process.execPath, node: process.env.NODE, npmNode: process.env.npm_node_execpath,
        }));
        if (mode === 'artifact-check') await writeFile('../../artifact-args.txt', JSON.stringify(process.argv.slice(3)));
        if (mode === 'check' && process.env.WARMSEA_FIXTURE_FAIL === '1') process.exit(23);
        if (mode === 'check' && process.env.WARMSEA_FIXTURE_MUTATE_ROOT === '1')
          await writeFile('../../.gitignore', 'changed policy');
      `,
    );
    await put(
      `owners/${name}/adapter.mjs`,
      `
        import { readFile, writeFile, rename } from 'node:fs/promises';
        import { resolve } from 'node:path';
        import { packageEntry, hashRecords } from ${JSON.stringify(url)};
        const manifest = JSON.parse(await readFile('package.json', 'utf8'));
        const state = async () => {
          if (process.env.WARMSEA_FIXTURE_MUTATE_DISCOVERY === '1' && manifest.name === 'base') {
            const path = '../consumer/package.json';
            const changed = JSON.parse(await readFile(path, 'utf8'));
            if (!changed.dependencies.missing) {
              changed.dependencies.missing = 'workspace:*';
              await writeFile(path + '.next', JSON.stringify(changed));
              await rename(path + '.next', path);
            }
          }
          const output = await readFile('output.txt').catch(() => Buffer.from('missing'));
          return {
            inputs: hashRecords([['source.txt', await readFile('source.txt')]]),
            outputs: hashRecords([['output.txt', output]]),
            ready: output.toString() !== 'missing',
          };
        };
        await packageEntry({
          directory: process.cwd(), root: resolve('../..'), name: manifest.name,
          mode: process.argv[2], selectors: process.argv.slice(3),
          state, files: ['case.test.mjs'], lock: resolve('.artifacts/build.lock'),
          commands: {
            'build-self': [['build:implementation']],
            'artifact-build': [['artifact:build:implementation']],
            'artifact-check': [['artifact:check:implementation']],
            code: [['check:implementation']],
            local: [['check:implementation']],
            integration: [['check:implementation']],
            full: [['check:implementation'], ['ci:implementation']],
            ci: [['check:implementation'], ['ci:implementation']],
            focused: [['check:implementation']],
            test: [['check:implementation']],
            typecheck: [['check:implementation']],
          },
        });
      `,
    );
  }
  return { directory, put, git };
}

function runCLI(directory, args, extraEnv = {}) {
  return execFileSync(
    process.execPath,
    [
      fileURLToPath(new URL('../scripts/workspaces.mjs', import.meta.url)),
      ...args,
      '--root',
      directory,
    ],
    {
      encoding: 'utf8',
      env: { ...process.env, ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
}

test('invalid option values and unsupported full-check selectors fail before preparation', async (t) => {
  const { directory } = await commandFixture(t);
  assert.throws(
    () => runCLI(directory, ['code', 'case.test.mjs']),
    /selectors.*local|focused/i,
  );
  assert.throws(
    () => runCLI(directory, ['ci', '--owner', 'base']),
    /cannot narrow|whole-root/i,
  );
  for (const option of ['--owner', '--base', '--root']) {
    assert.throws(() => runCLI(directory, ['ci', option]), /Missing value/);
  }
  await assert.rejects(() => readFile(join(directory, 'events.txt')), {
    code: 'ENOENT',
  });
});

test('artifact build and consumer wrappers use the same owner lock without recursively preparing dependencies', async (t) => {
  const { directory } = await commandFixture(t);
  const owner = join(directory, 'owners', 'base');
  const invoke = (mode, args = []) =>
    execFileSync(process.execPath, ['adapter.mjs', mode, ...args], {
      cwd: owner,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  await required('withWriterLock')(
    join(owner, '.artifacts', 'build.lock'),
    async () => {
      for (const mode of ['artifact-build', 'artifact-check'])
        assert.throws(() => invoke(mode), /Build writer locked/);
    },
  );
  invoke('artifact-build');
  invoke('artifact-check', ['--grep', 'one']);
  assert.deepEqual(
    JSON.parse(await readFile(join(directory, 'artifact-args.txt'), 'utf8')),
    ['--grep', 'one'],
  );
  assert.equal(
    await readFile(join(directory, 'events.txt'), 'utf8'),
    'base:artifact-build\nbase:artifact-check\n',
  );
});

test('actual complete dispatcher prepares one DAG pass, reuses it for checks and never caches a later invocation', async (t) => {
  const { directory, put } = await commandFixture(t);
  const first = runCLI(directory, ['ci'], {
    NODE: 'untrusted-host-node',
    npm_node_execpath: 'untrusted-host-node',
  });
  const runtime = JSON.parse(
    await readFile(join(directory, 'owners', 'base', 'runtime.json'), 'utf8'),
  );
  assert.equal(runtime.npmNode, runtime.executable);
  assert.match(first, /L3/);
  assert.deepEqual(
    (await readFile(join(directory, 'events.txt'), 'utf8')).trim().split('\n'),
    [
      'base:build',
      'consumer:build',
      'base:check',
      'base:ci',
      'consumer:check',
      'consumer:ci',
    ],
  );
  await put('owners/base/source.txt', 'changed upstream');
  runCLI(directory, ['ci']);
  assert.equal(
    (await readFile(join(directory, 'events.txt'), 'utf8')).split('base:build')
      .length - 1,
    2,
  );
  assert.equal(
    (await readFile(join(directory, 'events.txt'), 'utf8')).split(
      'consumer:build',
    ).length - 1,
    2,
  );
});

test('affected CLI explains absent/invalid baselines and dry runs cannot claim acceptance', async (t) => {
  const { directory, git } = await commandFixture(t);
  git('init', '--quiet');
  for (const args of [
    ['affected', '--explain', '--dry-run'],
    ['affected', '--base', 'absent', '--explain', '--dry-run'],
  ]) {
    const output = runCLI(directory, args);
    assert.match(output, /L3.*full fallback/i);
    assert.match(output, /base/);
    assert.match(output, /consumer/);
    assert.match(output, /not verified|no checks executed/i);
  }
  await assert.rejects(() => readFile(join(directory, 'events.txt')), {
    code: 'ENOENT',
  });
});

test('actual affected gate with a trusted tree checks owner and consumers at L2 without narrowing L3', async (t) => {
  const { directory, put, git } = await commandFixture(t);
  git('init', '--quiet');
  git('add', '.');
  const base = git('write-tree').trim();
  await put('owners/base/source.txt', 'changed');
  const output = runCLI(directory, ['affected', '--base', base, '--explain']);
  assert.match(output, /L2.*affected selection/);
  assert.doesNotMatch(output, /L3|fallback/i);
  assert.deepEqual(
    (await readFile(join(directory, 'events.txt'), 'utf8')).trim().split('\n'),
    ['base:build', 'consumer:build', 'base:check', 'consumer:check'],
  );
});

test('actual full fallback runs the root preflight once and propagates its failure before building', async (t) => {
  const { directory, git } = await commandFixture(t);
  git('init', '--quiet');
  runCLI(directory, ['affected', '--dry-run']);
  await assert.rejects(() => readFile(join(directory, 'root-checks.txt')), {
    code: 'ENOENT',
  });
  assert.throws(
    () => runCLI(directory, ['affected'], { WARMSEA_FIXTURE_ROOT_FAIL: '1' }),
    /check:root|24/,
  );
  assert.equal(
    await readFile(join(directory, 'root-checks.txt'), 'utf8'),
    'checked\n',
  );
  await assert.rejects(() => readFile(join(directory, 'events.txt')), {
    code: 'ENOENT',
  });
  runCLI(directory, ['affected']);
  assert.equal(
    await readFile(join(directory, 'root-checks.txt'), 'utf8'),
    'checked\nchecked\n',
  );
  assert.match(
    await readFile(join(directory, 'events.txt'), 'utf8'),
    /consumer:ci/,
  );
});

test('root policy changes during a check invalidate the actual prepared gate', async (t) => {
  const { directory } = await commandFixture(t);
  assert.throws(
    () => runCLI(directory, ['ci'], { WARMSEA_FIXTURE_MUTATE_ROOT: '1' }),
    /invalidated|changed/i,
  );
  assert.doesNotMatch(
    await readFile(join(directory, 'events.txt'), 'utf8'),
    /consumer:check/,
  );
});

test('actual discovery metadata cannot change before the first owner input snapshot', async (t) => {
  const { directory } = await commandFixture(t);
  assert.throws(
    () => runCLI(directory, ['ci'], { WARMSEA_FIXTURE_MUTATE_DISCOVERY: '1' }),
    /metadata.*changed|discovery.*changed/i,
  );
  await assert.rejects(() => readFile(join(directory, 'events.txt')), {
    code: 'ENOENT',
  });
});

test('unsafe current dependency cycles fail full acceptance before recursive legacy builds', async (t) => {
  const { directory, put } = await commandFixture(t);
  const path = 'owners/base/package.json';
  const manifest = JSON.parse(await readFile(join(directory, path), 'utf8'));
  manifest.dependencies = { consumer: 'workspace:*' };
  await put(path, JSON.stringify(manifest));
  assert.throws(
    () => runCLI(directory, ['ci']),
    /cannot safely prepare.*current dependency graph/i,
  );
  await assert.rejects(() => readFile(join(directory, 'events.txt')), {
    code: 'ENOENT',
  });
});

test('prepared commands without evidence safely prepare, unmatched focused selectors fail before building and failures propagate', async (t) => {
  const { directory } = await commandFixture(t);
  assert.throws(
    () => runCLI(directory, ['local', '--owner', 'consumer', 'missing']),
    /Zero files matched/,
  );
  await assert.rejects(() => readFile(join(directory, 'events.txt')), {
    code: 'ENOENT',
  });
  execFileSync(process.execPath, ['adapter.mjs', 'typecheck'], {
    cwd: join(directory, 'owners', 'consumer'),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.match(
    await readFile(join(directory, 'events.txt'), 'utf8'),
    /base:build\nconsumer:build\nconsumer:check/,
  );
  assert.throws(
    () => runCLI(directory, ['code'], { WARMSEA_FIXTURE_FAIL: '1' }),
    (error) => error.status === 23,
  );
});
