import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readdir,
  rm,
  cp,
  writeFile,
  readFile,
  symlink,
} from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const tmp = await mkdtemp(join(tmpdir(), 'octo-copilot-consumer-'));
try {
  assert.equal(globalThis.Bun?.version, '1.4.3');
  execFileSync(process.execPath, ['pm', 'pack', '--destination', tmp], {
    stdio: 'pipe',
  });
  const archive = (await readdir(tmp)).find((name) => name.endsWith('.tgz'));
  assert.ok(archive);
  const dest = join(tmp, 'node_modules', '@warmsea', 'octo-agent-copilot');
  await mkdir(dest, { recursive: true });
  execFileSync('tar', [
    '-xf',
    join(tmp, archive),
    '--strip-components=1',
    '-C',
    dest,
  ]);
  const { dependencies } = JSON.parse(
    await readFile(join(dest, 'package.json'), 'utf8'),
  );
  for (const [name, version] of Object.entries(dependencies)) {
    assert.ok(!version.startsWith('workspace:'));
    const [scope, pkg] = name.split('/');
    const installed = JSON.parse(
      await readFile(
        resolve('node_modules', scope, pkg, 'package.json'),
        'utf8',
      ),
    );
    assert.ok(Bun.semver.satisfies(installed.version, version));
    const directory = join(tmp, 'node_modules', scope);
    await mkdir(directory, { recursive: true });
    await symlink(
      resolve('node_modules', scope, pkg),
      join(directory, pkg),
      'junction',
    );
  }
  await writeFile(join(tmp, 'package.json'), '{"type":"module"}');
  await mkdir(join(tmp, 'node_modules', '@types'));
  await symlink(
    resolve('node_modules', '@types', 'node'),
    join(tmp, 'node_modules', '@types', 'node'),
    'junction',
  );
  await cp('examples/chat.ts', join(tmp, 'consumer.ts'));
  const node = 'node';
  execFileSync(
    node,
    [
      require.resolve('typescript/bin/tsc'),
      '--ignoreConfig',
      '--strict',
      '--types',
      'node',
      '--skipLibCheck',
      '--module',
      'nodenext',
      '--target',
      'es2022',
      'consumer.ts',
    ],
    { cwd: tmp },
  );
  assert.match(
    execFileSync(node, ['consumer.js'], { cwd: tmp, encoding: 'utf8' }),
    /approvals: true/,
  );
} finally {
  await rm(tmp, { recursive: true, force: true });
}
