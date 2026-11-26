import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator } from '@playwright/test';

async function backgroundRgb(button: Locator) {
  return button.evaluate((element) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Cannot normalize the rendered Button color');
    context.fillStyle = 'white';
    context.fillRect(0, 0, 1, 1);
    context.fillStyle = getComputedStyle(element).backgroundColor;
    context.fillRect(0, 0, 1, 1);
    return Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
  });
}

test(
  'semantic state overrides inherit without leaking to sibling buttons',
  { tag: '@chromium-only' },
  async ({ page }) => {
    await page.goto(
      '/iframe.html?id=wui-contract-button--matrix-and-palette&viewMode=story',
    );
    const button = page.getByTestId('custom-button');
    await button.evaluate((element) => {
      const scope = element.parentElement!;
      scope.style.setProperty('--wui-color-primary-hover', '#112233');
      scope.style.setProperty('--wui-color-primary-active', '#223344');
    });
    await button.hover();
    await expect(button).toHaveCSS('background-color', 'rgb(17, 34, 51)');
    await button.evaluate((element) => {
      element.style.setProperty('--wui-color-primary', '#1d4ed8');
    });
    await expect(button).toHaveCSS('background-color', 'rgb(17, 34, 51)');
    await page.mouse.down();
    await expect(button).toHaveCSS('background-color', 'rgb(34, 51, 68)');
    await page.mouse.up();
    const nested = page.getByTestId('light-button');
    await nested.evaluate((element) => {
      element.style.setProperty('--wui-color-primary-hover', '#334455');
    });
    await nested.hover();
    await expect(nested).toHaveCSS('background-color', 'rgb(51, 68, 85)');
    await button.hover();
    await expect(button).toHaveCSS('background-color', 'rgb(17, 34, 51)');
    const sibling = page.getByTestId('counter');
    await sibling.hover();
    expect(await backgroundRgb(sibling)).toEqual([13, 104, 97]);
    await page.mouse.down();
    expect(await backgroundRgb(sibling)).toEqual([11, 90, 84]);
    await page.mouse.up();
  },
);

test(
  'outlined consumes the default subtle surface and explicit active state',
  { tag: '@chromium-only' },
  async ({ page }) => {
    await page.goto(
      '/iframe.html?id=wui-contract-button--matrix-and-palette&viewMode=story',
    );
    const button = page.locator('#matrix .wui-button--outlined:enabled');
    await button.hover();
    expect(await backgroundRgb(button)).toEqual([240, 253, 250]);
    await page.mouse.down();
    expect(await backgroundRgb(button)).toEqual([221, 233, 230]);
    await page.mouse.up();
    await button.evaluate((element) => {
      element.style.setProperty('--wui-color-surface-subtle-active', '#ddeeff');
    });
    await page.mouse.down();
    await expect(button).toHaveCSS('background-color', 'rgb(221, 238, 255)');
    await page.mouse.up();
  },
);

test('supports native keyboard activation, visible focus, and disabled tab order', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=wui-contract-button--matrix-and-palette&viewMode=story',
  );
  const button = page.getByTestId('counter');
  await button.focus();
  await expect(button).toBeFocused();
  await expect(button).toHaveCSS('outline-style', 'solid');
  await expect(button).toHaveCSS('outline-width', '2px');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await expect(page.getByTestId('click-count')).toHaveText('Activations: 2');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Destination', { exact: true })).toBeFocused();
  await expect(page.getByTestId('disabled')).toBeDisabled();
});

test('preserves default button, submit, and reset semantics', async ({
  page,
  browserName,
}) => {
  await page.goto(
    '/iframe.html?id=warmsea-button--form-behavior&viewMode=story',
  );
  const form = page.getByRole('region', { name: 'Button form behavior' });
  await expect(form).toBeVisible();
  if (browserName === 'chromium')
    expect(
      (
        await new AxeBuilder({ page })
          .include('[aria-label="Button form behavior"]')
          .analyze()
      ).violations,
    ).toEqual([]);
  await form
    .getByRole('button', { name: 'Default button', exact: true })
    .click();
  await expect(form.locator('output')).toHaveText('Submissions: 0 / Resets: 0');
  await form.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(form.locator('output')).toContainText('Submissions: 1');
  await form.getByLabel('Destination', { exact: true }).fill('Open sea');
  await form.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(form.getByLabel('Destination', { exact: true })).toHaveValue(
    'Warmsea',
  );
  await expect(form.locator('output')).toHaveText('Submissions: 1 / Resets: 1');
});

test(
  'default retains borderless disabled colors through pointer interaction',
  { tag: '@chromium-only' },
  async ({ page }) => {
    await page.goto(
      '/iframe.html?id=wui-contract-button--matrix-and-palette&viewMode=story',
    );
    const button = page.locator('#matrix .wui-button--default:disabled');
    await expect(button).toBeDisabled();
    await expect(button).toHaveCSS('background-color', 'rgb(229, 229, 229)');
    await expect(button).toHaveCSS('color', 'rgb(102, 102, 102)');
    await expect(button).toHaveCSS('border-color', 'rgba(0, 0, 0, 0)');
    await button.hover();
    await page.mouse.down();
    await expect(button).toHaveCSS('background-color', 'rgb(229, 229, 229)');
    await expect(button).toHaveCSS('color', 'rgb(102, 102, 102)');
    await expect(button).toHaveCSS('border-color', 'rgba(0, 0, 0, 0)');
    await page.mouse.up();
  },
);

