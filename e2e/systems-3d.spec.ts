import { expect, test, type Page } from './fixtures';

type AtlasTestGlobal = typeof globalThis & {
  __atlas?: {
    ready: boolean;
    getState: () => {
      assets: { bundles: Record<string, string> };
      systems: Record<string, { enabled: boolean; opacity: number }>;
    };
    screenPointOf: (id: string) => { x: number; y: number } | null;
    waitIdle: () => Promise<void>;
    meshVisible: (id: string) => boolean;
  };
};

async function waitForAtlas(page: Page) {
  await page.goto('/');
  await page.waitForFunction(
    () => (globalThis as AtlasTestGlobal).__atlas?.ready === true,
    null,
    { timeout: 30_000 },
  );
  await page.evaluate(() =>
    (globalThis as AtlasTestGlobal).__atlas?.waitIdle(),
  );
}

test('Lymphatic system loads and spleen picks into Inspector', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await waitForAtlas(page);

  await page.getByRole('switch', { name: 'Lymphatic' }).click();
  await page.waitForFunction(
    () =>
      (globalThis as AtlasTestGlobal).__atlas?.getState().assets.bundles
        .lymphatic === 'ready',
    null,
    { timeout: 30_000 },
  );
  await page.evaluate(() =>
    (globalThis as AtlasTestGlobal).__atlas?.waitIdle(),
  );

  expect(
    await page.evaluate(() =>
      (globalThis as AtlasTestGlobal).__atlas?.meshVisible('spleen'),
    ),
  ).toBe(true);

  const search = page.getByRole('combobox', { name: 'Search structures' });
  await search.click();
  await search.fill('Spleen');
  await page
    .getByRole('option', { name: /Spleen/i })
    .first()
    .click();

  const inspector = page.getByRole('complementary', {
    name: 'Structure details',
  });
  await expect(inspector).toBeVisible();
  await expect(
    inspector.getByRole('heading', { name: 'Spleen' }),
  ).toBeVisible();
  await expect(inspector).toContainText('Lymphatic');
  expect(pageErrors).toEqual([]);
});

test('Integumentary skin defaults to 0.35 opacity and lets clicks pick bones underneath', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await waitForAtlas(page);

  await page.getByRole('switch', { name: 'Integumentary' }).click();
  await page.waitForFunction(
    () =>
      (globalThis as AtlasTestGlobal).__atlas?.getState().assets.bundles
        .skin === 'ready',
    null,
    { timeout: 30_000 },
  );
  await page.evaluate(() =>
    (globalThis as AtlasTestGlobal).__atlas?.waitIdle(),
  );

  const skinState = await page.evaluate(() => ({
    opacity:
      (globalThis as AtlasTestGlobal).__atlas?.getState().systems.integumentary
        ?.opacity ?? -1,
    visible:
      (globalThis as AtlasTestGlobal).__atlas?.meshVisible(
        'presternal-region--l',
      ) ?? false,
  }));
  expect(skinState.opacity).toBeCloseTo(0.35, 2);
  expect(skinState.visible).toBe(true);

  const sternumPt = await page.evaluate(() =>
    (globalThis as AtlasTestGlobal).__atlas?.screenPointOf('body-of-sternum'),
  );
  expect(sternumPt).not.toBeNull();
  await page.mouse.click(sternumPt!.x, sternumPt!.y);

  const inspector = page.getByRole('complementary', {
    name: 'Structure details',
  });
  await expect(inspector).toBeVisible();
  await expect(
    inspector.getByRole('heading', { name: 'Body of sternum' }),
  ).toBeVisible();
  expect(pageErrors).toEqual([]);
});
