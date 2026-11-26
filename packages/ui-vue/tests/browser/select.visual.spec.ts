import { expect, test } from '@playwright/test';

test('Select closed, keyboard focus and disabled appearance', async ({
  page,
}) => {
  await page.goto('/iframe.html?id=wui-contract-select--forms&viewMode=story');
  const select = page.getByLabel('Native destination', { exact: true });
  await expect(select).toHaveScreenshot('select-selected.png');
  await page.getByRole('button', { name: 'Clear native selection' }).click();
  await expect(select).toHaveScreenshot('select-prompt.png');
  await select.focus();
  const bounds = (await select.boundingBox())!;
  await expect(page).toHaveScreenshot('select-focus.png', {
    clip: {
      x: bounds.x - 6,
      y: bounds.y - 6,
      width: bounds.width + 12,
      height: bounds.height + 12,
    },
  });
  await expect(page.getByLabel('Disabled native destination')).toHaveScreenshot(
    'select-disabled.png',
  );
});

test('Select scoped tokens and native RTL appearance', async ({ page }) => {
  await page.goto('/iframe.html?id=wui-contract-select--forms&viewMode=story');
  await expect(page.getByLabel('Scoped native destination')).toHaveScreenshot(
    'select-scoped.png',
  );
  await expect(page.getByLabel('RTL native destination')).toHaveScreenshot(
    'select-rtl.png',
  );
});
