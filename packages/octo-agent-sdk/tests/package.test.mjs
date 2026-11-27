import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  cp,
  readFile,
  readdir,
  writeFile,
  rm,
} from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
const require = createRequire(import.meta.url);
async function checkPackage() {
  assert.equal(globalThis.Bun?.version, '1.4.3');
  const node = process.env.NODE ?? 'node';
  const base = resolve('.artifacts', 'package');
  await mkdir(base, { recursive: true });
  const temp = await mkdtemp(join(base, 'run-'));
  try {
    execFileSync(process.execPath, ['pm', 'pack', '--destination', temp], {
      stdio: 'pipe',
    });
    const archive = (await readdir(temp)).find((n) => n.endsWith('.tgz'));
    assert.ok(archive);
    const dest = join(temp, 'node_modules', '@warmsea', 'octo-agent-sdk');
    await mkdir(dest, { recursive: true });
    execFileSync('tar', [
      '-xf',
      join(temp, archive),
      '--strip-components=1',
      '-C',
      dest,
    ]);
    await cp(
      dirname(require.resolve('zod/package.json')),
      join(temp, 'node_modules', 'zod'),
      { recursive: true },
    );
    await writeFile(join(temp, 'package.json'), '{"type":"module"}');
    const example = await readFile('examples/text-provider.ts', 'utf8');
    await writeFile(join(temp, 'consumer.ts'), example);
    execFileSync(
      node,
      [
        require.resolve('typescript/bin/tsc'),
        '--ignoreConfig',
        '--strict',
        '--skipLibCheck',
        '--module',
        'nodenext',
        '--target',
        'es2022',
        'consumer.ts',
      ],
      { cwd: temp },
    );
    execFileSync(node, ['consumer.js'], { cwd: temp });
    await writeFile(
      join(temp, 'surface.mjs'),
      `import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
const hook=registerHooks({resolve(specifier,context,next){if(specifier.includes('/bridge'))throw Error('unexpected bridge import');return next(specifier,context)}});
await import('@warmsea/octo-agent-sdk');hook.deregister();
const {connectProvider}=await import('@warmsea/octo-agent-sdk/bridge');
assert.equal(typeof connectProvider,'function');
const {default:s}=await import('@warmsea/octo-agent-sdk/schemas/octo.agent.v1.json',{with:{type:'json'}});
assert.ok(s.$defs.event);
function verifyRefs(value){
  if(!value || typeof value!=='object')return;
  if(value.$ref)assert.ok(value.$ref.slice(2).split('/').reduce((node,segment)=>node?.[segment],s),'Missing '+value.$ref);
  Object.values(value).forEach(verifyRefs);
}
verifyRefs(s);
await assert.rejects(import('@warmsea/octo-agent-sdk/dist/contract.js'),{code:'ERR_PACKAGE_PATH_NOT_EXPORTED'});`,
    );
    execFileSync(node, ['surface.mjs'], { cwd: temp });
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
await checkPackage();
