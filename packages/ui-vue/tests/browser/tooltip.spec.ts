import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('descriptions exist while closed and hover opens by the next frame without focus changes', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=wui-contract-tooltip--positioning&viewMode=story',
  );
  const root = page.getByTestId('tooltip-top');
  const button = root.getByRole('button');
  const surface = root.locator('[role="tooltip"]');
  await expect(button).toHaveAccessibleDescription(
    'Download the current results as CSV',
  );
  await expect(surface).toBeHidden();
  await expect(root).not.toHaveAttribute('title');
  await root.scrollIntoViewIfNeeded();
  const result = await root.evaluate(async (element) => {
    const focus = document.activeElement;
    element.dispatchEvent(
      new PointerEvent('pointerenter', { pointerType: 'mouse' }),
    );
    await new Promise(requestAnimationFrame);
    return {
      open: element.querySelector('[role="tooltip"]')!.matches(':popover-open'),
      focusPreserved: document.activeElement === focus,
    };
  });
  expect(result).toEqual({ open: true, focusPreserved: true });
  await expect(surface).toHaveCSS('transition-duration', '0s');
  await expect(
    root.locator('[tabindex], [aria-live], [autofocus]'),
  ).toHaveCount(0);
});

test('keyboard focus opens immediately and Escape persists until a new interaction', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=wui-contract-tooltip--positioning&viewMode=story',
  );
  const root = page.getByTestId('tooltip-top');
  const button = root.getByRole('button');
  const surface = root.getByRole('tooltip');
  await page.keyboard.press('Tab');
  await button.focus();
  await expect(surface).toBeVisible();
  await expect(button).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(surface).toBeHidden();
  await expect(button).toHaveAccessibleDescription(
    'Download the current results as CSV',
  );
  await expect(button).toBeFocused();
  await page.locator('#tooltip-copy').evaluate((element: HTMLInputElement) => {
    element.value = 'Changed while dismissed';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(surface).toBeHidden();
  await page.keyboard.press('ArrowRight');
  await button.dispatchEvent('focusin');
  await expect(surface).toBeHidden();
  await button.evaluate((element) => element.blur());
  await button.focus();
  await expect(surface).toHaveText('Changed while dismissed');
  await expect(surface).toBeVisible();
});

for (const dismissed of [false, true]) {
  test(`keyboard focus reopens a keyed replacement after ${dismissed ? 'Escape dismissal' : 'an open hint'}`, async ({
    page,
  }) => {
    await page.goto(
      '/iframe.html?id=wui-contract-tooltip--positioning&viewMode=story',
    );
    const root = page.getByTestId('tooltip-top');
    const button = root.getByRole('button');
    const surface = root.getByRole('tooltip');
    await page.locator('#tooltip-copy').focus();
    await page.keyboard.press('Tab');
    await expect(button).toBeFocused();
    await expect(surface).toBeVisible();
    if (dismissed) {
      await page.keyboard.press('Escape');
      await expect(surface).toBeHidden();
    }
    const original = await button.elementHandle();
    await root.dispatchEvent('replace-trigger');
    await expect
      .poll(() => original!.evaluate((element) => element.isConnected))
      .toBe(false);
    await expect(surface).toBeHidden();
    await page.locator('#tooltip-copy').focus();
    await page.keyboard.press('Tab');
    await expect(button).toBeFocused();
    expect(
      await button.evaluate((element) => element.matches(':focus-visible')),
    ).toBe(true);
    await expect(surface).toBeVisible();
  });
}

test('hoverable gap bridge survives slow pointer movement and focus independently keeps the hint open', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=wui-contract-tooltip--positioning&viewMode=story',
  );
  const root = page.getByTestId('tooltip-top');
  const button = root.getByRole('button');
  const surface = root.getByRole('tooltip');
  await button.hover();
  await expect(surface).toBeVisible();
  const from = (await button.boundingBox())!;
  const to = (await surface.boundingBox())!;
  for (let step = 1; step <= 12; step++) {
    const fraction = step / 12;
    await page.mouse.move(
      from.x +
        from.width / 2 +
        (to.x + to.width / 2 - from.x - from.width / 2) * fraction,
      from.y +
        from.height / 2 +
        (to.y + to.height / 2 - from.y - from.height / 2) * fraction,
    );
    await page.waitForTimeout(30);
    await expect(surface).toBeVisible();
  }
  await page.mouse.move(0, 0);
  await expect(surface).toBeHidden();
  await page.keyboard.press('Tab');
  await button.focus();
  await button.hover();
  await page.mouse.move(0, 0);
  await expect(surface).toBeVisible();
  await button.evaluate((element) => element.blur());
  await expect(surface).toBeHidden();
});

