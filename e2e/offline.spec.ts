import { expect, test } from './fixtures';

test('downloads all atlas bundles and content, then reloads and switches systems completely offline', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto('/');

  await page.waitForFunction(
    async () => {
      const nav = (
        globalThis as unknown as {
          navigator?: {
            serviceWorker?: {
              controller?: unknown;
              ready: Promise<unknown>;
            };
          };
        }
      ).navigator;
      if (!nav?.serviceWorker) return false;
      await nav.serviceWorker.ready;
      return Boolean(nav.serviceWorker.controller);
    },
    null,
    { timeout: 30_000 },
  );

  // Wait for bootstrap manifest + SearchBox ready
  await expect(page.getByRole('combobox')).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: 'Settings' }).click();
  const offlineBtn = page.getByRole('button', {
    name: /Make available offline/,
  });
  await expect(offlineBtn).toBeVisible();
  await offlineBtn.click();

  await expect(page.getByText('Available offline')).toBeVisible({
    timeout: 60_000,
  });

  // Go offline and reload
  await page.context().setOffline(true);
  await page.reload();

  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 });
  const search = page.getByRole('combobox');
  await expect(search).toBeVisible({ timeout: 30_000 });

  // Verify settings still shows Available offline while offline
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByText('Available offline')).toBeVisible();
  await page.keyboard.press('Escape');

  // Verify another system loads cleanly offline from cached GLB + cached content JSON
  await search.click();
  await search.fill('Deltoid');
  await page.getByRole('option', { name: /deltoid/i }).first().click();

  await expect(
    page.getByRole('complementary', { name: /structure details/i }),
  ).toBeVisible({ timeout: 30_000 });
});
