import { glob, lstat, readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashRecords, packageEntry } from '../../../scripts/workspaces.mjs';

const file = fileURLToPath(import.meta.url);
const directory = resolve(file, '../..');
const root = resolve(directory, '../..');
const inputDirectories = ['src', 'scripts', 'tests', 'examples'];
const requiredOutputs = ['dist/style.css'];

async function tree(path, prefix, inputs = false) {
  let entries;
  try {
    entries = await readdir(path, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT')
      return [[prefix, Buffer.from('missing-directory')]];
    throw error;
  }
  const records = await Promise.all(
    entries.map(async (entry) => {
      const name = `${prefix}/${entry.name}`;
      if (inputs && ['node_modules', '.artifacts', '.git'].includes(entry.name))
        return [];
      if (entry.isSymbolicLink())
        throw new Error(`Unknown symbolic verification input: ${name}`);
      if (entry.isDirectory())
        return tree(join(path, entry.name), name, inputs);
      if (entry.isFile())
        return [[name, await readFile(join(path, entry.name))]];
      throw new Error(`Unsupported verification input: ${name}`);
    }),
  );
  return records.flat();
}

export async function inspect(owner = directory) {
  const inputs = [];
  for await (const path of glob(
    [
      'package.json',
      'README.md',
      'AGENTS.md',
      '*.mjs',
      '*.config.*',
      'tsconfig*.json',
      '.prettier*',
      '*.yml',
      '*.yaml',
      '*.html',
      '.gitignore',
      '.gitattributes',
    ],
    { cwd: owner },
  )) {
    if (!(await lstat(join(owner, path))).isFile())
      throw new Error(`Unknown root input: ${path}`);
    inputs.push([
      path.replaceAll('\\', '/'),
      await readFile(join(owner, path)),
    ]);
  }
  inputs.push(
    ...(
      await Promise.all(
        inputDirectories.map((path) => tree(join(owner, path), path, true)),
      )
    ).flat(),
  );
  const outputs = await tree(join(owner, 'dist'), 'dist');
  const ready = (
    await Promise.all(
      requiredOutputs.map(async (path) => {
        try {
          return (await lstat(join(owner, path))).isFile();
        } catch (error) {
          if (error.code === 'ENOENT') return false;
          throw error;
        }
      }),
    )
  ).every(Boolean);
  return { inputs: hashRecords(inputs), outputs: hashRecords(outputs), ready };
}

if (process.argv[1] && resolve(process.argv[1]) === file) {
  const manifest = JSON.parse(
    await readFile(join(directory, 'package.json'), 'utf8'),
  );
  const files = [];
  for await (const path of glob(['tests/**/*.test.ts'], { cwd: directory })) {
    files.push(path.replaceAll('\\', '/'));
  }
  await packageEntry({
    directory,
    root,
    name: manifest.name,
    mode: process.argv[2],
    selectors: process.argv.slice(3),
    state: inspect,
    files,
    lock: join(directory, '.artifacts', 'workflow', 'build.lock'),
    commands: (selected) => {
      const preflight = [
        ['format:check'],
        ['lint'],
        ['typecheck:implementation'],
      ];
      const unit = ['test:implementation'];
      const focused = ['test:implementation', ...selected];
      const code = [...preflight, unit];
      return {
        'build-self': [['build:implementation']],
        'legacy-prepare': [['build:self']],
        code,
        full: code,
        ci: code,
        local: [...preflight, focused],
        integration: code,
        test: [unit],
        focused: [focused],
        typecheck: [['typecheck:implementation']],
      };
    },
  });
}