for (const [placement, style, side] of [
  ['top', 'top:1px;left:100px', 'bottom'],
  ['bottom', 'bottom:1px;left:100px', 'top'],
  ['inline-start', 'top:100px;left:1px', 'right'],
  ['inline-end', 'top:100px;right:1px', 'left'],
]) {
  test(
    `${placement} flips at its viewport edge without covering the trigger`,
    { tag: placement === 'top' ? [] : '@chromium-only' },
    async ({ page }) => {
      await page.goto(
        '/iframe.html?id=wui-contract-tooltip--positioning&viewMode=story',
      );
      const root = page.getByTestId(`tooltip-${placement}`);
      await root.evaluate((element, style) => {
        element.style.cssText = `position:fixed;${style}`;
      }, style!);
      await root.getByRole('button').hover();
      const surface = root.getByRole('tooltip');
      await expect(surface).toHaveAttribute('data-side', side!);
      const bounds = (await surface.boundingBox())!;
      const viewport = page.viewportSize()!;
      expect(bounds.x).toBeGreaterThanOrEqual(8);
      expect(bounds.y).toBeGreaterThanOrEqual(8);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width - 8);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height - 8);
    },
  );
}

test('native top layer escapes clipping and transforms, then closes when its focused trigger is scrolled out', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=wui-contract-tooltip--positioning&viewMode=story',
  );
  const root = page.getByTestId('tooltip-clipped');
  const button = root.getByRole('button');
  await page.keyboard.press('Tab');
  await button.focus();
  const surface = root.getByRole('tooltip');
  await expect(surface).toBeVisible();
  const anchor = (await button.boundingBox())!;
  const bounds = (await surface.boundingBox())!;
  const clip = (await page.getByTestId('tooltip-clip').boundingBox())!;
  expect(Math.abs(bounds.x - anchor.x - anchor.width - 8)).toBeLessThan(1);
  expect(bounds.x + bounds.width).toBeGreaterThan(clip.x + clip.width);
  expect(
    await surface.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return (
        document.elementFromPoint(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
        ) === element
      );
    }),
  ).toBe(true);
  await page.getByTestId('tooltip-clip').evaluate((element) => {
    element.scrollTop = 140;
  });
  await expect(surface).toBeHidden();
});

for (const state of ['hidden', 'removed']) {
  test(
    `the top-layer hint closes when its trigger is ${state}`,
    { tag: state === 'removed' ? [] : '@chromium-only' },
    async ({ page }) => {
      await page.goto(
        '/iframe.html?id=wui-contract-tooltip--positioning&viewMode=story',
      );
      const root = page.getByTestId('tooltip-top');
      const button = root.getByRole('button');
      await button.hover();
      const surface = root.getByRole('tooltip');
      await expect(surface).toBeVisible();
      await button.evaluate((element, nextState) => {
        if (nextState === 'hidden') element.style.visibility = 'hidden';
        else element.remove();
      }, state);
      await expect(surface).toBeHidden();
    },
  );
}

test('open positioning follows layout shifts, content resizing, and logical RTL sides', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=wui-contract-tooltip--positioning&viewMode=story',
  );
  const root = page.getByTestId('tooltip-inline-end');
  const button = root.getByRole('button');
  await page.keyboard.press('Tab');
  await button.focus();
  const surface = root.getByRole('tooltip');
  await expect(surface).toHaveAttribute('data-side', 'right');
  await root.evaluate((element) => {
    element.style.transform = 'translate(32px, 20px)';
  });
  await expect
    .poll(async () => {
      const tip = (await surface.boundingBox())!;
      const anchor = (await button.boundingBox())!;
      return Math.abs(tip.x - anchor.x - anchor.width - 8);
    })
    .toBeLessThan(1);
  await root.evaluate((element) => {
    element.setAttribute('dir', 'rtl');
  });
  await expect(surface).toHaveAttribute('data-side', 'left');
  await page.locator('#tooltip-copy').evaluate((element: HTMLInputElement) => {
    element.value =
      'A longer description that wraps while the tooltip is already open';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(surface).toContainText('A longer description');
  await expect
    .poll(async () => {
      const tip = (await surface.boundingBox())!;
      const anchor = (await button.boundingBox())!;
      return Math.abs(anchor.x - tip.x - tip.width - 8);
    })
    .toBeLessThan(1);
});

