import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test(
  'semantic action highlight is inherited by the open menu without changing disabled items',
  { tag: '@chromium-only' },
  async ({ page }) => {
    await page.goto(
      '/iframe.html?id=wui-contract-menu--interactions&viewMode=story',
    );
    await page.getByTestId('menu-fixture').evaluate((element) => {
      element.style.setProperty('--wui-color-action-highlight', '#ddeeff');
    });
    await page
      .getByRole('button', { name: 'Conversation actions', exact: true })
      .click();
    const item = page.getByRole('menuitem', { name: 'Rename', exact: true });
    await item.hover();
    await expect(item).toHaveCSS('background-color', 'rgb(221, 238, 255)');
    await item.focus();
    await expect(item).toHaveCSS('background-color', 'rgb(221, 238, 255)');
    const disabled = page.getByRole('menuitem', { disabled: true }).first();
    await expect(disabled).not.toHaveCSS(
      'background-color',
      'rgb(221, 238, 255)',
    );
  },
);

test('keyboard opening, navigation, selection, Escape and native Tab order', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=wui-contract-menu--interactions&viewMode=story',
  );
  const trigger = page.getByRole('button', {
    name: 'Conversation actions',
    exact: true,
  });
  const menu = page.getByRole('menu', { name: 'Conversation actions' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('menuitem', { name: 'Rename', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(
    page.getByRole('menuitem', { name: 'Archive', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('End');
  await expect(
    page.getByRole('menuitem', { name: 'Reset conversation' }),
  ).toBeFocused();
  await page.keyboard.press('Home');
  await page.keyboard.press('r');
  await expect(
    page.getByRole('menuitem', { name: 'Reset conversation' }),
  ).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('selected-action')).toHaveText(
    'Reset conversation',
  );
  await expect(trigger).toBeFocused();
  await expect(menu).toBeHidden();
  await page.keyboard.press('ArrowUp');
  await expect(
    page.getByRole('menuitem', { name: 'Reset conversation' }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Space');
  await expect(menu).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'After actions', exact: true }),
  ).toBeFocused();
  await expect(menu).toBeHidden();
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Shift+Tab');
  await expect(
    page.getByRole('button', { name: 'Before actions', exact: true }),
  ).toBeFocused();
});

test('outside pointer and external focus dismiss without restoring the trigger', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=wui-contract-menu--interactions&viewMode=story',
  );
  const trigger = page.getByRole('button', {
    name: 'Conversation actions',
    exact: true,
  });
  const after = page.getByRole('button', {
    name: 'After actions',
    exact: true,
  });
  await trigger.click();
  await after.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  // Safari does not focus buttons on pointer activation; focus navigation must still dismiss.
  await trigger.click();
  await after.focus();
  await expect(after).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('selected-action')).toHaveText('None');
});

