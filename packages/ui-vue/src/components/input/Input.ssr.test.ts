// @vitest-environment node
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { expect, it } from 'vitest';
import Input from './Input.vue';

it('uses unique SSR-safe IDs in Node without browser globals', async () => {
  expect(typeof window).toBe('undefined');
  expect(typeof document).toBe('undefined');
  const html = await renderToString(
    createSSRApp({
      render: () =>
        h('div', [
          h(Input, { modelValue: '', label: 'First' }),
          h(Input, { modelValue: '', label: 'Second' }),
        ]),
    }),
  );
  const ids = [...html.matchAll(/<input[^>]* id="([^"]+)"/g)].map(
    (match) => match[1],
  );
  expect(ids).toHaveLength(2);
  expect(new Set(ids).size).toBe(2);
  for (const id of ids) expect(html).toContain(`for="${id}"`);
});