test(
  'replaces the full primary palette dynamically without changing a sibling theme',
  { tag: '@chromium-only' },
  async ({ page }) => {
    await page.goto(
      '/iframe.html?id=wui-contract-button--matrix-and-palette&viewMode=story',
    );
    await page.getByLabel('Palette', { exact: true }).selectOption('blue');
    const button = page.getByTestId('brand-button');
    await expect(button).toHaveCSS('background-color', 'rgb(29, 78, 216)');
    await button.hover();
    expect(await backgroundRgb(button)).toEqual([26, 69, 190]);
    await page.mouse.down();
    expect(await backgroundRgb(button)).toEqual([22, 59, 164]);
    await page.mouse.up();
    await page.getByTestId('custom-button').hover();
    expect(await backgroundRgb(page.getByTestId('custom-button'))).toEqual([
      140, 16, 50,
    ]);
    await page.getByLabel('Palette', { exact: true }).selectOption('ocean');
    await button.hover();
    expect(await backgroundRgb(button)).toEqual([13, 104, 97]);
  },
);

test(
  'default consumes scoped container states and retains contrast, focus and disabled behavior',
  { tag: '@chromium-only' },
  async ({ page }) => {
    await page.goto(
      '/iframe.html?id=wui-contract-button--matrix-and-palette&viewMode=story',
    );
    const button = page.getByTestId('brand-default');
    await expect(button).toHaveCSS('color', 'rgb(38, 38, 38)');
    expect(await backgroundRgb(button)).toEqual([226, 239, 238]);
    await button.focus();
    await expect(button).toHaveCSS('outline-style', 'solid');
    await button.hover();
    expect(await backgroundRgb(button)).toEqual([207, 228, 226]);
    expect(
      (
        await new AxeBuilder({ page })
          .include('[data-testid="brand-default"]')
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.mouse.down();
    expect(await backgroundRgb(button)).toEqual([188, 217, 214]);
    expect(
      (
        await new AxeBuilder({ page })
          .include('[data-testid="brand-default"]')
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.mouse.up();
    expect(await backgroundRgb(page.getByTestId('custom-default'))).toEqual([
      243, 227, 231,
    ]);
    await expect(page.getByTestId('light-default')).toHaveCSS(
      'color',
      'rgb(41, 37, 36)',
    );
    const disabled = page.getByTestId('default-disabled');
    await expect(disabled).toBeDisabled();
    await disabled.hover();
    await page.mouse.down();
    expect(await backgroundRgb(disabled)).toEqual([229, 229, 229]);
    await page.mouse.up();
    await page.getByLabel('Palette', { exact: true }).selectOption('blue');
    expect(await backgroundRgb(button)).toEqual([228, 234, 250]);
    await button.hover();
    expect(await backgroundRgb(button)).toEqual([210, 220, 247]);
    await page.mouse.down();
    expect(await backgroundRgb(button)).toEqual([192, 205, 244]);
    await page.mouse.up();
  },
);

test(
  'subtle has no visible border or base fill and retains focus, interaction and scoped text colors',
  { tag: '@chromium-only' },
  async ({ page }) => {
    await page.goto(
      '/iframe.html?id=wui-contract-button--matrix-and-palette&viewMode=story',
    );
    const button = page.locator('#matrix .wui-button--subtle:enabled');
    await expect(button).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(button).toHaveCSS('border-color', 'rgba(0, 0, 0, 0)');
    await expect(button).toHaveCSS('color', 'rgb(38, 38, 38)');
    await button.focus();
    await expect(button).toHaveCSS('outline-style', 'solid');
    await expect(button).toHaveCSS('outline-width', '2px');
    await button.hover();
    const hover = await button.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    expect(hover).not.toBe('rgba(0, 0, 0, 0)');
    expect(await backgroundRgb(button)).toEqual([246, 246, 246]);
    await expect(button).toHaveCSS('border-color', 'rgba(0, 0, 0, 0)');
    expect(
      (
        await new AxeBuilder({ page })
          .include('#matrix .wui-button--subtle:enabled')
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.mouse.down();
    expect(
      await button.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    ).not.toBe(hover);
    expect(await backgroundRgb(button)).toEqual([238, 238, 238]);
    await expect(button).toHaveCSS('border-color', 'rgba(0, 0, 0, 0)');
    expect(
      (
        await new AxeBuilder({ page })
          .include('#matrix .wui-button--subtle:enabled')
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.mouse.up();
    await button.evaluate((element) => {
      element.parentElement!.style.setProperty('--wui-color-text', '#881337');
      element.parentElement!.style.setProperty(
        '--wui-color-subtle-hover',
        'rgb(136 19 55 / 4%)',
      );
      element.parentElement!.style.setProperty(
        '--wui-color-subtle-active',
        'rgb(136 19 55 / 8%)',
      );
    });
    await expect(button).toHaveCSS('color', 'rgb(136, 19, 55)');
    await button.hover();
    await expect(button).toHaveCSS(
      'background-color',
      'rgba(136, 19, 55, 0.04)',
    );
    await page.mouse.down();
    await expect(button).toHaveCSS(
      'background-color',
      'rgba(136, 19, 55, 0.08)',
    );
    await page.mouse.up();
    await page.emulateMedia({ forcedColors: 'active' });
    await expect(button).toHaveCSS('border-style', 'solid');
    await expect(button).not.toHaveCSS('border-color', 'rgba(0, 0, 0, 0)');
    await expect(button).toBeVisible();
  },
);

test(
  'has no automated accessibility violations in the baseline and primary hover or active states',
  { tag: '@chromium-only' },
  async ({ page }) => {
    await page.goto(
      '/iframe.html?id=wui-contract-button--matrix-and-palette&viewMode=story',
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    const button = page.getByTestId('counter');
    await button.focus();
    await button.hover();
    expect(
      (
        await new AxeBuilder({ page })
          .include('[data-testid="counter"]')
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.mouse.down();
    expect(
      (
        await new AxeBuilder({ page })
          .include('[data-testid="counter"]')
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.mouse.up();
  },
);