test('disabling an ancestor fieldset dismisses without focus restoration and permits reopening', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=wui-contract-menu--interactions&viewMode=story',
  );
  await page.getByTestId('menu-fixture').evaluate((element) => {
    const root = element.querySelector('.wui-menu')!;
    const fieldset = document.createElement('fieldset');
    fieldset.dataset.testid = 'menu-fieldset';
    root.before(fieldset);
    fieldset.append(root);
  });
  const trigger = page.getByRole('button', {
    name: 'Conversation actions',
    exact: true,
  });
  const menu = page.getByRole('menu', { name: 'Conversation actions' });
  const rename = page.getByRole('menuitem', { name: 'Rename', exact: true });
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  await expect(rename).toBeFocused();
  await expect(menu).toBeVisible();
  await page.getByTestId('menu-fieldset').evaluate((element) => {
    (element as HTMLFieldSetElement).disabled = true;
  });
  await expect(trigger).toBeDisabled();
  await expect(menu).toBeHidden();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).not.toBeFocused();
  await expect(
    page.locator('.wui-menu__popup [role="menuitem"]').first(),
  ).not.toBeFocused();
  expect(
    await page
      .locator('.wui-menu__popup')
      .evaluate((element) => element.matches(':popover-open')),
  ).toBe(false);
  await expect(page.getByTestId('selected-action')).toHaveText('None');
  await page.keyboard.press('Escape');
  await expect(trigger).not.toBeFocused();
  await page.getByTestId('menu-fieldset').evaluate((element) => {
    (element as HTMLFieldSetElement).disabled = false;
    element.style.marginTop = '80px';
    window.dispatchEvent(new Event('resize'));
  });
  await expect(menu).toBeHidden();
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  await expect(rename).toBeFocused();
  await expect(menu).toBeVisible();
  await expect
    .poll(async () => {
      const anchor = (await trigger.boundingBox())!;
      return (await menu.boundingBox())!.y - anchor.y - anchor.height;
    })
    .toBeCloseTo(4, 1);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('a disabled fieldset preserves its first-legend menu focus and keyboard dismissal', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=wui-contract-menu--interactions&viewMode=story',
  );
  await page.getByTestId('menu-fixture').evaluate((element) => {
    const root = element.querySelector('.wui-menu')!;
    const fieldset = document.createElement('fieldset');
    const legend = document.createElement('legend');
    fieldset.dataset.testid = 'menu-fieldset';
    root.before(fieldset);
    fieldset.append(legend);
    legend.append(root);
  });
  const trigger = page.getByRole('button', {
    name: 'Conversation actions',
    exact: true,
  });
  const menu = page.getByRole('menu', { name: 'Conversation actions' });
  const rename = page.getByRole('menuitem', { name: 'Rename', exact: true });
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  await expect(rename).toBeFocused();
  await page.getByTestId('menu-fieldset').evaluate(
    (element) =>
      new Promise<void>((resolve) => {
        (element as HTMLFieldSetElement).disabled = true;
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  await expect(trigger).toBeEnabled();
  await expect(menu).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(rename).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(rename).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.getByTestId('selected-action')).toHaveText('Rename');
});

test('open menu follows position-only layout shifts without repeated style writes', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=wui-contract-menu--interactions&viewMode=story',
  );
  const fixture = page.getByTestId('menu-fixture');
  await fixture.evaluate((element) => {
    Object.assign(element.style, {
      position: 'fixed',
      top: '20px',
      left: '200px',
      width: '300px',
      height: '500px',
      margin: '0',
    });
    const spacer = document.createElement('div');
    spacer.dataset.testid = 'menu-spacer';
    spacer.style.height = '0px';
    element.querySelector('.wui-menu')!.before(spacer);
  });
  const trigger = page.getByRole('button', {
    name: 'Conversation actions',
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  const menu = page.getByRole('menu', { name: 'Conversation actions' });
  await expect(menu).toBeVisible();
  await expect
    .poll(async () => {
      const anchor = (await trigger.boundingBox())!;
      return (await menu.boundingBox())!.y - anchor.y - anchor.height;
    })
    .toBeCloseTo(4, 1);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  const beforeTrigger = (await trigger.boundingBox())!;
  const beforeMenu = (await menu.boundingBox())!;
  await page.getByTestId('menu-spacer').evaluate((element) => {
    element.style.height = '100px';
  });
  await expect
    .poll(async () => (await trigger.boundingBox())!.y)
    .toBeCloseTo(beforeTrigger.y + 100, 1);
  expect((await trigger.boundingBox())!.width).toBe(beforeTrigger.width);
  expect((await trigger.boundingBox())!.height).toBe(beforeTrigger.height);
  await expect
    .poll(async () => (await menu.boundingBox())!.y)
    .toBeCloseTo(beforeMenu.y + 100, 1);
  expect((await menu.boundingBox())!.width).toBe(beforeMenu.width);
  expect((await menu.boundingBox())!.height).toBe(beforeMenu.height);
  expect(
    await menu.evaluate(
      (element) =>
        new Promise<number>((resolve) => {
          let writes = 0;
          let frames = 0;
          const observer = new MutationObserver((records) => {
            writes += records.length;
          });
          observer.observe(element, {
            attributes: true,
            attributeFilter: ['style'],
          });
          const tick = () => {
            if (++frames < 5) requestAnimationFrame(tick);
            else {
              observer.disconnect();
              resolve(writes);
            }
          };
          requestAnimationFrame(tick);
        }),
    ),
  ).toBe(0);
});

