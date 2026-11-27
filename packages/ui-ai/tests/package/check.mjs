import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import ts from 'typescript';
function target(files, value, description) {
  assert.ok(
    typeof value === 'string' &&
      /^\.\/[\w./-]+$/.test(value) &&
      value
        .slice(2)
        .split('/')
        .every((part) => part && part !== '.' && part !== '..'),
    `Unsafe published ${description} target: ${value}`,
  );
  const key = `package/${value.slice(2)}`;
  assert.ok(
    files.get(key)?.trim(),
    `Missing or empty published ${description} target: ${value}`,
  );
  if (description === 'CSS')
    assert.ok(
      value.endsWith('.css'),
      'Invalid published CSS target: expected a stylesheet',
    );
  return key;
}

export function checkArchive(files) {
  const manifest = JSON.parse(files.get('package/package.json'));
  assert.equal(manifest.name, '@warmsea/ui-ai');
  assert.equal(manifest.type, 'module');
  assert.deepEqual(Object.keys(manifest.exports).sort(), ['.', './style.css']);
  assert.deepEqual(Object.keys(manifest.dependencies).sort(), [
    '@warmsea/ui-tokens',
    '@warmsea/ui-vue',
  ]);
  assert.equal(manifest.peerDependencies.vue, '^3.5.0');
  for (const version of Object.values(manifest.dependencies))
    assert.ok(!version.startsWith('workspace:'));
  target(files, manifest.exports['.'].import, 'import');
  target(files, manifest.exports['.'].types, 'types');
  target(files, manifest.exports['./style.css'], 'CSS');
  if (manifest.types) target(files, manifest.types, 'legacy types');
  const dependencies = [
    ...Object.keys(manifest.dependencies),
    ...Object.keys(manifest.peerDependencies),
  ];
  for (const [path, text] of files) {
    assert.ok(
      path.startsWith('package/') &&
        path
          .split('/')
          .every(
            (part) =>
              part && part !== '.' && part !== '..' && !part.includes('\\'),
          ),
      `Unsafe archive path: ${path}`,
    );
    assert.ok(
      !/\.test\.|\.stories\.|\.demo\.|\.mdx$|\.d\.ts\.map$/.test(path),
      `Development file in archive: ${path}`,
    );
    if (path.startsWith('package/dist/') || path === 'package/package.json')
      assert.ok(
        !text.includes('../../ui-vue'),
        `Private dependency in ${path}`,
      );
    if (/\.(?:js|d\.ts)$/.test(path)) {
      for (const { fileName } of ts.preProcessFile(text, true, true)
        .importedFiles)
        assert.ok(
          fileName.startsWith('.') ||
            dependencies.some(
              (dependency) =>
                fileName === dependency ||
                fileName === `${dependency}/style.css`,
            ),
          `Private dependency ${fileName} in ${path}`,
        );
    }
  }
  return manifest;
}

export async function createConsumer(directory, files) {
  checkArchive(files);
  await writeFile(
    join(directory, 'package.json'),
    JSON.stringify({
      name: 'ui-ai-packed-consumer',
      private: true,
      type: 'module',
    }),
  );
  const packed = join(directory, 'node_modules', '@warmsea', 'ui-ai');
  for (const [path, text] of files) {
    const extracted = join(packed, path.slice('package/'.length));
    await mkdir(dirname(extracted), { recursive: true });
    await writeFile(extracted, text);
  }
  return packed;
}

