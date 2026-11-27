import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('native editing, required form submission, association, and parent-owned reset', async ({
  page,
  browserName,
}) => {
  await page.goto('/iframe.html?id=wui-contract-input--forms&viewMode=story');
  if (browserName === 'chromium')
    expect(
      (await new AxeBuilder({ page }).include('#input-examples').analyze())
        .violations,
    ).toEqual([]);
  const input = page.getByRole('textbox', {
    name: 'Input destination',
    exact: true,
  });
  await page.getByRole('button', { name: 'Submit input', exact: true }).click();
  await expect(page.getByTestId('input-submitted')).toHaveText('Not submitted');
  await expect(input).toBeFocused();
  await input.fill('Coast');
  await page.getByRole('button', { name: 'Submit input', exact: true }).click();
  await expect(page.getByTestId('input-submitted')).toHaveText('Coast');
  await page.getByRole('textbox', { name: 'Associated input' }).fill('Ocean');
  const data = await page
    .locator('#input-form')
    .evaluate((form) =>
      Object.fromEntries(new FormData(form as HTMLFormElement)),
    );
  expect(data).toMatchObject({
    inputDestination: 'Coast',
    associatedInput: 'Ocean',
  });
  await page.getByRole('button', { name: 'Reset input', exact: true }).click();
  await expect(input).toHaveValue('');
});

test('password inputs stay masked while clearing preserves focus and never submits', async ({
  page,
}) => {
  await page.goto('/iframe.html?id=wui-contract-input--forms&viewMode=story');
  const field = page
    .locator('.wui-input')
    .filter({ has: page.getByText('Input password', { exact: true }) });
  const input = field.locator('input');
  await expect(input).toHaveAttribute('type', 'password');
  await expect(field.getByRole('button')).toHaveCount(1);
  await field.getByRole('button', { name: 'Clear input' }).click();
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute('type', 'password');
  await expect(field.getByRole('button', { name: 'Clear input' })).toHaveCount(
    0,
  );
  await expect(page.getByTestId('input-submitted')).toHaveText('Not submitted');
});

test('disabled fieldsets block password edits and hide clear actions', async ({
  page,
}) => {
  await page.goto('/iframe.html?id=wui-contract-input--forms&viewMode=story');
  const fieldset = page.getByRole('group', {
    name: 'Input fieldset',
    exact: true,
  });
  const input = fieldset.locator('input');
  await page.getByRole('button', { name: 'Toggle input fieldset' }).click();
  await expect(input).toBeDisabled();
  await expect(input).toHaveAttribute('type', 'password');
  await expect(
    fieldset.getByRole('button', { name: 'Clear input' }),
  ).toHaveCount(0);
  await input.evaluate((element) => {
    (element as HTMLInputElement).value = 'Ignored';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(input).toHaveValue('Sea breeze');
  await page.getByRole('button', { name: 'Toggle input fieldset' }).click();
  await expect(input).toBeEnabled();
  await expect(
    fieldset.getByRole('button', { name: 'Clear input' }),
  ).toBeVisible();
});

test('readonly, error descriptions, and keyboard clear tab order', async ({
  page,
}) => {
  await page.goto('/iframe.html?id=wui-contract-input--forms&viewMode=story');
  await expect(
    page.getByRole('textbox', { name: 'Input readonly' }),
  ).toHaveAttribute('readonly', '');
  const invalid = page.getByRole('textbox', { name: 'Input invalid' });
  await expect(invalid).toHaveAttribute('aria-invalid', 'true');
  await expect(invalid).toHaveAccessibleDescription(
    'Choose another destination.',
  );
  const input = page.getByRole('textbox', {
    name: 'Input destination',
    exact: true,
  });
  await input.fill('Ocean');
  await input.focus();
  await page.keyboard.press('Tab');
  const field = input.locator('..');
  await expect(
    field.getByRole('button', { name: 'Clear input' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Submit input', exact: true }),
  ).toBeFocused();
});

test('control metrics grow with tokens, RTL and constrained widths without clipping', async ({
  page,
}) => {
  await page.goto('/iframe.html?id=wui-contract-input--forms&viewMode=story');
  const input = page.getByRole('textbox', {
    name: 'Input destination',
    exact: true,
  });
  const field = input.locator('../..');
  const group = input.locator('..');
  await expect(input).toHaveCSS('font-size', '14px');
  await expect(input).toHaveCSS('line-height', '20px');
  await expect(input).toHaveCSS('padding-top', '5px');
  expect((await group.boundingBox())!.height).toBeGreaterThanOrEqual(32);
  await field.evaluate((element) => {
    element.setAttribute('dir', 'rtl');
    element.style.setProperty('--wui-font-size-control', '2rem');
    element.style.inlineSize = '10rem';
  });
  await expect(input).toHaveCSS('direction', 'rtl');
  await expect(input).toHaveCSS('font-size', '32px');
  await expect(input).toHaveCSS('padding-bottom', '5px');
  expect((await group.boundingBox())!.height).toBeGreaterThanOrEqual(56);
  await page.setViewportSize({ width: 320, height: 900 });
  expect((await field.boundingBox())!.width).toBeLessThanOrEqual(320);
});

test(
  'invalid focus survives hover, scoped overrides, and forced colors',
  { tag: '@chromium-only' },
  async ({ page }) => {
    await page.goto('/iframe.html?id=wui-contract-input--forms&viewMode=story');
    const input = page.getByRole('textbox', { name: 'Input invalid' });
    const group = input.locator('..');
    await input.focus();
    await input.hover();
    await expect(group).toHaveCSS('border-top-color', 'rgb(185, 28, 28)');
    await expect(group).toHaveCSS('outline-style', 'solid');
    await input.locator('../..').evaluate((element) => {
      element.style.setProperty('--wui-color-error', '#9f1239');
    });
    await expect(group).toHaveCSS('border-top-color', 'rgb(159, 18, 57)');
    await page.emulateMedia({ forcedColors: 'active' });
    await expect(group).toHaveCSS('border-top-style', 'solid');
    await expect(group).toHaveCSS('outline-style', 'solid');
  },
);
