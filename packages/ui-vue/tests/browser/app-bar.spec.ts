import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator } from '@playwright/test';

async function renderedRgb(
  link: Locator,
  property: 'backgroundColor' | 'color' = 'backgroundColor',
) {
  return link.evaluate((element, property) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Cannot normalize AppBar background');
    context.fillStyle = getComputedStyle(element)[property];
    context.fillRect(0, 0, 1, 1);
    return Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
  }, property);
}

test('icon links expose accessible labels, tooltips, and application-owned current state', async ({
  page,
  browserName,
}) => {
  await page.goto(
    '/iframe.html?id=wui-contract-app-bar--navigation&viewMode=story',
  );
  if (browserName === 'chromium')
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const nav = page.getByRole('navigation', {
    name: 'Primary apps',
    exact: true,
  });
  await expect(nav.getByRole('link')).toHaveCount(4);
  await expect(nav.locator('[aria-current]')).toHaveCount(0);
  const chat = nav.getByRole('link', {
    name: 'Chat',
    exact: true,
  });
  await expect(chat).toHaveAttribute('href', '#app-chat');
  await chat.click();
  await expect(page).toHaveURL(/#app-chat$/);
  await expect(chat).toHaveAttribute('aria-current', 'page');
  await expect(nav.locator('[aria-current]')).toHaveCount(1);
  await expect(chat).not.toHaveAttribute('title');
  await expect(chat).not.toHaveAttribute('aria-describedby');
  await expect(chat).toHaveAccessibleName('Chat');
  await expect(chat).toHaveText('');
  await expect(nav).toHaveCSS('width', '48px');
  await expect(chat).toHaveCSS('min-height', '44px');
  await expect(chat.locator('.wui-app-bar__icon')).toHaveCSS('width', '20px');
  await expect(chat.locator('.wui-app-bar__icon')).toHaveAttribute(
    'aria-hidden',
    'true',
  );
  await chat.hover();
  await expect(
    nav.getByRole('tooltip', { name: 'Chat', exact: true }),
  ).toBeVisible();
  await expect(
    nav.locator(
      '[role="menu"], [role="tablist"], [tabindex], [aria-selected], [aria-live]',
    ),
  ).toHaveCount(0);

  await page.mouse.move(0, 0);
  await page.keyboard.press('Tab');
  await chat.focus();
  await expect(
    nav.getByRole('tooltip', { name: 'Chat', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    nav.getByRole('tooltip', { name: 'Chat', exact: true }),
  ).toBeHidden();
  await expect(chat).toBeFocused();
  await page.goBack();
  await expect(nav.locator('[aria-current]')).toHaveCount(0);
});

test('retains Enter, Space, focus visibility, native tab order, and modifier navigation', async ({
  page,
}, testInfo) => {
  await page.goto(
    '/iframe.html?id=wui-contract-app-bar--navigation&viewMode=story',
  );
  const nav = page.getByRole('navigation', {
    name: 'Primary apps',
    exact: true,
  });
  const links = nav.getByRole('link');
  await links.nth(0).focus();
  await expect(links.nth(0)).toHaveCSS('outline-style', 'solid');
  await expect(links.nth(0)).toHaveCSS('outline-width', '2px');
  await page.keyboard.press('Space');
  await expect(page).not.toHaveURL(/#app-/);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#app-activity$/);
  await links.nth(0).focus();
  await page.keyboard.press('Tab');
  const tabsToLinks = await links
    .nth(1)
    .evaluate((element) => element === document.activeElement);
  if (tabsToLinks) {
    await expect(links.nth(1)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(links.nth(2)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(links.nth(3)).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(links.nth(2)).toBeFocused();
  } else {
    testInfo.annotations.push({
      type: 'browser limitation',
      description:
        'Platform skips native links in Tab order; compare a plain anchor and verify direct focus/Enter.',
    });
    await nav.evaluate((element) => {
      const reference = document.createElement('a');
      reference.href = '#app-settings';
      reference.id = 'app-bar-tab-reference';
      reference.textContent = 'Native reference';
      element.after(reference);
    });
    await links.nth(3).focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('#app-bar-tab-reference')).not.toBeFocused();
    await page
      .locator('#app-bar-tab-reference')
      .evaluate((element) => element.remove());
  }
  // Use a document destination; modified fragment-only navigation varies by browser.
  await links
    .nth(1)
    .evaluate((element) =>
      element.setAttribute(
        'href',
        '/iframe.html?id=wui-contract-app-bar--navigation&viewMode=story&app-bar-new-tab#app-chat',
      ),
    );
  const popupPromise = page.context().waitForEvent('page');
  await links.nth(1).click({ modifiers: ['ControlOrMeta'] });
  const popup = await popupPromise;
  await popup.waitForURL(/#app-chat$/);
  await popup.close();
  await expect(page).toHaveURL(/#app-activity$/);
});

test('constrained height scrolls all icon destinations and keeps long labels accessible', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(
    '/iframe.html?id=wui-contract-app-bar--navigation&viewMode=story',
  );
  const nav = page.getByRole('navigation', {
    name: 'Overflow apps',
    exact: true,
  });
  const metrics = await nav.evaluate((element) => ({
    height: element.clientHeight,
    content: element.scrollHeight,
    width: element.clientWidth,
    contentWidth: element.scrollWidth,
  }));
  expect(metrics.content).toBeGreaterThan(metrics.height);
  expect(metrics.contentWidth).toBeLessThanOrEqual(metrics.width);
  const last = nav.getByRole('link', { name: 'Settings', exact: true });
  await last.focus();
  await expect(last).toBeInViewport();
  expect(await nav.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const bottomGap = await nav.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    const links = element.querySelectorAll('a');
    return (
      element.getBoundingClientRect().top +
      element.clientTop +
      element.clientHeight -
      links[links.length - 1]!.getBoundingClientRect().bottom
    );
  });
  expect(bottomGap).toBeCloseTo(0);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#app-settings$/);
  const first = nav.getByRole('link').first();
  await first.focus();
  await expect(first).toBeInViewport();
  await expect(first).toHaveAccessibleName(
    'Internationalcollaborationworkspace',
  );
  await expect(nav.locator('[role="tooltip"]').first()).toHaveText(
    'Internationalcollaborationworkspace',
  );
  await expect(first).toHaveText('');
  const topGap = await nav.evaluate((element) => {
    element.scrollTop = 0;
    return (
      element.querySelector('a')!.getBoundingClientRect().top -
      element.getBoundingClientRect().top -
      element.clientTop
    );
  });
  expect(topGap).toBeCloseTo(0);
});

test(
  'bottom items use spare space and logical markers follow RTL',
  { tag: '@chromium-only' },
  async ({ page }) => {
    await page.goto(
      '/iframe.html?id=wui-contract-app-bar--navigation&viewMode=story',
    );
    const nav = page.getByRole('navigation', {
      name: 'Primary apps',
      exact: true,
    });
    const top = await nav.locator('ul').first().boundingBox();
    const bottom = await nav.locator('ul').last().boundingBox();
    expect(bottom!.y).toBeGreaterThan(top!.y + top!.height);
    const rtl = page.getByRole('navigation', { name: 'RTL apps', exact: true });
    for (const rail of [nav, rtl]) {
      const gaps = await rail.evaluate((element) => {
        const links = element.querySelectorAll('a');
        const rect = element.getBoundingClientRect();
        return {
          top:
            links[0]!.getBoundingClientRect().top -
            rect.top -
            element.clientTop,
          bottom:
            rect.top +
            element.clientTop +
            element.clientHeight -
            links[links.length - 1]!.getBoundingClientRect().bottom,
        };
      });
      expect(gaps.top).toBeCloseTo(0);
      expect(gaps.bottom).toBeCloseTo(0);
    }
    const marker = await rtl
      .locator('.wui-app-bar__indicator')
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          width: style.borderRightWidth,
          color: style.borderRightColor,
          height: style.height,
          right: style.right,
        };
      });
    expect(marker).toEqual({
      width: '3px',
      color: 'rgb(15, 118, 110)',
      height: '20px',
      right: '0px',
    });
  },
);

test('current marker stays aligned after rail resizing, spacing changes and scrolling', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=wui-contract-app-bar--navigation&viewMode=story#app-settings',
  );
  const nav = page.getByRole('navigation', {
    name: 'Primary apps',
    exact: true,
  });
  const alignment = (rail = nav) =>
    rail.evaluate((element) => {
      const current = element
        .querySelector('[aria-current="page"]')!
        .getBoundingClientRect();
      const marker = element
        .querySelector('.wui-app-bar__indicator')!
        .getBoundingClientRect();
      return Math.abs(
        marker.top + marker.height / 2 - current.top - current.height / 2,
      );
    });
  await expect.poll(alignment).toBeLessThan(1);
  await page.locator('#app-bar-shell').evaluate((element) => {
    element.style.height = '18rem';
  });
  await expect.poll(alignment).toBeLessThan(1);
  await nav.getByRole('link', { name: 'Calendar', exact: true }).click();
  await nav.evaluate((element) => {
    element.style.setProperty('--wui-space-1', '0.75rem');
  });
  await expect.poll(alignment).toBeLessThan(1);
  await nav.evaluate((element) => {
    element.style.height = '5rem';
  });
  const current = nav.locator('[aria-current]');
  await current.focus();
  expect(await nav.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect.poll(alignment).toBeLessThan(1);
  const overflowRail = page.getByRole('navigation', {
    name: 'Overflow apps',
    exact: true,
  });
  const overflowItem = overflowRail.locator('[aria-current]');
  const previousHeight = await overflowItem.evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '125%';
  });
  expect(
    await overflowItem.evaluate(
      (element) => element.getBoundingClientRect().height,
    ),
  ).toBeGreaterThan(previousHeight);
  await expect.poll(() => alignment(overflowRail)).toBeLessThan(1);
});

