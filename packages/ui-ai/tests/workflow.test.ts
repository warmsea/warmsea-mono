// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';

type State = { inputs: string; outputs: string; ready: boolean };
let inspect: ((directory: string) => Promise<State>) | undefined;
try {
  ({ inspect } = await import(
    new URL('../scripts/check-workspace.mjs', import.meta.url).href
  ));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ERR_MODULE_NOT_FOUND')
    throw error;
}

const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporary
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function fixture() {
  expect(inspect, 'owner input/output inventory is not implemented').toBeTypeOf(
    'function',
  );
  const parent = fileURLToPath(
    new URL('../.artifacts/workflow-tests/', import.meta.url),
  );
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(join(parent, 'case-'));
  temporary.push(directory);
  const put = async (path: string, content: string) => {
    await mkdir(join(directory, path, '..'), { recursive: true });
    await writeFile(join(directory, path), content);
  };
  await put('package.json', '{}');
  await put('src/control.ts', 'export const control = 1;');
  return { directory, put, state: () => inspect!(directory) };
}

it('invalidates modified, new untracked and deleted source inputs', async () => {
  const { directory, put, state } = await fixture();
  const initial = await state();
  await put('src/control.ts', 'export const control = 2;');
  const edited = await state();
  expect(edited.inputs).not.toBe(initial.inputs);
  await put('src/untracked.ts', 'export const other = 1;');
  expect((await state()).inputs).not.toBe(edited.inputs);
  await rm(join(directory, 'src', 'untracked.ts'));
  expect((await state()).inputs).toBe(edited.inputs);
});

it('requires public output artifacts and detects output mutation without treating a build as a source edit', async () => {
  const { put, directory, state } = await fixture();
  const before = await state();
  expect(before.ready).toBe(false);
  for (const file of ['index.js', 'index.d.ts', 'style.css'])
    await put(`dist/${file}`, 'public artifact');
  const built = await state();
  expect(built.ready).toBe(true);
  expect(built.inputs).toBe(before.inputs);
  await put('dist/style.css', '.wui-chat-input { color: red; }');
  expect((await state()).outputs).not.toBe(built.outputs);
  await rm(join(directory, 'dist', 'index.d.ts'));
  expect((await state()).ready).toBe(false);
});

it('ignores generated reports but includes owner examples, tooling and Storybook inputs', async () => {
  const { put, state } = await fixture();
  const before = await state();
  await put('.artifacts/run/output.log', 'generated');
  await put('coverage/report.json', '{}');
  expect(await state()).toEqual(before);
  for (const file of [
    '.storybook/main.ts',
    'scripts/check.mjs',
    'examples/main.ts',
    'app.yml',
    '.gitignore',
  ]) {
    const earlier = await state();
    await put(file, 'export {};');
    expect((await state()).inputs).not.toBe(earlier.inputs);
  }
});
