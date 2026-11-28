import { glob, lstat, readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { hashRecords, packageEntry } from '../../../scripts/workspaces.mjs';
const directory = resolve(import.meta.dirname, '..'),
  root = resolve(directory, '../..');
async function inspect() {
  const inputs = [],
    outputs = [];
  async function walk(dir, prefix) {
    for (const item of await readdir(dir, { withFileTypes: true })) {
      if (!prefix && ['.artifacts', 'node_modules', '.git'].includes(item.name))
        continue;
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      const file = join(dir, item.name);
      if (item.isDirectory()) await walk(file, path);
      else if (item.isFile())
        (path.startsWith('dist/') ? outputs : inputs).push([
          path,
          await readFile(file),
        ]);
      else throw Error(`Unexpected build input: ${path}`);
    }
  }
  await walk(directory, '');
  const required = ['index.js', 'index.d.ts'];
  return {
    inputs: hashRecords(inputs),
    outputs: hashRecords(outputs),
    ready: required.every((f) =>
      outputs.some(([path]) => path === `dist/${f}`),
    ),
  };
}
const files = [];
for await (const file of glob('tests/**/*.test.ts', { cwd: directory })) {
  if ((await lstat(join(directory, file))).isFile())
    files.push(file.replaceAll('\\', '/'));
}
await packageEntry({
  directory,
  root,
  name: '@warmsea/octo-agent-copilot',
  mode: process.argv[2],
  selectors: process.argv.slice(3),
  state: inspect,
  files,
  lock: join(directory, '.artifacts', 'workflow', 'build.lock'),
  commands(selected) {
    const pre = [['format:check'], ['lint'], ['typecheck:implementation']];
    const unit = ['test:implementation'],
      focused = [...unit, ...selected];
    const full = [...pre, unit, ['test:package']];
    return {
      'build-self': [['build:implementation']],
      'legacy-prepare': [['build:dependencies'], ['build:self']],
      local: [...pre, focused],
      focused: [focused],
      test: [unit],
      typecheck: [['typecheck:implementation']],
      code: full,
      integration: full,
      full,
      ci: full,
    };
  },
});
