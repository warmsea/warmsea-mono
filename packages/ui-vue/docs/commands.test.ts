// @vitest-environment node
import { readFile, readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const manifest = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
);
const guides = [
  '../README.md',
  '../AGENTS.md',
  '../src/components/button/Button.mdx',
  ...(await readdir(new URL('./', import.meta.url))).filter((name) =>
    name.endsWith('.mdx'),
  ),
];

describe('documented package commands', () => {
  it('uses source-hosted links in shipped READMEs and rendered guides', async () => {
    const pages = ['../README.md', 'Installation.mdx'];
    for (const path of pages) {
      const source = await readFile(new URL(path, import.meta.url), 'utf8');
      for (const [, inline, reference] of source.matchAll(
        /\]\(([^)]+)\)|^\[[^\]]+\]:\s+(\S+)/gm,
      )) {
        const target = inline ?? reference!;
        expect(target, `${path} has a checkout-only link`).toMatch(
          /^https:\/\/github\.com\/warmsea\/warmsea-mono\/blob\/main\//,
        );
        const relative = target.split('/blob/main/')[1]!.split('#')[0]!;
        expect(
          await readFile(
            new URL(`../../../${relative}`, import.meta.url),
            'utf8',
          ),
          `${path} links to an unavailable source target`,
        ).not.toBe('');
      }
    }
  });
  it.each(guides)('%s references available scripts', async (path) => {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    for (const [, command] of source.matchAll(/\bbun run ([\w:-]+)/g)) {
      expect(
        Object.hasOwn(manifest.scripts, command),
        `${path} references missing script "${command}"`,
      ).toBe(true);
    }
  });
});
