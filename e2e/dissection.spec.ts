import { expect, test, type Page } from './fixtures';

type AtlasTestGlobal = typeof globalThis & {
  __atlas?: {
    ready: boolean;
    meshCount: () => number;
    meshIds: () => string[];
    select: (ids: string[]) => void;
    getState: () => {
      assets: { bundles: Record<string, string> };
      dissection: { hidden: string[]; isolated: string[] | null };
    };
    dispatch: (action: unknown) => void;
    screenPointOf: (id: string) => { x: number; y: number } | null;
    waitIdle: () => Promise<void>;
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

test('clicking a bone selects it and opens the Inspector', async ({ page }) => {
  await waitForAtlas(page);
  const pt = await page.evaluate(() =>
    (globalThis as AtlasTestGlobal).__atlas?.screenPointOf('femur--l'),
  );
  expect(pt).not.toBeNull();

  await page.mouse.click(pt!.x, pt!.y);
  await expect(
    page.locator('aside[aria-label="Structure details"]'),
  ).toContainText('Femur');
});

test('hover shows a label', async ({ page }) => {
  await waitForAtlas(page);
  const pt = await page.evaluate(() =>
    (globalThis as AtlasTestGlobal).__atlas?.screenPointOf('femur--l'),
  );
  expect(pt).not.toBeNull();

  await page.mouse.move(pt!.x, pt!.y);
  await expect(page.getByText('Femur (left)')).toBeVisible();
});

test('hide then undo', async ({ page }) => {
  await waitForAtlas(page);
  await page.evaluate(() =>
    (globalThis as AtlasTestGlobal).__atlas?.select(['femur--l']),
  );

  await page.getByRole('button', { name: 'Hide' }).click();
  await expect(
    page.locator('aside[aria-label="Structure details"]'),
  ).toHaveCount(0);

  const hidden = await page.evaluate(
    () => (globalThis as AtlasTestGlobal).__atlas?.getState().dissection.hidden,
  );
  expect(hidden).toContain('femur--l');

  await page.keyboard.press(
    process.platform === 'darwin' ? 'Meta+z' : 'Control+z',
  );
  const restored = await page.evaluate(
    () => (globalThis as AtlasTestGlobal).__atlas?.getState().dissection.hidden,
  );
  expect(restored).toEqual([]);
});

test('isolate then show all', async ({ page }) => {
  await waitForAtlas(page);
  await page.evaluate(() =>
    (globalThis as AtlasTestGlobal).__atlas?.select(['femur--l']),
  );

  await page.getByRole('button', { name: 'Isolate' }).click();
  await expect(
    page.getByRole('button', { name: 'Exit isolate' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Show all' }).click();
  const isolated = await page.evaluate(
    () =>
      (globalThis as AtlasTestGlobal).__atlas?.getState().dissection.isolated,
  );
  expect(isolated).toBeNull();
});

test('right-drag pans without opening the menu', async ({ page }) => {
  await waitForAtlas(page);
  const box = page.viewportSize()!;
  const cx = box.width / 2;
  const cy = box.height / 2;

  await page.mouse.move(cx, cy);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(cx + 60, cy, { steps: 5 });
  await page.mouse.up({ button: 'right' });

  await expect(page.getByRole('menu')).toHaveCount(0);
});

test('right-click on a bone opens the menu', async ({ page }) => {
  await waitForAtlas(page);
  const pt = await page.evaluate(() =>
    (globalThis as AtlasTestGlobal).__atlas?.screenPointOf('femur--l'),
  );
  expect(pt).not.toBeNull();

  await page.mouse.click(pt!.x, pt!.y, { button: 'right' });
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: /Focus/ })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: /Isolate/ })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: /Hide/ })).toBeVisible();
  await expect(
    menu.getByRole('menuitem', { name: /Fade others/ }),
  ).toBeVisible();
});

test('right-click on empty space opens the reset menu', async ({ page }) => {
  await waitForAtlas(page);
  await page.mouse.click(340, 400, { button: 'right' });
  const menu = page.getByRole('menu', { name: 'Dissection actions' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: /Show all/ })).toBeVisible();
  await expect(
    menu.getByRole('menuitem', { name: /Reset view/ }),
  ).toBeVisible();
});

test('presets and reset do not throw', async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (err) => pageErrors.push(err));

  await waitForAtlas(page);
  const labels = [
    'Anterior view',
    'Posterior view',
    'Left lateral view',
    'Right lateral view',
    'Superior view',
    'Inferior view',
    'Reset view',
  ];

  for (const label of labels) {
    await page.getByRole('button', { name: label }).click();
  }
  await page.evaluate(() =>
    (globalThis as AtlasTestGlobal).__atlas?.waitIdle(),
  );

  expect(pageErrors).toEqual([]);
});

test('enabling muscles loads and shows them', async ({ page }) => {
  await waitForAtlas(page);
  await page.getByRole('switch', { name: 'Muscular' }).click();

  await page.waitForFunction(
    () =>
      (globalThis as AtlasTestGlobal).__atlas?.getState().assets.bundles
        .muscular === 'ready',
    null,
    { timeout: 30_000 },
  );

  await expect(page.getByLabel('Loading Muscular')).toHaveCount(0);
});