test(
  'current marker follows inter-group spacing changes without resizing links or groups',
  { tag: '@chromium-only' },
  async ({ page }) => {
    await page.goto(
      '/iframe.html?id=wui-contract-app-bar--navigation&viewMode=story#app-settings',
    );
    const nav = page.getByRole('navigation', {
      name: 'Primary apps',
      exact: true,
    });
    await nav.evaluate((element) => {
      element.style.height = '5rem';
    });
    const alignment = () =>
      nav.evaluate((element) => {
        const current = element
          .querySelector('[aria-current="page"]')!
          .getBoundingClientRect();
        const marker = element
          .querySelector('.wui-app-bar__indicator')!
          .getBoundingClientRect();
        return Math.abs(
          marker.top + marker.height / 2 - current.top - current.height / 2,
        );
      });
    await expect.poll(alignment).toBeLessThan(1);
    const heights = () =>
      nav.evaluate((element) =>
        [element, ...element.querySelectorAll('ul, a')].map(
          (target) => target.getBoundingClientRect().height,
        ),
      );
    const initialHeights = await heights();
    for (const gap of ['3rem', '0.5rem']) {
      await page.locator('#app-bar-shell').evaluate((element, value) => {
        element.style.setProperty('--wui-space-4', value);
      }, gap);
      await expect.poll(alignment).toBeLessThan(1);
      expect(await heights()).toEqual(initialHeights);
    }
  },
);

