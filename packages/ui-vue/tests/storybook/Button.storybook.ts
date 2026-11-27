import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('index exposes public Button pages and keeps contract fixtures private', async ({
  request,
}) => {
  const response = await request.get('/index.json');
  expect(response.ok()).toBe(true);
  const { entries } = await response.json();
  expect(
    Object.keys(entries)
      .filter((id) => id.startsWith('warmsea-button--'))
      .sort(),
  ).toEqual([
    'warmsea-button--demos',
    'warmsea-button--docs',
    'warmsea-button--form-behavior',
    'warmsea-button--playground',
  ]);
  expect(entries['warmsea-button--form-behavior'].tags).not.toContain('dev');
  expect(entries['warmsea-button--playground'].title).toBe('Components/Button');

  const contracts = Object.values(entries).filter((entry: unknown) =>
    (entry as { id: string }).id.startsWith('wui-contract-'),
  ) as { type: string; tags: string[] }[];
  expect(contracts).toHaveLength(9);
  for (const entry of contracts) {
    expect(entry.type).toBe('story');
    expect(entry.tags).not.toContain('dev');
    expect(entry.tags).not.toContain('autodocs');
  }
});

test('Playground Controls update one Button while contract fixtures stay hidden', async ({
  page,
}) => {
  await page.goto('/?path=/story/warmsea-button--playground');
  const preview = page.frameLocator('#storybook-preview-iframe');
  const interactive = preview.getByRole('region', {
    name: 'Interactive Button',
  });
  await expect(
    interactive.getByRole('button', { name: 'Set sail', exact: true }),
  ).toHaveCSS('background-color', 'rgb(15, 118, 110)');
  await expect(preview.getByRole('heading')).toHaveText(['Button playground']);
  await expect(preview.getByRole('button')).toHaveCount(1);
  await expect(
    preview.getByRole('region', { name: 'Button variants' }),
  ).toHaveCount(0);
  await expect(
    preview.getByRole('heading', { name: 'Button playground', exact: true }),
  ).toBeInViewport();
  await page.getByRole('tab', { name: /Controls/ }).click();
  await expect(page.locator('#control-size')).toHaveCount(0);
  await page.locator('#control-label').fill('Explore Warmsea');
  const button = interactive.getByRole('button', {
    name: 'Explore Warmsea',
    exact: true,
  });
  await expect(button).toBeEnabled();
  await page.getByRole('radio', { name: 'outlined', exact: true }).check();
  await expect(button).toHaveClass(/wui-button--outlined/);

  await expect(page.locator('a[href*="wui-contract-"]')).toHaveCount(0);
  await expect(page.getByText('Contracts', { exact: true })).toHaveCount(0);
});

test('Playground accepts prop and token args without including comparison examples', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=warmsea-button--playground&viewMode=story&args=label:Unexpected;variant:default;disabled:true;type:reset;palette.--wui-color-primary:black;palette.--wui-color-on-primary:white;palette.--wui-color-text:yellow;palette.--wui-color-primary-container:linen;palette.--wui-color-primary-container-hover:ivory;palette.--wui-color-primary-container-active:beige',
  );
  const interactive = page
    .getByRole('region', { name: 'Interactive Button' })
    .getByRole('button', { name: 'Unexpected' });
  await expect(interactive).toHaveClass(/wui-button--default/);
  await expect(interactive).toBeDisabled();
  await expect(interactive).toHaveAttribute('type', 'reset');
  await expect(interactive).toHaveCSS('--wui-color-primary', 'black');
  await expect(interactive).toHaveCSS('--wui-color-on-primary', 'white');
  await expect(interactive).toHaveCSS('--wui-color-text', 'yellow');
  await expect(interactive).toHaveCSS(
    '--wui-color-primary-container-hover',
    'ivory',
  );
  await expect(page.getByRole('button')).toHaveCount(1);
  await expect(
    page.getByRole('region', { name: 'Button variants' }),
  ).toHaveCount(0);
});

test('Docs connects its embedded form to the submission output', async ({
  page,
}) => {
  await page.goto('/?path=/docs/warmsea-button--docs');
  const preview = page.frameLocator('#storybook-preview-iframe');
  const example = preview.getByRole('region', {
    name: 'Button form behavior',
  });
  await example.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(example.locator('output')).toContainText('Submissions: 1');
});

test('Button Docs contains the props table at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/iframe.html?id=warmsea-button--docs&viewMode=docs');
  const table = page.getByRole('table');
  await expect(table).toBeVisible();
  await expect(
    table.getByRole('cell', { name: 'type', exact: true }),
  ).toBeVisible();
  const usage = page.getByRole('main').locator('pre:not(:has(pre)):visible');
  await expect(usage).toHaveCount(1);
  await expect(usage).toBeVisible();
  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(layout.document).toBeLessThanOrEqual(layout.viewport);
  const props = page.getByRole('region', {
    name: 'Button props',
    exact: true,
  });
  await expect(props.getByRole('table')).toBeVisible();
  const tableWidth = await props.evaluate((element) => ({
    content: element.scrollWidth,
    viewport: element.clientWidth,
  }));
  expect(tableWidth.content).toBeGreaterThan(tableWidth.viewport);
  await props.focus();
  await expect(props).toBeFocused();
  await expect(props).toHaveCSS('outline-style', 'solid');
  await expect(props).toHaveCSS('outline-width', '2px');
  await page.keyboard.press('ArrowRight');
  await expect
    .poll(() => props.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
  const results = await new AxeBuilder({ page })
    .include('main')
    .exclude('[aria-label="Button form behavior"]')
    .analyze();
  expect(results.violations).toEqual([]);
});
