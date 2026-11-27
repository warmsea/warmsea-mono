import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
test.beforeEach(async ({ page }) => page.goto('/'));
test('Teleport preserves the mounted form and tracks native destination fieldset state', async ({
  page,
}) => {
  await page.goto('/?native&teleport');
  const input = page.getByRole('textbox', { name: 'Native message' });
  const send = page.getByRole('button', { name: 'Native send' });
  const state = page.getByTestId('slot-state');
  const form = await input.evaluateHandle(
    (element) => (element as HTMLTextAreaElement).form!,
  );
  await expect(input).toBeDisabled();
  await expect(state).toHaveText('true/false');
  await page
    .getByRole('button', { name: 'Move to enabled', exact: true })
    .click();
  await expect(input).toBeEnabled();
  await expect(send).toBeEnabled();
  await expect(state).toHaveText('false/true');
  await input.press('Enter');
  await expect(page.getByTestId('submissions')).toHaveText(
    '["  Controlled draft  "]',
  );
  await page
    .getByRole('button', { name: 'Toggle destination fieldset' })
    .click();
  await expect(input).toBeDisabled();
  await expect(send).toBeDisabled();
  await expect(state).toHaveText('true/false');
  await page
    .getByRole('button', { name: 'Move to disabled', exact: true })
    .click();
  await expect(state).toHaveText('true/false');
  await page.getByRole('button', { name: 'Move to first legend' }).click();
  await expect(input).toBeEnabled();
  await expect(send).toBeEnabled();
  await expect(state).toHaveText('false/true');
  await page
    .getByRole('button', { name: 'Move to disabled', exact: true })
    .click();
  await expect(input).toBeDisabled();
  await expect(send).toBeDisabled();
  await expect(state).toHaveText('true/false');
  expect(
    await form.evaluate(
      (element) => element === document.querySelector('form.wui-chat-input'),
    ),
  ).toBe(true);
  await form.dispose();
});
for (const clear of [false, true])
  test(`native reset notifies once and ${clear ? 'accepts parent clearing' : 'retains the controlled draft'}`, async ({
    page,
  }) => {
    await page.goto(`/?native${clear ? '&clear' : ''}`);
    const input = page.getByRole('textbox', { name: 'Native message' });
    const draft = '  Controlled draft  ';
    await expect(input).toHaveValue(draft);
    await page.getByRole('button', { name: 'Reset draft' }).click();
    await expect(page.getByTestId('resets')).toHaveText('1/true');
    await expect(input).toHaveValue(clear ? '' : draft);
    await input.press('Enter');
    await expect(page.getByTestId('submissions')).toHaveText(
      JSON.stringify([clear ? '' : draft]),
    );
    await input.evaluate((element) =>
      (element as HTMLTextAreaElement).form!.reset(),
    );
    await expect(page.getByTestId('resets')).toHaveText('2/true');
    await expect(input).toHaveValue(clear ? '' : draft);
    await input.dispatchEvent('reset', { bubbles: true, cancelable: true });
    await expect(page.getByTestId('resets')).toHaveText('2/true');
  });

test('native required validation stays with the owned form for Enter and Send', async ({
  page,
}) => {
  await page.goto('/?native&required');
  const input = page.getByRole('textbox', { name: 'Native message' });
  expect(
    await input.evaluate(
      (element) =>
        (element as HTMLTextAreaElement).form === element.closest('form'),
    ),
  ).toBe(true);
  await expect(input).not.toHaveAttribute('form');
  await input.press('Enter');
  await expect(page.getByTestId('submissions')).toHaveText('[]');
  await page.getByRole('button', { name: 'Native send' }).click();
  await expect(page.getByTestId('submissions')).toHaveText('[]');
  await input.fill('Valid');
  await input.press('Enter');
  await page.getByRole('button', { name: 'Native send' }).click();
  await expect(page.getByTestId('submissions')).toHaveText('["Valid","Valid"]');
});