test(
  'semantic surface states override AppBar independently of its primary marker',
  { tag: '@chromium-only' },
  async ({ page }) => {
    await page.goto(
      '/iframe.html?id=wui-contract-app-bar--navigation&viewMode=story',
    );
    const nav = page.getByRole('navigation', {
      name: 'Outer brand apps',
      exact: true,
    });
    await nav.evaluate((element) => {
      element.style.setProperty('--wui-color-surface-hover', '#112233');
      element.style.setProperty('--wui-color-surface-active', '#223344');
    });
    const link = nav.locator('[aria-current]');
    await link.hover();
    await expect(link).toHaveCSS('background-color', 'rgb(17, 34, 51)');
    await page.mouse.down();
    await expect(link).toHaveCSS('background-color', 'rgb(34, 51, 68)');
    await page.mouse.up();
    await expect(link).toHaveCSS('color', 'rgb(29, 78, 216)');
  },
);

test(
  'compact surface, accent markers, and explicit neutral palettes retain scoped colors',
  { tag: '@chromium-only' },
  async ({ page }) => {
    await page.goto(
      '/iframe.html?id=wui-contract-app-bar--navigation&viewMode=story',
    );
    const outer = page.getByRole('navigation', {
      name: 'Outer brand apps',
      exact: true,
    });
    const inner = page.getByRole('navigation', {
      name: 'Inner brand apps',
      exact: true,
    });
    const current = outer.locator('[aria-current]');
    expect(await renderedRgb(outer)).toEqual([255, 255, 255]);
    expect(await renderedRgb(inner)).toEqual([255, 247, 237]);
    await expect(current).toHaveCSS('color', 'rgb(29, 78, 216)');
    await expect(current).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(inner.locator('[aria-current]')).toHaveCSS(
      'color',
      'rgb(159, 18, 57)',
    );
    await expect(outer.locator('.wui-app-bar__indicator')).toHaveCSS(
      'border-inline-start-color',
      'rgb(29, 78, 216)',
    );
    await current.hover();
    expect(await renderedRgb(current)).toEqual([246, 246, 246]);
    await page.mouse.down();
    expect(await renderedRgb(current)).toEqual([238, 238, 238]);
    await page.mouse.up();
    await page.mouse.move(0, 0);
    await page
      .getByTestId('app-bar-outer')
      .evaluate((element) =>
        element.style.setProperty('--wui-color-primary', '#0f766e'),
      );
    await expect(current).toHaveCSS('color', 'rgb(15, 118, 110)');
    await expect(inner.locator('.wui-app-bar__indicator')).toHaveCSS(
      'border-inline-start-color',
      'rgb(159, 18, 57)',
    );
    expect(await renderedRgb(outer.getByRole('link').first(), 'color')).toEqual(
      [99, 99, 99],
    );
  },
);

