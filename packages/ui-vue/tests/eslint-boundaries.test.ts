// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const directory = fileURLToPath(new URL('../', import.meta.url));
const eslint = new ESLint({ cwd: directory });

async function lint(code: string, filename: string) {
  const [result] = await eslint.lintText(code, {
    filePath: fileURLToPath(new URL(filename, new URL('../', import.meta.url))),
  });
  expect(result.fatalErrorCount).toBe(0);
  return result.messages;
}

async function boundaries(code: string, filename = 'src/boundary-probe.ts') {
  return (await lint(code, filename)).filter(
    (message) => message.ruleId === 'ownership/no-cross-package-imports',
  );
}

describe('TypeScript lint coverage', () => {
  it.each(['ts', 'vue'])(
    'rejects unused imports, unused variables and explicit any in %s files',
    async (extension) => {
      const script = 'import { ref } from "vue"; const unusedValue: any = 1;';
      const code =
        extension === 'vue'
          ? `<script setup lang="ts">${script}</script><template><button>Probe</button></template>`
          : script;
      const messages = await lint(code, `src/CleanupProbe.${extension}`);
      expect(messages.map((message) => message.ruleId).sort()).toEqual([
        '@typescript-eslint/no-explicit-any',
        '@typescript-eslint/no-unused-vars',
        '@typescript-eslint/no-unused-vars',
      ]);
    },
  );

  it('preserves Vue template usage and typed script setup macros', async () => {
    expect(
      await lint(
        `<script setup lang="ts">
import { ref } from 'vue';
import Button from './components/button/Button.vue';
interface Props { label?: string }
const props = withDefaults(defineProps<Props>(), { label: 'Set sail' });
const count = ref(0);
</script>
<template>
  <Button @click="count++">{{ props.label }} {{ count }}</Button>
</template>`,
        'src/CleanupProbe.vue',
      ),
    ).toEqual([]);
  });
});

describe('package import boundaries', () => {
  it.each([
    "import '@warmsea/ui-ai';",
    "export * from '@warmsea/ui-ai';",
    "import('@warmsea/ui-ai/style.css');",
    "type Composer = import('@warmsea/ui-ai').ChatInputProps;",
    "import '../../ui-tokens/src/index.css';",
    "export { tokens } from '../../ui-tokens/src/index';",
    "export * from '../../ui-tokens/src/index';",
    "import('../../ui-tokens/src/index.css');",
    'import(`../../ui-tokens/src/index.css`);',
    "require('../../ui-tokens/dist/style.css');",
    "type Token = import('../../ui-tokens/src/index').Token;",
    "import type { Token } from '../../ui-tokens/src/index';",
    "import tokens = require('../../ui-tokens/src/index');",
    "import '../../ui-tokens/package.json';",
    "import '../../future-package/src/index';",
    "import '../../ui-vue/../ui-tokens/src/index.css';",
    "import '@warmsea/ui-tokens/src/index.css';",
    "export * from '@warmsea/ui-tokens/dist/style.css';",
  ])('rejects %s', async (code) => {
    expect(await boundaries(code)).toHaveLength(1);
  });

  it.each([
    "import './components/button/Button.vue';",
    "import '../docs/token-reference';",
    "import { ref } from 'vue';",
    "import '@warmsea/ui-tokens/style.css';",
    "import { Button } from '@warmsea/ui-vue';",
  ])('allows %s', async (code) => {
    expect(await boundaries(code)).toEqual([]);
  });

  it('checks Vue single-file components', async () => {
    expect(
      await boundaries(
        '<script setup lang="ts">import "../../../../ui-tokens/src/index.css";</script><template><button /></template>',
        'src/components/button/BoundaryProbe.vue',
      ),
    ).toHaveLength(1);
  });

  it('checks JavaScript configuration and script files', async () => {
    expect(
      await boundaries(
        "import '../../ui-tokens/src/index.css';",
        'scripts/boundary-probe.mjs',
      ),
    ).toHaveLength(1);
  });

  it('checks absolute paths and file URLs', async () => {
    const target = new URL('../../ui-tokens/src/index.css', import.meta.url);
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

  it.each([
    ['docs/token-reference.ts', '../../ui-tokens/src/index.css?raw'],
    ['.storybook/preview.ts', '../../ui-tokens/src/index.css'],
  ])(
    'preserves only the exact token import in %s',
    async (filename, source) => {
      const actual = await readFile(
        new URL(filename, new URL('../', import.meta.url)),
        'utf8',
      );
      expect(await boundaries(actual, filename)).toEqual([]);
      expect(
        await boundaries(`import ${JSON.stringify(source)};`, filename),
      ).toEqual([]);
      expect(
        await boundaries(`import ${JSON.stringify(source)};`),
      ).toHaveLength(1);
      expect(
        await boundaries("import '../../ui-tokens/src/private.css';", filename),
      ).toHaveLength(1);
      expect(
        await boundaries(
          `import ${JSON.stringify(`${source}&extra`)};`,
          filename,
        ),
      ).toHaveLength(1);
    },
  );
});
