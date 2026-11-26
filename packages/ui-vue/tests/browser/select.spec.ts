import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('native choices update the model, while prompt clearing and reset belong to the parent', async ({
  page,
  browserName,
}) => {
  await page.goto('/iframe.html?id=wui-contract-select--forms&viewMode=story');
  if (browserName === 'chromium')
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const select = page.getByLabel('Native destination', { exact: true });
  await expect(select).toHaveValue('ocean');
  await expect(select).toHaveAccessibleName('Native destination');
  await expect(select).toHaveAccessibleDescription(
    'Choose an available destination. Reef is unavailable.',
  );
  await select.focus();
  await expect(select).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Submit native selection' }),
  ).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(select).toBeFocused();
  await select.press('c');
  await expect(select).toHaveValue('coast');
  await expect(page.getByTestId('select-value')).toHaveText('coast');
  await page.getByRole('button', { name: 'Submit native selection' }).click();
  await expect(page.getByTestId('select-submitted')).toHaveText('coast');
  await page.getByRole('button', { name: 'Clear native selection' }).click();
  await expect(select).toHaveValue('');
  await expect(page.getByTestId('select-value')).toHaveText('None');
  expect(
    await select.evaluate(
      (element: HTMLSelectElement) => element.validity.valueMissing,
    ),
  ).toBe(true);
  expect(await select.locator('option:checked').isDisabled()).toBe(true);
  await page.getByRole('button', { name: 'Submit native selection' }).click();
  await expect(page.getByTestId('select-submitted')).toHaveText('coast');
  await expect(select).toBeFocused();
  await page.getByRole('button', { name: 'Reset native selection' }).click();
  await expect(select).toHaveValue('ocean');
  await expect(page.getByTestId('select-value')).toHaveText('ocean');
});

test('option removal, returning options and unknown values never coerce the parent model', async ({
  page,
}) => {
  await page.goto('/iframe.html?id=wui-contract-select--forms&viewMode=story');
  const select = page.getByLabel('Native destination', { exact: true });
  await page.getByRole('button', { name: 'Choose native coast' }).click();
  await expect(select).toHaveValue('coast');
  await page.getByRole('button', { name: 'Remove native coast' }).click();
  await expect(select).toHaveValue('');
  await expect(page.getByTestId('select-value')).toHaveText('coast');
  await page.getByRole('button', { name: 'Restore native coast' }).click();
  await expect(select).toHaveValue('coast');
  await page
    .getByRole('button', { name: 'Choose unknown native value' })
    .click();
  await expect(select).toHaveValue('');
  await expect(page.getByTestId('select-value')).toHaveText('missing');
});

test('native successful controls omit prompts and disabled selections, controls and fieldsets', async ({
  page,
}) => {
  await page.goto('/iframe.html?id=wui-contract-select--forms&viewMode=story');
  const select = page.getByLabel('Native destination', { exact: true });
  const entries = () =>
    select.evaluate((element: HTMLSelectElement) => [
      ...new FormData(element.form!).entries(),
    ]);
  expect(await entries()).toEqual([['destination', 'ocean']]);
  await page.getByRole('button', { name: 'Clear native selection' }).click();
  expect(await entries()).toEqual([]);
  await page
    .getByRole('button', { name: 'Choose disabled native value' })
    .click();
  await expect(select).toHaveValue('reef');
  expect(await entries()).toEqual([]);
  await page.getByRole('button', { name: 'Choose native coast' }).click();
  for (const name of ['Toggle native disabled', 'Toggle native fieldset']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(select).toBeDisabled();
    expect(await entries()).toEqual([]);
    await page.getByRole('button', { name, exact: true }).click();
  }
  await expect(select).toBeEnabled();
  expect(await entries()).toEqual([['destination', 'coast']]);
});

test('the actual select participates in an external form without hidden fields', async ({
  page,
}) => {
  await page.goto('/iframe.html?id=wui-contract-select--forms&viewMode=story');
  const select = page.getByLabel('Associated native destination');
  expect(
    await select.evaluate((element: HTMLSelectElement) => ({
      form: element.form?.id,
      entries: [...new FormData(element.form!).entries()],
      valid: element.checkValidity(),
    })),
  ).toEqual({ form: 'select-external-form', entries: [], valid: true });
  await select.selectOption('coast');
  expect(
    await select.evaluate((element: HTMLSelectElement) => [
      ...new FormData(element.form!).entries(),
    ]),
  ).toEqual([['destination', 'coast']]);
  await expect(
    page.getByTestId('select-fixtures').locator('input[type="hidden"]'),
  ).toHaveCount(0);
});

test(
  'forced colors retain a native arrow, keyboard selection and disabled boundaries',
  { tag: '@chromium-only' },
  async ({ page }) => {
    await page.goto(
      '/iframe.html?id=wui-contract-select--forms&viewMode=story',
    );
    await page.emulateMedia({ forcedColors: 'active' });
    const select = page.getByLabel('Native destination', { exact: true });
    await expect(select).toHaveCSS('appearance', 'auto');
    await expect(select).toHaveCSS('background-image', 'none');
    await select.focus();
    await select.press('c');
    await expect(select).toHaveValue('coast');
    await expect(select).toBeFocused();
    await expect(select).toHaveCSS('outline-style', 'solid');
    const disabled = page.getByLabel('Disabled native destination');
    await expect(disabled).toBeDisabled();
    await expect(disabled).toHaveCSS('border-inline-end-style', 'solid');
  },
);

test('closed native controls fit narrow, RTL, long-label and scoped layouts at 320px', async ({
  page,
}) => {
  await page.goto('/iframe.html?id=wui-contract-select--forms&viewMode=story');
  await page.setViewportSize({ width: 320, height: 900 });
  const fields = page.getByTestId('select-fixtures').locator('select');
  for (const field of await fields.all()) {
    const bounds = (await field.boundingBox())!;
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  }
  const rtl = page.getByLabel('RTL native destination');
  expect(
    await rtl.evaluate((element) => getComputedStyle(element).direction),
  ).toBe('rtl');
  const scoped = page.getByLabel('Scoped native destination');
  expect(
    await scoped.evaluate((element) => ({
      foreground: getComputedStyle(element).color,
      surface: getComputedStyle(element).backgroundColor,
    })),
  ).toEqual({
    foreground: 'rgb(124, 45, 18)',
    surface: 'rgb(255, 247, 237)',
  });
});
