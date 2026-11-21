import { expect, test } from '@playwright/test';

type AtlasHandle = {
  ready: boolean;
  meshCount: () => number;
  meshIds: () => string[];
};

type AtlasGlobal = typeof globalThis & { __atlas?: AtlasHandle };

test('loads the skeletal bundle and registers every mesh', async ({
  page,
  request,
}) => {
  const manifest = await (await request.get('/models/manifest.json')).json();
  const expected = manifest.bundles.find(
    (b: { id: string }) => b.id === 'skeletal',
  ).meshIds.length;
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForFunction(
    () => (globalThis as AtlasGlobal).__atlas?.ready === true,
    null,
    { timeout: 30_000 },
  );
  expect(
    await page.evaluate(() => (globalThis as AtlasGlobal).__atlas?.meshCount()),
  ).toBe(expected);
});

test('shows an error when the skeletal bundle fails', async ({ page }) => {
  await page.route('**/models/skeletal.*.glb', (route) =>
    route.fulfill({ status: 404 }),
  );
  await page.goto('/');
  await expect(page.getByRole('alert')).toHaveText(
    "Couldn't load the skeletal model.",
  );
  await expect(
    page.getByRole('main', { name: 'Anatomy viewer' }),
  ).toBeVisible();
});

test('?debug shows renderer stats', async ({ page }) => {
  await page.goto('/?debug');
  await page.waitForFunction(
    () => (globalThis as AtlasGlobal).__atlas?.ready === true,
    null,
    { timeout: 30_000 },
  );
  await expect(page.getByText(/draw calls [1-9]\d*/)).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/meshes [1-9]\d*/)).toBeVisible();
});
