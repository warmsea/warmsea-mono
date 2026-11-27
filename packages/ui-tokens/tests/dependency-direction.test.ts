// @vitest-environment node
import { glob, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('keeps every dependency path from the base package free of ui-ai and cycles', async () => {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const { workspaces } = JSON.parse(
    await readFile(resolve(root, 'package.json'), 'utf8'),
  );
  const graph = new Map<string, string[]>();
  for await (const path of glob(
    workspaces.map((workspace: string) => `${workspace}/package.json`),
    { cwd: root },
  )) {
    const manifest = JSON.parse(await readFile(resolve(root, path), 'utf8'));
    const dependencies: Record<string, string> = {
      ...manifest.dependencies,
      ...manifest.devDependencies,
      ...manifest.peerDependencies,
      ...manifest.optionalDependencies,
    };
    graph.set(
      manifest.name,
      Object.entries(dependencies).map(
        ([name, value]) =>
          value.match(/^npm:(@[^/]+\/[^@]+|[^@]+)/)?.[1] ?? name,
      ),
    );
  }
  function visit(name: string, path: string[]) {
    expect(name, [...path, name].join(' -> ')).not.toBe('@warmsea/ui-ai');
    expect(path, `dependency cycle at ${name}`).not.toContain(name);
    for (const dependency of graph.get(name) ?? [])
      visit(dependency, [...path, name]);
  }
  visit('@warmsea/ui-tokens', []);
});
