import { expect, test } from '@playwright/test';

test('built site works under a sub-path', async ({ page, request }) => {
  const base = process.env.E2E_BASE!;
  const manifest = await (
    await request.get(`${base}models/manifest.json`)
  ).json();

  for (const b of manifest.bundles) {
    expect((await request.get(`${base}models/${b.file}`)).status()).toBe(200);
  }
  expect((await request.get(`${base}content/en/index.json`)).status()).toBe(
    200,
  );

  await page.goto(base);
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForTimeout(5000);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
