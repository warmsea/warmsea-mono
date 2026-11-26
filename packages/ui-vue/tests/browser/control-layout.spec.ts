import { expect, test, type Locator, type Page } from '@playwright/test';

async function refreshSelectMetrics(page: Page, select: Locator) {
  // WebKit's initial select CSSOM can be stale despite correctly painted padding.
  const initial = await select.screenshot();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = getComputedStyle(
      document.documentElement,
    ).fontSize;
  });
  expect(await select.screenshot()).toEqual(initial);
}

async function expectControlMetrics(control: Locator, fontSize: number) {
  const lineHeight = Math.round((fontSize * 1.4) / 2) * 2;
  await expect(control).toHaveCSS('font-size', `${fontSize}px`);
  await expect(control).toHaveCSS('padding-top', '5px');
  await expect(control).toHaveCSS('padding-bottom', '5px');
  await expect(control).toHaveCSS('line-height', `${lineHeight}px`);
  expect((await control.boundingBox())!.height).toBe(lineHeight + 12);
}

async function expectTextFits(control: Locator) {
  const fits = await control.evaluate(
    (element) => element.scrollHeight <= element.clientHeight,
  );
  expect(fits).toBe(true);
}

test('default controls request 20px lines with 5px padding and allow native font metrics', async ({
  page,
  browserName,
}) => {
  await page.goto(
    '/iframe.html?id=wui-contract-controls--layout&viewMode=story',
  );
  const row = page.getByTestId('control-layout-row');
  if (browserName === 'webkit') {
    await refreshSelectMetrics(page, row.locator('select'));
  }
  const controls = row.locator('button, select');
  await expect(controls).toHaveCount(2);
  const bottoms = [];
  for (const control of await controls.all()) {
    const bounds = (await control.boundingBox())!;
    await expectControlMetrics(control, 14);
    bottoms.push(bounds.y + bounds.height);
  }
  expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeLessThanOrEqual(1);
  await expect(
    page.getByText(
      '16px body text, 14px controls, 20px lines and 5px control padding.',
    ),
  ).toHaveCSS('line-height', '20px');
});

test('scoped padding and line-height overrides retain larger controls locally', async ({
  page,
  browserName,
}) => {
  await page.goto(
    '/iframe.html?id=wui-contract-controls--layout&viewMode=story',
  );
  if (browserName === 'webkit') {
    await refreshSelectMetrics(
      page,
      page.getByTestId('control-layout-scoped').locator('select'),
    );
  }
  const scoped = page
    .getByTestId('control-layout-scoped')
    .locator('button, select');
  for (const control of await scoped.all()) {
    expect((await control.boundingBox())!.height).toBe(48);
  }
  await expect(page.getByTestId('control-layout-scoped-button')).toHaveCSS(
    'line-height',
    '24px',
  );
  await expect(
    page.getByRole('combobox', { name: 'Larger scoped select', exact: true }),
  ).toHaveCSS('line-height', '24px');
  expect(
    (await page.getByTestId('control-layout-button').boundingBox())!.height,
  ).toBe(32);
});

test(
  'body and control typography can be overridden independently',
  { tag: '@chromium-only' },
  async ({ page }) => {
    await page.goto(
      '/iframe.html?id=wui-contract-controls--layout&viewMode=story',
    );
    const bodyText = page.getByTestId('text-default');
    await page.locator('main').evaluate((element) => {
      element.style.setProperty('--wui-font-size', '1.5rem');
    });
    await expect(bodyText).toHaveCSS('font-size', '24px');
    await expect(bodyText).toHaveCSS('line-height', '30px');
    const row = page.getByTestId('control-layout-row');
    const controls = row.locator('button, select');
    for (const control of await controls.all()) {
      await expect(control).toHaveCSS('font-size', '14px');
      await expect(control).toHaveCSS('line-height', '20px');
    }
    await row.evaluate((element) => {
      element.style.setProperty('--wui-font-size-control', '1.75rem');
    });
    for (const control of await controls.all()) {
      await expect(control).toHaveCSS('font-size', '28px');
      await expect(control).toHaveCSS('line-height', '40px');
    }
    await expect(bodyText).toHaveCSS('font-size', '24px');
    await expect(page.getByTestId('counter')).toHaveCSS('font-size', '14px');
  },
);

test('controls grow with the root font size while retaining 5px padding', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=wui-contract-controls--layout&viewMode=story',
  );
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  for (const control of await page
    .getByTestId('control-layout-row')
    .locator('button, select')
    .all()) {
    await expectControlMetrics(control, 28);
    await expectTextFits(control);
  }
  const wrapped = page.getByTestId('control-layout-wrapped');
  expect((await wrapped.boundingBox())!.height).toBeGreaterThan(32);
  await expectTextFits(wrapped);
});
