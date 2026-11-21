import { expect, test, type Page } from '@playwright/test';

type AtlasMobileGlobal = typeof globalThis & {
  __atlas?: {
    ready: boolean;
    select: (ids: string[]) => void;
    screenPointOf: (id: string) => { x: number; y: number } | null;
    waitIdle: () => Promise<void>;
  };
};

async function waitForAtlas(page: Page) {
  await page.goto('/');
  await page.waitForFunction(
    () => (globalThis as AtlasMobileGlobal).__atlas?.ready === true,
    null,
    { timeout: 30_000 },
  );
  await page.evaluate(() =>
    (globalThis as AtlasMobileGlobal).__atlas?.waitIdle(),
  );
}

test('inspector is a bottom sheet', async ({ page }) => {
  await waitForAtlas(page);
  await page.evaluate(() =>
    (globalThis as AtlasMobileGlobal).__atlas?.select(['femur--l']),
  );

  await expect(
    page.locator('aside[aria-label="Structure details"]'),
  ).toHaveAttribute('data-layout', 'sheet');
});

test('systems panel starts collapsed', async ({ page }) => {
  await waitForAtlas(page);
  await expect(
    page.getByRole('button', { name: 'Expand panel' }),
  ).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Skeletal' })).toHaveCount(0);
});

test('tap selects', async ({ page }) => {
  await waitForAtlas(page);
  const pt = await page.evaluate(() =>
    (globalThis as AtlasMobileGlobal).__atlas?.screenPointOf('femur--l'),
  );
  expect(pt).not.toBeNull();

  await page.touchscreen.tap(pt!.x, pt!.y);
  await expect(
    page.locator('aside[aria-label="Structure details"]'),
  ).toContainText('Femur');
});
