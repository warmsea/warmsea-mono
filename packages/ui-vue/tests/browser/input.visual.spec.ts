import { expect, test } from '@playwright/test';

test('Input fields, supporting text and clear actions', async ({ page }) => {
  await page.goto('/iframe.html?id=wui-contract-input--forms&viewMode=story');
  await expect(page.locator('#input-examples')).toHaveScreenshot(
    'input-fields.png',
    {
      animations: 'disabled',
    },
  );
});
