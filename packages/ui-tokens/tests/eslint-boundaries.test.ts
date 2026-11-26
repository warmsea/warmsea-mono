import { fileURLToPath, pathToFileURL } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const directory = fileURLToPath(new URL('../', import.meta.url));
const eslint = new ESLint({ cwd: directory });

async function boundaries(code: string, filename = 'tests/boundary-probe.ts') {
  const [result] = await eslint.lintText(code, {
    filePath: fileURLToPath(new URL(filename, new URL('../', import.meta.url))),
  });
  expect(result.fatalErrorCount).toBe(0);
  return result.messages.filter(
    (message) => message.ruleId === 'ownership/no-cross-package-imports',
  );
}

describe('package import boundaries', () => {
  it.each([
    "import '@warmsea/ui-ai';",
    "export * from '@warmsea/ui-ai';",
    "import('@warmsea/ui-ai/style.css');",
    "type Composer = import('@warmsea/ui-ai').ChatInputProps;",
    "import '../../ui-vue/src/style.css';",
    "export { Button } from '../../ui-vue/src/index';",
    "export * from '../../ui-vue/src/index';",
    "import('../../ui-vue/src/index');",
    'import(`../../ui-vue/src/index`);',
    "require('../../ui-vue/dist/index.js');",
    "type Button = import('../../ui-vue/src/index').Button;",
    "import type { ButtonProps } from '../../ui-vue/src/index';",
    "import Button = require('../../ui-vue/src/index');",
    "import '../../ui-vue/package.json';",
    "import '../../future-package/src/index';",
    "import '../../ui-tokens/../ui-vue/src/index';",
    "import '@warmsea/ui-vue/src/index';",
    "export * from '@warmsea/ui-vue/dist/index.js';",
  ])('rejects %s', async (code) => {
    expect(await boundaries(code)).toHaveLength(1);
  });

  it.each([
    "import '../src/index.css';",
    "import './tokens.test';",
    "import { readFile } from 'node:fs/promises';",
    "import { describe } from 'vitest';",
    "import '@warmsea/ui-tokens/style.css';",
  ])('allows %s', async (code) => {
    expect(await boundaries(code)).toEqual([]);
  });

  it('checks JavaScript configuration and script files', async () => {
    expect(
      await boundaries(
        "import '../../ui-vue/src/index.js';",
        'scripts/boundary-probe.mjs',
      ),
    ).toHaveLength(1);
  });

  it('checks absolute paths and file URLs', async () => {
    const target = new URL('../../ui-vue/src/index.ts', import.meta.url);
    for (const source of [
      fileURLToPath(target),
      pathToFileURL(fileURLToPath(target)).href,
    ]) {
      expect(
        await boundaries(`import ${JSON.stringify(source)};`),
      ).toHaveLength(1);
    }
  });

  it.each([
    'file://%invalid/index.ts',
    'file:///C:/bad%ZZ.ts',
    'file:///C:/bad%2Fname.ts',
  ])('reports an invalid file URL without crashing: %s', async (source) => {
    await expect(
      boundaries(`import ${JSON.stringify(source)};`),
    ).resolves.toEqual([
      expect.objectContaining({ messageId: 'invalidFileURL' }),
    ]);
  });
});