test(
  'AppBar hints preserve local theme and direction without redundant accessible descriptions',
  { tag: '@chromium-only' },
  async ({ page }) => {
    await page.goto(
      '/iframe.html?id=wui-contract-app-bar--navigation&viewMode=story',
    );
    const nav = page.getByRole('navigation', {
      name: 'Inner brand apps',
      exact: true,
    });
    const button = nav.getByRole('link', { name: 'Chat', exact: true });
    await nav.evaluate((element) => {
      element.setAttribute('dir', 'rtl');
    });
    await button.hover();
    const surface = nav.getByRole('tooltip', { name: 'Chat', exact: true });
    await expect(surface).toHaveAttribute('data-side', 'left');
    await expect(surface).toHaveCSS('color', 'rgb(255, 247, 237)');
    await page.getByTestId('app-bar-inner').evaluate((element) => {
      element.style.setProperty('--wui-color-text', '#881337');
      element.style.setProperty('--wui-font-size', '18px');
    });
    await expect(surface).toHaveCSS('background-color', 'rgb(136, 19, 55)');
    await expect(surface).toHaveCSS('font-size', '18px');
    await expect(button).toHaveAccessibleName('Chat');
    await expect(button).toHaveAccessibleDescription('');
    await expect(button).not.toHaveAttribute('title');
  },
);

test(
  'touch pointer events do not toggle hints, and native form submission still works',
  { tag: '@chromium-only' },
  async ({ page }) => {
    await page.goto(
      '/iframe.html?id=wui-contract-tooltip--positioning&viewMode=story',
    );
    const root = page.getByTestId('tooltip-submit');
    const button = root.getByRole('button');
    await root.scrollIntoViewIfNeeded();
    await root.dispatchEvent('pointerenter', { pointerType: 'touch' });
    await root.dispatchEvent('pointerdown', { pointerType: 'touch' });
    await button.focus();
    await expect(root.getByRole('tooltip')).toBeHidden();
    await button.dispatchEvent('click');
    await expect(page.getByTestId('tooltip-submits')).toHaveText('1');
  },
);

test('closing a tooltip cancels all frame tracking', async ({ page }) => {
  await page.goto(
    '/iframe.html?id=wui-contract-tooltip--positioning&viewMode=story',
  );
  const root = page.getByTestId('tooltip-top');
  await root.scrollIntoViewIfNeeded();
  const result = await root.evaluate(async (element) => {
    const original = window.requestAnimationFrame;
    let calls = 0;
    window.requestAnimationFrame = (callback) => {
      calls++;
      return original.call(window, callback);
    };
    try {
      element.dispatchEvent(
        new PointerEvent('pointerenter', { pointerType: 'mouse' }),
      );
      await new Promise((resolve) => setTimeout(resolve, 80));
      const active = calls;
      element.dispatchEvent(
        new PointerEvent('pointerleave', { pointerType: 'mouse' }),
      );
      const closed = calls;
      await new Promise((resolve) => setTimeout(resolve, 80));
      return { active, closed, after: calls };
    } finally {
      window.requestAnimationFrame = original;
    }
  });
  expect(result.active).toBeGreaterThan(0);
  expect(result.after).toBe(result.closed);
});

test(
  'narrow screens, enlarged text and forced colors retain readable, accessible hints',
  { tag: '@chromium-only' },
  async ({ page }) => {
    await page.goto(
      '/iframe.html?id=wui-contract-tooltip--positioning&viewMode=story',
    );
    await page.setViewportSize({ width: 390, height: 900 });
    await page
      .locator('#tooltip-copy')
      .fill('Internationalcollaborationworkspace information');
    const root = page.getByTestId('tooltip-top');
    await root.getByRole('button').hover();
    const surface = root.getByRole('tooltip');
    await expect(surface).toBeVisible();
    expect((await surface.boundingBox())!.width).toBeLessThanOrEqual(374);
    await page.mouse.move(0, 0);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await page.keyboard.press('Tab');
    await root.getByRole('button').focus();
    await expect(surface).toHaveCSS('font-size', '32px');
    expect(
      (
        await new AxeBuilder({ page })
          .include('[data-testid="tooltip-top"]')
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.emulateMedia({
      forcedColors: 'active',
      reducedMotion: 'reduce',
    });
    await expect(surface).toBeVisible();
    await expect(surface).toHaveCSS('border-style', 'solid');
  },
);
