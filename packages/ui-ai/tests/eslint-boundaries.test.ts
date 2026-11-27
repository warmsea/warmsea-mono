// @vitest-environment node
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { expect, it } from 'vitest';
const eslint = new ESLint({
  cwd: fileURLToPath(new URL('../', import.meta.url)),
});
it.each([
  "import '@example/application';",
  "import('@example/application/contracts');",
  "type Input = import('@example/application/contracts').Input;",
  "import '../../ui-vue/src/index.ts';",
  "require('@warmsea/ui-vue/dist/index.js');",
  "import { Context } from '@example/backend-runtime';",
])('rejects application/private production dependency: %s', async (code) => {
  const [result] = await eslint.lintText(code, { filePath: 'src/probe.ts' });
  expect(result.fatalErrorCount).toBe(0);
  expect(
    result.messages.filter(
      (message) => message.ruleId === 'ownership/boundary',
    ),
  ).toHaveLength(1);
});
it.each([
  "import { ref } from 'vue';",
  "import { Textarea } from '@warmsea/ui-vue';",
  "import '@warmsea/ui-tokens/style.css';",
  "export { default as ChatInput } from './components/chat-input/ChatInput.vue';",
])('accepts public UI production dependency: %s', async (code) => {
  const [result] = await eslint.lintText(code, { filePath: 'src/probe.ts' });
  expect(
    result.messages.filter(
      (message) => message.ruleId === 'ownership/boundary',
    ),
  ).toEqual([]);
});
