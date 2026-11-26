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
  await expect(page.getByRole('alert')).toHaveCount(0);
  const search = page.getByRole('combobox');
  await expect(search).toBeVisible({ timeout: 30_000 });

  // Verify settings still shows Available offline and language switching works offline
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByText('Available offline')).toBeVisible();
  await page.getByRole('radio', { name: 'Türkçe' }).click();
  await expect(page.getByText('Çevrimdışı kullanılabilir')).toBeVisible();
  await page.getByRole('radio', { name: 'English' }).click();
  await page.keyboard.press('Escape');

  // Verify another system loads cleanly offline with real localized structure prose
  await search.click();
  await search.fill('Deltoid');
  await page.getByRole('option', { name: /deltoid/i }).first().click();

  const inspector = page.getByRole('complementary', {
    name: /structure details/i,
  });
  await expect(inspector).toBeVisible({ timeout: 30_000 });
  await expect(inspector).toContainText(/shoulder|deltoid|clavicle/i);

  // Verify Motion demos JSON loads cleanly from SW cache offline
  await page.getByRole('tab', { name: 'Motion' }).click();
  await expect(
    page.getByRole('button', { name: /Elbow flexion/i }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('alert')).toHaveCount(0);
});
