// @vitest-environment node
import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const checkURL = new URL('./package/check.mjs', import.meta.url).href;
const { checkArchive, createConsumer } = await import(checkURL);

function fixture() {
  const manifest = {
    name: '@warmsea/ui-ai',
    type: 'module',
    types: './dist/index.d.ts',
    exports: {
      '.': { import: './dist/index.js', types: './dist/index.d.ts' },
      './style.css': './dist/style.css',
    },
    dependencies: {
      '@warmsea/ui-vue': '0.0.0',
      '@warmsea/ui-tokens': '0.0.0',
    },
    peerDependencies: { vue: '^3.5.0' },
  };
  const files = new Map([
    ['package/dist/index.js', 'export const ChatInput = {};'],
    ['package/dist/index.d.ts', 'export declare const ChatInput: unknown;'],
    ['package/dist/style.css', '.wui-chat-input { display: flex; }'],
  ]);
  function archive() {
    files.set('package/package.json', JSON.stringify(manifest));
    return files;
  }
  return { manifest, files, archive };
}

it('accepts present public targets without packaging or importing a browser runtime', () => {
  const f = fixture();
  expect(() => checkArchive(f.archive())).not.toThrow();
  expect(typeof window).toBe('undefined');
  expect(typeof document).toBe('undefined');
});

it.each([
  ['index.js', "import '@example/application';"],
  ['index.js', "export const load = () => import('@example/application');"],
  ['index.js', "const client = require('@example/application');"],
  ['index.d.ts', "export type Client = import('@example/application').Client;"],
])(
  'rejects undeclared application imports in published %s: %s',
  (file, source) => {
    const f = fixture();
    f.files.set(`package/dist/${file}`, source);
    expect(() => checkArchive(f.archive())).toThrow(/Private dependency/);
  },
);

it('bare consumption resolves the extracted archive, not the owning workspace self-reference', async () => {
  const base = fileURLToPath(
    new URL('../.artifacts/public-import/', import.meta.url),
  );
  await mkdir(base, { recursive: true });
  const directory = await mkdtemp(join(base, 'case-'));
  try {
    const f = fixture();
    const packed = await createConsumer(directory, f.archive());
    const probe = join(directory, 'probe.mjs');
    await writeFile(
      probe,
      `import assert from 'node:assert/strict';
assert.equal(process.versions.node, '24.20.0');
assert.equal(import.meta.resolve('@warmsea/ui-ai'), ${JSON.stringify(pathToFileURL(join(packed, 'dist', 'index.js')).href)});
assert.equal(import.meta.resolve('@warmsea/ui-ai/style.css'), ${JSON.stringify(pathToFileURL(join(packed, 'dist', 'style.css')).href)});
assert.deepEqual(Object.keys(await import('@warmsea/ui-ai')), ['ChatInput']);`,
    );
    const result = spawnSync(process.execPath, [probe], { encoding: 'utf8' });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

for (const kind of ['import', 'types', 'CSS'] as const) {
  const extension = kind === 'CSS' ? 'css' : kind === 'types' ? 'd.ts' : 'js';
  it.each([
    `./dist/missing.${extension}`,
    `../escape.${extension}`,
    `./dist/../index.${extension}`,
    `./dist/empty.${extension}`,
  ])(
    `rejects a broken ${kind} target even when all public export keys and original dist files survive: %s`,
    (value) => {
      const f = fixture();
      f.files.set(`package/dist/empty.${extension}`, '');
      if (kind === 'CSS') f.manifest.exports['./style.css'] = value;
      else f.manifest.exports['.'][kind] = value;
      expect(() => checkArchive(f.archive())).toThrow(/published .*target/);
    },
  );
}

it('rejects an existing JavaScript target published as the stylesheet', () => {
  const f = fixture();
  f.manifest.exports['./style.css'] = './dist/index.js';
  expect(() => checkArchive(f.archive())).toThrow(/published CSS target/);
});
