import { expect, test } from '@playwright/test';

test('Select Playground keeps model and Controls args reactive', async ({
  page,
}) => {
  await page.goto('/?path=/story/warmsea-select--playground');
  const preview = page.frameLocator('#storybook-preview-iframe');
  await page.getByRole('tab', { name: /Controls/ }).click();
  const select = preview.getByRole('combobox', {
    name: 'Destination',
    exact: true,
  });
  await select.selectOption('coast');
  await expect(select).toHaveValue('coast');
  await expect(preview.locator('output')).toHaveText('coast');
  await page.locator('#control-modelValue').fill('ocean');
  await expect(select).toHaveValue('ocean');
  await page.locator('#control-placeholder').fill('Choose a destination');
  await expect(select.locator('option').first()).toHaveText(
    'Choose a destination',
  );
});
