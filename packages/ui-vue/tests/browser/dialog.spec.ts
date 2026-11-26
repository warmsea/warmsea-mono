import { expect, test } from '@playwright/test';

test('a queued native close does not dismiss a reopened controlled modal', async ({
  page,
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

  const openAfterClose = await dialog.evaluate(async (element) => {
    const native = element as HTMLDialogElement;
    await new Promise<void>((resolve) => {
      native.addEventListener('close', () => resolve(), { once: true });
      native.close();
      native.showModal();
    });
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    return native.open;
  });

  expect(openAfterClose).toBe(true);
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('textbox', { name: 'Dialog notes' }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(invoker).toBeFocused();
});