test(
  'enlarged icons remain reachable and forced colors preserve state and focus',
  { tag: '@chromium-only' },
  async ({ page }) => {
    await page.goto(
      '/iframe.html?id=wui-contract-app-bar--navigation&viewMode=story',
    );
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    const nav = page.getByRole('navigation', {
      name: 'Primary apps',
      exact: true,
    });
    await expect(nav).toHaveCSS('font-size', '32px');
    const last = nav.getByRole('link').last();
    await last.focus();
    await expect(last).toBeInViewport();
    await page.emulateMedia({ forcedColors: 'active' });
    await page.keyboard.press('Enter');
    await expect(last).toHaveAttribute('aria-current', 'page');
    await expect(nav.locator('.wui-app-bar__indicator')).toHaveCSS(
      'border-inline-start-style',
      'solid',
    );
    await page.keyboard.press('Tab');
    await last.focus();
    await expect(last).toHaveCSS('outline-style', 'solid');
    await expect(last.locator('.wui-app-bar__icon')).toHaveCSS('width', '40px');
    await expect(last).toHaveAccessibleName('Settings');
  },
);

test(
  'current marker slides between destinations and respects reduced motion',
  { tag: '@chromium-only' },
  async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/iframe.html?id=warmsea-app-bar--demos&viewMode=story');
    const nav = page.getByRole('navigation', {
      name: 'Base apps',
      exact: true,
    });
    const marker = nav.locator('.wui-app-bar__indicator');
    await expect(marker).toBeVisible();
    expect(
      await marker.evaluate((element) => element.getAnimations().length),
    ).toBe(0);
    await expect(marker).toHaveCSS('transition-duration', '0.2s');
    await expect(marker).toHaveCSS('transition-delay', '0s');
    await expect(nav.getByRole('link').first()).toHaveCSS(
      'transition-duration',
      '0.08s, 0.08s',
    );
    const motion = await nav.evaluate(async (element) => {
      const indicator = element.querySelector<HTMLElement>(
        '.wui-app-bar__indicator',
      )!;
      const initial = Number.parseFloat(getComputedStyle(indicator).top);
      element
        .querySelector<HTMLAnchorElement>('a[href="#appbar-demo-calendar"]')!
        .click();
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      const transition = indicator
        .getAnimations()
        .find(
          (animation) =>
            'transitionProperty' in animation &&
            animation.transitionProperty === 'top',
        );
      if (!transition)
        throw new Error('Current marker did not start a top transition');
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      const intermediate = Number.parseFloat(getComputedStyle(indicator).top);
      const duration = transition.effect?.getTiming().duration;
      await transition.finished;
      return {
        initial,
        intermediate,
        duration,
        final: Number.parseFloat(getComputedStyle(indicator).top),
      };
    });
    expect(motion.duration).toBe(200);
    expect(motion.intermediate).not.toBe(motion.initial);
    expect(motion.intermediate).not.toBe(motion.final);
    expect(motion.final).toBeGreaterThan(motion.initial);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await nav.getByRole('link', { name: 'Activity', exact: true }).click();
    await expect(marker).toHaveCSS('transition-duration', '0s');
    await expect(marker).toHaveCSS('top', `${motion.initial}px`);
    await expect(nav.getByRole('link').first()).toHaveCSS(
      'transition-duration',
      '0s',
    );
    expect(
      await marker.evaluate((element) => element.getAnimations().length),
    ).toBe(0);
  },
);