async function main() {
  assert.equal(
    globalThis.Bun?.version,
    '1.4.3',
    'Packaging requires Bun 1.4.3',
  );
  const directory = fileURLToPath(new URL('../../', import.meta.url));
  const artifacts = join(directory, '.artifacts', 'package');
  await mkdir(artifacts, { recursive: true });
  const temporary = await mkdtemp(join(artifacts, 'run-'));
  const require = createRequire(import.meta.url);
  const node = process.env.NODE ?? 'node';
  try {
    assert.equal(
      execFileSync(node, ['-p', 'process.versions.node'], {
        encoding: 'utf8',
      }).trim(),
      '24.20.0',
    );
    const typescript = execFileSync(
      node,
      [require.resolve('typescript/bin/tsc'), '--version'],
      { encoding: 'utf8' },
    ).trim();
    assert.equal(typescript, 'Version 6.0.3');
    execFileSync(process.execPath, ['pm', 'pack', '--destination', temporary], {
      cwd: directory,
      stdio: 'pipe',
    });
    const { readdir } = await import('node:fs/promises');
    const archive = (await readdir(temporary)).find((name) =>
      name.endsWith('.tgz'),
    );
    assert.ok(archive);
    const bytes = gunzipSync(await readFile(join(temporary, archive)));
    const files = new Map();
    for (let offset = 0; offset + 512 <= bytes.length;) {
      const header = bytes.subarray(offset, offset + 512);
      const name = header.subarray(0, 100).toString().replace(/\0.*$/, '');
      if (!name) break;
      const prefix = header.subarray(345, 500).toString().replace(/\0.*$/, '');
      const path = prefix ? `${prefix}/${name}` : name;
      const size =
        parseInt(
          header.subarray(124, 136).toString().replace(/\0.*$/, '').trim(),
          8,
        ) || 0;
      if (header[156] === 0 || header[156] === 48)
        files.set(
          path,
          bytes.subarray(offset + 512, offset + 512 + size).toString(),
        );
      offset += 512 + Math.ceil(size / 512) * 512;
    }
    const manifest = checkArchive(files);
    const css = files.get(
      target(files, manifest.exports['./style.css'], 'CSS'),
    );
    assert.ok(css?.includes('.wui-chat-input'));
    const tokenCSS = await readFile(
      fileURLToPath(import.meta.resolve('@warmsea/ui-tokens/style.css')),
      'utf8',
    );
    const tokens = new Set(
      [...tokenCSS.matchAll(/(--wui-[\w-]+)\s*:/g)].map((match) => match[1]),
    );
    for (const match of css.matchAll(/var\((--wui-[\w-]+)/g)) {
      assert.ok(
        tokens.has(match[1]) || match[1] === '--wui-chat-input-max-block-size',
        `Unknown token ${match[1]}`,
      );
    }
    const packed = await createConsumer(temporary, files);
    const runtimeCheck = join(temporary, 'runtime.mjs');
    await writeFile(
      runtimeCheck,
      `import assert from 'node:assert/strict';
assert.equal(process.versions.node, '24.20.0');
assert.equal(typeof window, 'undefined');
assert.equal(typeof document, 'undefined');
assert.equal(import.meta.resolve('@warmsea/ui-ai'), ${JSON.stringify(pathToFileURL(join(packed, manifest.exports['.'].import)).href)});
const library = await import('@warmsea/ui-ai');
assert.deepEqual(Object.keys(library), ['ChatInput']);
assert.equal(typeof library.ChatInput, 'object');
const stylesheet = import.meta.resolve('@warmsea/ui-ai/style.css');
assert.equal(stylesheet, ${JSON.stringify(pathToFileURL(join(packed, manifest.exports['./style.css'])).href)});
assert.equal(typeof window, 'undefined');
assert.equal(typeof document, 'undefined');
console.log('Packed consumer Node=' + process.versions.node);`,
    );
    const runtime = spawnSync(node, [runtimeCheck], {
      cwd: directory,
      encoding: 'utf8',
    });
    if (runtime.error) throw runtime.error;
    assert.equal(runtime.status, 0, runtime.stderr);
    const fixture = join(temporary, 'consumer.ts');
    await writeFile(
      fixture,
      `import { ChatInput, type ChatInputProps, type ChatInputSlotState } from '@warmsea/ui-ai';
const component: import('vue').Component = ChatInput;
const props: ChatInputProps = { modelValue: '', label: 'Message', submitLabel: 'Send', canSubmit: true };
const state: ChatInputSlotState = { disabled: false, canSubmit: true, isComposing: false };
declare const instance: InstanceType<typeof ChatInput>;
instance.focus();
instance.$emit('submit', props.modelValue);
instance.$emit('update:modelValue', props.modelValue);
instance.$emit('reset', new Event('reset'));
const resetHandler: NonNullable<InstanceType<typeof ChatInput>['$props']['onReset']> = (event) => {
  const original: Event = event;
  original.preventDefault();
};
const attachmentSlot: typeof instance.$slots.attachments = (slot) => {
  const disabled: boolean = slot.disabled;
  const canSubmit: boolean = slot.canSubmit;
  const composing: boolean = slot.isComposing;
  void [disabled, canSubmit, composing];
  return [];
};
const submitSlot: typeof instance.$slots['submit-content'] = attachmentSlot;
// @ts-expect-error string-only model
props.modelValue = 1;
// @ts-expect-error controlled required props
const missingModel: ChatInputProps = { label: 'Message', submitLabel: 'Send', canSubmit: true };
// @ts-expect-error submit values are strings
instance.$emit('submit', 1);
// @ts-expect-error updates are strings
instance.$emit('update:modelValue', null);
// @ts-expect-error reset carries the original Event, not a draft
instance.$emit('reset', props.modelValue);
// @ts-expect-error reset requires its native Event
instance.$emit('reset');
// @ts-expect-error no application-specific send event
instance.$emit('send', '');
// @ts-expect-error slot state uses boolean flags
attachmentSlot({ disabled: 'yes', canSubmit: true, isComposing: false });
void [component, state, submitSlot, missingModel, resetHandler];`,
    );
    const types = spawnSync(
      node,
      [
        require.resolve('typescript/bin/tsc'),
        '--ignoreConfig',
        '--noEmit',
        '--strict',
        '--module',
        'ESNext',
        '--moduleResolution',
        'bundler',
        '--target',
        'ES2022',
        fixture,
      ],
      { cwd: directory, encoding: 'utf8' },
    );
    if (types.error) throw types.error;
    assert.equal(types.status, 0, `${types.stdout}\n${types.stderr}`);
    console.log(
      `Packed bare ESM/types/CSS exports, real component events/slots/focus and dependency contracts passed. ${runtime.stdout.trim()}; TypeScript ${typescript}`,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

if (import.meta.main) await main();