for (const unavailable of ['hidden', 'removed']) {
  test(
    `an open menu dismisses when its trigger is ${unavailable}`,
    { tag: '@chromium-only' },
    async ({ page }) => {
      await page.goto(
        '/iframe.html?id=wui-contract-menu--interactions&viewMode=story',
      );
      const trigger = page.getByRole('button', {
        name: 'Conversation actions',
        exact: true,
      });
      await trigger.focus();
      await page.keyboard.press('ArrowDown');
      const menu = page.getByRole('menu', { name: 'Conversation actions' });
      await expect(menu).toBeVisible();
      await trigger.evaluate((element, state) => {
        if (state === 'removed') element.remove();
        else element.style.visibility = 'hidden';
      }, unavailable);
      await expect(menu).toBeHidden();
      await expect(
        page.getByRole('button', { name: 'After actions', exact: true }),
      ).not.toBeFocused();
    },
  );
}

test('top-layer menu stays inside a narrow viewport with enlarged text (rtl)', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=wui-contract-menu--interactions&viewMode=story',
  );
  await page.setViewportSize({ width: 320, height: 390 });
  await page.getByTestId('menu-fixture').evaluate((element) => {
    document.documentElement.style.fontSize = '32px';
    element.setAttribute('dir', 'rtl');
    Object.assign(element.style, {
      position: 'fixed',
      bottom: '0',
      right: '0',
      width: '130px',
      height: '100px',
      overflow: 'hidden',
      transform: 'translateZ(0)',
    });
  });
  const trigger = page.getByRole('button', {
    name: 'Conversation actions',
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  const menu = page.getByRole('menu', { name: 'Conversation actions' });
  await expect(menu).toBeVisible();
  expect(
    await menu.evaluate((element) => element.matches(':popover-open')),
  ).toBe(true);
  const box = (await menu.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(7);
  expect(box.y).toBeGreaterThanOrEqual(7);
  expect(box.x + box.width).toBeLessThanOrEqual(313);
  expect(box.y + box.height).toBeLessThanOrEqual(383);
  await page.keyboard.press('End');
  await expect(
    page.getByRole('menuitem', { name: 'Reset conversation' }),
  ).toBeInViewport();
  await page.setViewportSize({ width: 390, height: 320 });
  await expect
    .poll(async () => {
      const resized = (await menu.boundingBox())!;
      return resized.y + resized.height;
    })
    .toBeLessThanOrEqual(313);
});

test(
  'open menu has no automated accessibility violations and preserves forced-color focus',
  { tag: '@chromium-only' },
  async ({ page }) => {
    await page.goto(
      '/iframe.html?id=wui-contract-menu--interactions&viewMode=story',
    );
    await page
      .getByRole('button', { name: 'Conversation actions', exact: true })
      .click();
    expect(
      (
        await new AxeBuilder({ page })
          .include('[data-testid="menu-fixture"]')
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.emulateMedia({ forcedColors: 'active' });
    await page.keyboard.press('ArrowDown');
    const archive = page.getByRole('menuitem', {
      name: 'Archive',
      exact: true,
    });
    await expect(archive).toBeFocused();
    await expect(archive).toHaveCSS('outline-style', 'solid');
    await expect(page.getByRole('menu')).toHaveCSS('border-top-style', 'solid');
  },
);