for (const legend of [false, true])
  test(`native fieldset slot state refreshes after local disabled transitions${legend ? ' in the first legend' : ''}`, async ({
    page,
  }) => {
    await page.goto(`/?native&fieldset${legend ? '&legend' : ''}`);
    const input = page.getByRole('textbox', { name: 'Native message' });
    const send = page.getByRole('button', { name: 'Native send' });
    const reset = page.getByRole('button', { name: 'Reset draft' });
    await expect(page.getByTestId('slot-state')).toHaveText('true/false');
    await expect(reset).toBeDisabled();
    await page.getByRole('button', { name: 'Toggle local disabled' }).click();
    await expect(page.getByTestId('slot-state')).toHaveText(
      legend ? 'false/true' : 'true/false',
    );
    if (legend) {
      await expect(input).toBeEnabled();
      await expect(send).toBeEnabled();
      await expect(reset).toBeEnabled();
      await reset.click();
      await expect(page.getByTestId('resets')).toHaveText('1/true');
      await expect(input).toHaveValue('  Controlled draft  ');
      await input.press('Enter');
      await send.click();
      await expect(page.getByTestId('submissions')).toHaveText(
        '["  Controlled draft  ","  Controlled draft  "]',
      );
    } else {
      await expect(input).toBeDisabled();
      await expect(send).toBeDisabled();
      await expect(reset).toBeDisabled();
      await input.dispatchEvent('keydown', { key: 'Enter', bubbles: true });
      await input.evaluate((element) =>
        (element as HTMLTextAreaElement).form!.requestSubmit(),
      );
      await expect(page.getByTestId('submissions')).toHaveText('[]');
    }
    await page.getByRole('button', { name: 'Toggle local disabled' }).click();
    await expect(page.getByTestId('slot-state')).toHaveText('true/false');
    await expect(send).toBeDisabled();
    await expect(reset).toBeDisabled();
    await reset.evaluate((element) => (element as HTMLButtonElement).click());
    await expect(page.getByTestId('resets')).toHaveText(
      legend ? '1/true' : '0/false',
    );
  });
