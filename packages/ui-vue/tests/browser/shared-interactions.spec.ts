import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('multiline editing preserves native form submission and parent-owned reset', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=wui-contract-shared--forms-and-modal&viewMode=story',
  );
  const notes = page.getByRole('textbox', {
    name: 'Multiline notes',
    exact: true,
  });
  await notes.fill('Ocean\nCoast');
  await page.getByRole('button', { name: 'Submit notes', exact: true }).click();
  await expect(page.getByTestId('notes-submitted')).toHaveText('Ocean\nCoast');
  expect(
    await notes.evaluate((element) =>
      new FormData(element.closest('form')!).get('notes'),
    ),
  ).toBe('Ocean\nCoast');
  await page.getByRole('button', { name: 'Reset notes', exact: true }).click();
  await expect(notes).toHaveValue('');
});
test('native modal contains focus, closes with Escape and restores the pointer invoker', async ({
  page,
  browserName,
}) => {
  await page.goto(
    '/iframe.html?id=wui-contract-shared--forms-and-modal&viewMode=story',
  );
  const invoker = page.getByRole('button', {
    name: 'Open shared dialog',
    exact: true,
  });
  await invoker.click();
  const dialog = page.getByRole('dialog', {
    name: 'Review notes',
    exact: true,
  });
  await expect(dialog).toBeVisible();
  if (browserName === 'chromium')
    expect(
      (await new AxeBuilder({ page }).include('.wui-dialog').analyze())
        .violations,
    ).toEqual([]);
  await expect(
    dialog.getByRole('textbox', { name: 'Dialog notes' }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    dialog.getByRole('button', { name: 'Close shared dialog' }),
  ).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await invoker.evaluate((element) => element.focus());
  await expect(
    dialog.getByRole('textbox', { name: 'Dialog notes' }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(invoker).toBeFocused();
  await invoker.click();
  await dialog.getByRole('button', { name: 'Close shared dialog' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(invoker).toBeFocused();
});
test(
  'embedded fields keep visible focus, invalid and forced-color boundaries',
  { tag: '@chromium-only' },
  async ({ page }) => {
    await page.goto(
      '/iframe.html?id=wui-contract-shared--forms-and-modal&viewMode=story',
    );
    expect(
      (await new AxeBuilder({ page }).include('#shared-interactions').analyze())
        .violations,
    ).toEqual([]);
    const field = page.getByRole('textbox', {
      name: 'Embedded notes',
      exact: true,
    });
    await field.fill('Draft');
    await expect(field).toHaveValue('Draft');
    const colors = await field.evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.borderTopColor, style.backgroundColor];
    });
    expect(colors).toEqual(['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)']);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(field).toBeFocused();
    expect(
      await field.evaluate((element) => getComputedStyle(element).outlineStyle),
    ).toBe('solid');
    const invalid = page.getByRole('textbox', {
      name: 'Embedded invalid notes',
    });
    await expect(invalid).toHaveAttribute('aria-invalid', 'true');
    expect(
      await invalid.evaluate(
        (element) => getComputedStyle(element).borderTopColor,
      ),
    ).not.toBe('rgba(0, 0, 0, 0)');
    await expect(
      page.getByRole('textbox', { name: 'Embedded disabled notes' }),
    ).toBeDisabled();
    await page.emulateMedia({ forcedColors: 'active' });
    for (const control of [
      field,
      invalid,
      page.getByRole('textbox', { name: 'Embedded disabled notes' }),
    ]) {
      expect(
        await control.evaluate(
          (element) => getComputedStyle(element).borderTopColor,
        ),
      ).not.toBe('rgba(0, 0, 0, 0)');
    }
  },
);
