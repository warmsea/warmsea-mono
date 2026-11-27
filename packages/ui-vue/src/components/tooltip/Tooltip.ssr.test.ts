// @vitest-environment node
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { expect, it } from 'vitest';
import Tooltip from './Tooltip.vue';

it('server-renders a hidden target and stable description binding without browser work in Node', async () => {
  expect(typeof window).toBe('undefined');
  expect(typeof document).toBe('undefined');
  expect(typeof requestAnimationFrame).toBe('undefined');
  expect(typeof ResizeObserver).toBe('undefined');
  const app = createSSRApp({
    render: () =>
      h(
        Tooltip,
        { text: 'Server help' },
        {
          default: ({ describedBy }: { describedBy: string | undefined }) =>
            h('button', { 'aria-describedby': describedBy }, 'Trigger'),
        },
      ),
  });
  const html = await renderToString(app);
  expect(html).toContain('aria-describedby="wui-tooltip-');
  expect(html).toContain('role="tooltip" popover="manual" hidden');
});
