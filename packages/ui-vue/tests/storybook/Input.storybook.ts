import { expect, test } from '@playwright/test';

test('Input preserves composition while Playground supporting text changes', async ({
  page,
}) => {
  await page.goto('/?path=/story/warmsea-input--playground');
  const preview = page.frameLocator('#storybook-preview-iframe');
  const input = preview.getByRole('textbox', {
    name: 'Destination',
    exact: true,
  });
  await input.fill('Ocean');
  await expect(preview.locator('output')).toHaveText('Ocean');
  await input.dispatchEvent('compositionstart');
  await input.evaluate((element: HTMLInputElement) => {
    element.value = 'Ocean draft';
    element.dispatchEvent(
      new InputEvent('input', { bubbles: true, isComposing: true }),
    );
  });
  await page.getByRole('tab', { name: /Controls/ }).click();
  await page.locator('#control-helpText').fill('Updated guidance');
  await expect(input).toHaveAccessibleDescription('Updated guidance');
  await expect(input).toHaveValue('Ocean draft');
  await expect(preview.locator('output')).toHaveText('Ocean');
  await input.dispatchEvent('compositionend');
  await expect(preview.locator('output')).toHaveText('Ocean draft');
  await expect(input).toHaveValue('Ocean draft');
  await page.locator('#control-modelValue').fill('Coast');
  await expect(input).toHaveValue('Coast');
});
