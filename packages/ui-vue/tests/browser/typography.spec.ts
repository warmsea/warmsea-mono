import { expect, test } from '@playwright/test';

test(
  'typography tokens resolve per scope without affecting default text or Button',
  { tag: '@chromium-only' },
  async ({ page }) => {
    await page.goto(
      '/iframe.html?id=wui-contract-typography--scopes&viewMode=story',
    );
    const outerHeading = page.getByTestId('heading-outer');
    await expect(outerHeading).toHaveCSS('font-size', '36px');
    await expect(outerHeading).toHaveCSS('font-weight', '700');
    await expect(outerHeading).toHaveCSS('line-height', '54px');
    await expect(outerHeading).toHaveCSS('color', 'rgb(51, 65, 85)');
    await expect(outerHeading).toHaveCSS('font-family', 'Georgia, serif');
    const innerHeading = page.getByTestId('heading-inner');
    await expect(innerHeading).toHaveCSS('font-size', '24px');
    await expect(innerHeading).toHaveCSS('font-weight', '700');
    await expect(innerHeading).toHaveCSS('line-height', '36px');
    await expect(innerHeading).toHaveCSS('color', 'rgb(41, 37, 36)');
    await expect(innerHeading).toHaveCSS('font-family', 'Georgia, serif');
    for (const id of ['text-outer', 'text-inner']) {
      await expect(page.getByTestId(id)).toHaveCSS('font-size', '20px');
      await expect(page.getByTestId(id)).toHaveCSS('line-height', '35px');
      await expect(page.getByTestId(id)).toHaveCSS(
        'font-family',
        'Georgia, serif',
      );
    }
    await expect(page.getByTestId('text-outer')).toHaveCSS(
      'font-weight',
      '500',
    );
    await expect(page.getByTestId('text-inner')).toHaveCSS(
      'font-weight',
      '400',
    );
    await expect(page.getByTestId('text-inner')).toHaveCSS(
      'color',
      'rgb(41, 37, 36)',
    );
    await expect(page.getByTestId('text-default')).toHaveCSS(
      'font-size',
      '16px',
    );
    await expect(page.getByTestId('counter')).toHaveCSS('font-weight', '600');
    await page.getByTestId('typography-outer').evaluate((element) => {
      element.style.setProperty('--wui-font-size', '1.5rem');
      element.style.setProperty('--wui-color-text', '#171717');
    });
    await expect(page.getByTestId('text-inner')).toHaveCSS('font-size', '24px');
    await expect(page.getByTestId('text-outer')).toHaveCSS(
      'color',
      'rgb(23, 23, 23)',
    );
    await expect(page.getByTestId('text-inner')).toHaveCSS(
      'color',
      'rgb(41, 37, 36)',
    );
  },
);

test(
  'typography reflows at 320px',
  { tag: '@chromium-only' },
  async ({ page }) => {
    await page.goto(
      '/iframe.html?id=wui-contract-typography--scopes&viewMode=story',
    );
    await page.setViewportSize({ width: 320, height: 900 });
    const layout = await page.locator('#typography').evaluate((element) => ({
      content: element.scrollWidth,
      viewport: element.clientWidth,
    }));
    expect(layout.content).toBeLessThanOrEqual(layout.viewport);
  },
);

test(
  'typography scales with a doubled root font size',
  { tag: '@chromium-only' },
  async ({ page }) => {
    await page.goto(
      '/iframe.html?id=wui-contract-typography--scopes&viewMode=story',
    );
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await expect(page.getByTestId('text-default')).toHaveCSS(
      'font-size',
      '32px',
    );
    await expect(page.getByTestId('text-default')).toHaveCSS(
      'line-height',
      '40px',
    );
    await expect(page.locator('#typography-matrix h1')).toHaveCSS(
      'font-size',
      '80px',
    );
    const layout = await page.locator('#typography').evaluate((element) => ({
      content: element.scrollWidth,
      viewport: element.clientWidth,
    }));
    expect(layout.content).toBeLessThanOrEqual(layout.viewport);
  },
);
