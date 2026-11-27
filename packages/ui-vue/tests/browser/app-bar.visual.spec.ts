import { expect, test } from '@playwright/test';

test('AppBar icons, bottom items, and current destination', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=wui-contract-app-bar--navigation&viewMode=story#app-chat',
  );
  const nav = page.getByRole('navigation', {
    name: 'Primary apps',
    exact: true,
  });
  await expect(nav).toHaveScreenshot('app-bar-current.png', {
    animations: 'disabled',
  });
});

test('AppBar keyboard focus is independent of the current marker', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=wui-contract-app-bar--navigation&viewMode=story#app-chat',
  );
  const nav = page.getByRole('navigation', {
    name: 'Primary apps',
    exact: true,
  });
  await page.keyboard.press('Tab');
  await nav.getByRole('link', { name: 'Calendar', exact: true }).focus();
  await expect(nav).toHaveScreenshot('app-bar-focus.png', {
    animations: 'disabled',
  });
});
