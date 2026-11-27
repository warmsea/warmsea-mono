import { expect, test } from '@playwright/test';

test('Button variants, disabled states, and focus', async ({ page }) => {
  await page.goto(
    '/iframe.html?id=wui-contract-button--matrix-and-palette&viewMode=story',
  );
  const matrix = page.locator('#matrix');
  await expect(matrix).toHaveScreenshot('button-matrix.png', {
    animations: 'disabled',
  });
  await matrix.getByRole('button').first().focus();
  await expect(matrix).toHaveScreenshot('button-focus.png', {
    animations: 'disabled',
  });
  await matrix.getByRole('button').first().hover();
  await expect(matrix).toHaveScreenshot('button-hover.png', {
    animations: 'disabled',
  });
  await page.mouse.down();
  await expect(matrix).toHaveScreenshot('button-active.png', {
    animations: 'disabled',
  });
  await page.mouse.up();
});
