import { expect, test } from '@playwright/test';

test('Tooltip inverse surface and wrapping text', async ({ page }) => {
  await page.goto(
    '/iframe.html?id=wui-contract-tooltip--positioning&viewMode=story',
  );
  await page
    .locator('#tooltip-copy')
    .fill(
      'Internationalcollaborationworkspace settings and preferences wrap instead of being truncated',
    );
  const root = page.getByTestId('tooltip-top');
  await root.getByRole('button').hover();
  await expect(root.getByRole('tooltip')).toHaveScreenshot(
    'tooltip-surface.png',
  );
});

test('Tooltip keeps nested tokens in the native top layer', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=wui-contract-app-bar--navigation&viewMode=story',
  );
  const nav = page.getByRole('navigation', {
    name: 'Inner brand apps',
    exact: true,
  });
  await nav.getByRole('link', { name: 'Chat', exact: true }).hover();
  await expect(
    nav.getByRole('tooltip', { name: 'Chat', exact: true }),
  ).toHaveScreenshot('tooltip-nested.png');
});
