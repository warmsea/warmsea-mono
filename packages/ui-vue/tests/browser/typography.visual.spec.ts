import { expect, test } from '@playwright/test';

test('Heading levels and Text weights and roots', async ({ page }) => {
  await page.goto(
    '/iframe.html?id=wui-contract-typography--scopes&viewMode=story',
  );
  await expect(page.locator('#typography-matrix')).toHaveScreenshot(
    'typography-matrix.png',
    {
      animations: 'disabled',
    },
  );
});