test('rejected native edits retain both controlled content and matching height', async ({
  page,
}) => {
  const input = page.getByRole('textbox', { name: 'Message', exact: true });
  await page.getByRole('button', { name: 'Long draft', exact: true }).click();
  await expect.poll(async () => (await input.boundingBox())!.height).toBe(160);
  const stored = await input.inputValue();
  await page
    .getByRole('button', { name: 'Toggle rejected edits', exact: true })
    .click();
  await input.fill('');
  await expect(input).toHaveValue(stored);
  await expect.poll(async () => (await input.boundingBox())!.height).toBe(160);
  await page.getByRole('button', { name: 'Short draft', exact: true }).click();
  await expect
    .poll(async () => (await input.boundingBox())!.height)
    .toBeLessThan(160);
  const height = (await input.boundingBox())!.height;
  await input.fill('Rejected long edit\n'.repeat(30));
  await expect(input).toHaveValue('Short draft');
  await expect
    .poll(async () => (await input.boundingBox())!.height)
    .toBe(height);
});
test('native editing, IME, controlled submission and slot-only content remain independent', async ({
  page,
}) => {
  const input = page.getByRole('textbox', { name: 'Message', exact: true });
  await expect(input).toHaveAccessibleDescription(
    'Enter to send. Shift+Enter for a new line. Your draft is controlled by this demo.',
  );
  await input.fill('  Keep whitespace  ');
  await input.press('Shift+Enter');
  await expect(input).toHaveValue('  Keep whitespace  \n');
  await input.dispatchEvent('compositionstart');
  await input.dispatchEvent('keydown', { key: 'Enter', bubbles: true });
  await expect(page.getByRole('status')).toHaveText('Submitted 0 times');
  await input.dispatchEvent('compositionend');
  await input.press('Enter');
  await expect(page.getByRole('status')).toHaveText('Submitted 1 times');
  await expect(input).toHaveValue('  Keep whitespace  \n');
  await input.fill('');
  await expect(
    page.getByRole('button', { name: 'Send', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Toggle attachment', exact: true })
    .click();
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Submitted 2 times');
  for (const name of [
    'Toggle disabled',
    'Toggle readonly',
    'Toggle fieldset',
  ]) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Send', exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'Remove local attachment' }),
    ).toBeDisabled();
    await page.getByRole('button', { name, exact: true }).click();
  }
});
test('error descriptions, keyboard focus, nested tokens and narrow RTL layout remain accessible', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.locator('main').evaluate((element) => {
    element.setAttribute('dir', 'rtl');
    element.style.setProperty('--wui-color-primary', '#1d4ed8');
    element.style.setProperty(
      '--wui-color-primary-hover',
      'rgb(25.52 68.64 190.08)',
    );
    element.style.setProperty(
      '--wui-color-primary-active',
      'rgb(22.04 59.28 164.16)',
    );
    element.style.setProperty(
      '--wui-color-primary-container',
      'rgb(227.88 233.76 250.32)',
    );
    element.style.setProperty(
      '--wui-color-primary-container-hover',
      'rgb(209.8 219.6 247.2)',
    );
    element.style.setProperty(
      '--wui-color-primary-container-active',
      'rgb(191.72 205.44 244.08)',
    );
    element.style.setProperty('--wui-color-error', '#9f1239');
  });
  await page.getByRole('button', { name: 'Toggle error' }).click();
  const input = page.getByRole('textbox', { name: 'Message', exact: true });
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  const error = page.getByRole('alert');
  await expect(error).toHaveText('Attachment is too large.');
  expect(
    (await input.getAttribute('aria-describedby'))?.split(/\s+/),
  ).toContain(await error.getAttribute('id'));
  await input.fill('Ready');
  await input.focus();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Send', exact: true }),
  ).toBeFocused();
  expect(
    await page
      .getByRole('button', { name: 'Send', exact: true })
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  ).toBe('rgb(29, 78, 216)');
  expect(
    await error.evaluate((element) => getComputedStyle(element).color),
  ).toBe('rgb(159, 18, 57)');
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test('autosizing follows parent edits and local height caps without losing content', async ({
  page,
}) => {
  const input = page.getByRole('textbox', { name: 'Message', exact: true });
  await page.getByRole('button', { name: 'Long draft' }).click();
  await expect.poll(async () => (await input.boundingBox())!.height).toBe(160);
  await page.getByRole('button', { name: 'Short draft' }).click();
  await expect
    .poll(async () => (await input.boundingBox())!.height)
    .toBeLessThan(160);
  await input.fill('A wrapped prompt '.repeat(30));
  await page.setViewportSize({ width: 320, height: 900 });
  await expect.poll(async () => (await input.boundingBox())!.height).toBe(160);
  await page
    .locator('main')
    .evaluate((element) =>
      element.style.setProperty('--wui-chat-input-max-block-size', '14rem'),
    );
  await expect.poll(async () => (await input.boundingBox())!.height).toBe(224);
  expect(
    await input.evaluate(
      (element) => element.scrollHeight > element.clientHeight,
    ),
  ).toBe(true);
  await expect(input).toHaveValue('A wrapped prompt '.repeat(30));
  await expect(
    page.getByRole('button', { name: 'Send', exact: true }),
  ).toBeVisible();
});

async function settledFrames(page: import('@playwright/test').Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

test('uncapped width changes grow and shrink the same controlled draft without vertical overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 900 });
  const input = page.getByRole('textbox', { name: 'Message', exact: true });
  const draft = Array(3)
    .fill('One line that wraps only in a narrow viewport.')
    .join('\n');
  await input.fill(draft);
  await expect
    .poll(async () => (await input.boundingBox())!.height)
    .toBeGreaterThan(56);
  await settledFrames(page);
  const wide = (await input.boundingBox())!;
  expect(wide.height).toBeLessThan(160);
  await page.setViewportSize({ width: 320, height: 900 });
  await expect
    .poll(async () => (await input.boundingBox())!.height)
    .toBeGreaterThan(wide.height);
  const narrow = (await input.boundingBox())!;
  expect(narrow.width).toBeLessThan(wide.width);
  expect(narrow.height).toBeLessThan(160);
  expect(
    await input.evaluate(
      (element) => element.scrollHeight <= element.clientHeight,
    ),
  ).toBe(true);
  await expect(input).toHaveValue(draft);
  await page.setViewportSize({ width: 900, height: 900 });
  await expect
    .poll(async () => (await input.boundingBox())!.height)
    .toBeCloseTo(wide.height, 0);
  expect(
    await input.evaluate(
      (element) => element.scrollHeight <= element.clientHeight,
    ),
  ).toBe(true);
  await expect(input).toHaveValue(draft);
});

test('uncapped inherited font changes grow and restore the draft without vertical overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 900 });
  const input = page.getByRole('textbox', { name: 'Message', exact: true });
  const draft = 'Line one\nLine two\nLine three';
  await input.fill(draft);
  await expect
    .poll(async () => (await input.boundingBox())!.height)
    .toBeGreaterThan(56);
  await settledFrames(page);
  const baseline = (await input.boundingBox())!.height;
  expect(baseline).toBeLessThan(160);
  await page.getByRole('button', { name: 'Toggle font', exact: true }).click();
  await expect(input).toHaveCSS('font-size', '32px');
  await expect(input).toHaveCSS('line-height', '48px');
  await expect
    .poll(async () => (await input.boundingBox())!.height)
    .toBeGreaterThan(baseline);
  expect((await input.boundingBox())!.height).toBeLessThan(160);
  expect(
    await input.evaluate(
      (element) => element.scrollHeight <= element.clientHeight,
    ),
  ).toBe(true);
  await expect(input).toHaveValue(draft);
  await page.getByRole('button', { name: 'Toggle font', exact: true }).click();
  await expect(input).toHaveCSS('font-size', '16px');
  await expect(input).toHaveCSS('line-height', '20px');
  await expect
    .poll(async () => (await input.boundingBox())!.height)
    .toBeCloseTo(baseline, 0);
  expect(
    await input.evaluate(
      (element) => element.scrollHeight <= element.clientHeight,
    ),
  ).toBe(true);
  await expect(input).toHaveValue(draft);
});
