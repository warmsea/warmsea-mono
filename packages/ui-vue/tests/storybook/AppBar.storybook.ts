import { expect, test } from '@playwright/test';

test('Playground owns native fragment selection and supports local color controls', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=warmsea-app-bar--playground&viewMode=story&args=primaryColor:purple',
  );
  const nav = page.getByRole('navigation', {
    name: 'Primary apps',
    exact: true,
  });
  await expect(nav.locator('.wui-app-bar__icon > svg')).toHaveCount(4);
  const chat = nav.getByRole('link', {
    name: 'Chat',
    exact: true,
  });
  await chat.click();
  await expect(page).toHaveURL(/#appbar-demo-chat$/);
  await expect(chat).toHaveAttribute('aria-current', 'page');
  await expect(chat).toHaveCSS('color', 'rgb(128, 0, 128)');
  await page.goto('/?path=/story/warmsea-app-bar--playground');
  await page.getByRole('tab', { name: /Controls/ }).click();
  for (const [name, destination] of [
    ['items', { id: 'messages', label: 'Messages', href: '#changed-messages' }],
    [
      'bottomItems',
      { id: 'preferences', label: 'Preferences', href: '#changed-preferences' },
    ],
  ] as const) {
    await page
      .getByRole('switch', { name: `Edit ${name} as JSON`, exact: true })
      .click();
    await page.locator(`#control-${name}`).fill(JSON.stringify([destination]));
    await page.locator(`#control-${name}`).press('Tab');
  }
  const preview = page.frameLocator('#storybook-preview-iframe');
  const messages = preview.getByRole('link', { name: 'Messages', exact: true });
  await expect(messages).toHaveAttribute('href', '#changed-messages');
  await expect(preview.locator('#changed-messages h2')).toHaveText('Messages');
  await expect(preview.locator('#appbar-demo-chat')).toHaveCount(0);
  const preferences = preview.getByRole('link', {
    name: 'Preferences',
    exact: true,
  });
  await expect(preferences).toHaveAttribute('href', '#changed-preferences');
  await expect(preview.locator('#changed-preferences h2')).toHaveText(
    'Preferences',
  );
});
