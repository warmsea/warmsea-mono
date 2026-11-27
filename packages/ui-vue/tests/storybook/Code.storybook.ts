import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
test('getting-started-installation highlights Vue without changing the example or its Copy control', async ({
  page,
  context,
}) => {
  const mdx = readFileSync(
    new URL('../../docs/Installation.mdx', import.meta.url),
    'utf8',
  );
  const example = mdx
    .match(/```vue\r?\n([\s\S]*?)\r?\n```/)?.[1]
    ?.replace(/\r\n/g, '\n');
  expect(example).toBeTruthy();

  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(
    '/iframe.html?id=getting-started-installation--docs&viewMode=docs',
  );
  const code = page
    .getByRole('main')
    .locator('pre.shiki:visible')
    .filter({ hasText: '<script setup lang="ts">' });
  await expect(code).toHaveCount(1);
  await expect.poll(() => code.textContent()).toBe(example);
  await expect(code.locator('span[style*="color"]').first()).toBeVisible();

  const source = page
    .locator('.docblock-source')
    .filter({ hasText: '<script setup lang="ts">' });
  await source.getByRole('button', { name: 'Copy', exact: true }).click();
  await expect
    .poll(async () =>
      (await page.evaluate(() => navigator.clipboard.readText())).replace(
        /\r\n/g,
        '\n',
      ),
    )
    .toBe(example);

  await page.setViewportSize({ width: 320, height: 900 });
  await expect(code).toBeVisible();
  const layout = await source.evaluate((element) => ({
    viewport: document.documentElement.clientWidth,
    right: element.getBoundingClientRect().right,
  }));
  expect(layout.right).toBeLessThanOrEqual(layout.viewport);
  const scroll = source.locator('[data-radix-scroll-area-viewport]');
  await scroll.focus();
  await expect(scroll).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect
    .poll(() => scroll.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
});

test('non-Vue fences retain highlighting and source text after docs navigation', async ({
  page,
}) => {
  await page.goto('/?path=/docs/getting-started-installation--docs');
  const preview = page.frameLocator('#storybook-preview-iframe');
  const shell = preview
    .locator('pre.shiki:visible')
    .filter({ hasText: 'bun install --frozen-lockfile' });
  await expect(shell).toHaveCount(1);
  await expect
    .poll(() => shell.textContent())
    .toBe(
      'npm exec --yes --package=bun@1.4.3 -- bun install --frozen-lockfile',
    );
  await expect(shell.locator('span').filter({ hasText: /^npm$/ })).toHaveCSS(
    'color',
    'rgb(149, 56, 0)',
  );
  await page.getByRole('link', { name: 'Customization', exact: true }).click();
  const css = preview
    .locator('pre.shiki:visible')
    .filter({ hasText: '--wui-color-primary:' })
    .first();
  await expect(css).toBeVisible();
  await expect(
    css
      .locator('span')
      .filter({ hasText: /^\s*--wui-color-primary$/ })
      .first(),
  ).toHaveCSS('color', 'rgb(149, 56, 0)');
  await page.getByRole('link', { name: 'Installation', exact: true }).click();
  await expect(shell).toHaveCount(1);
});
