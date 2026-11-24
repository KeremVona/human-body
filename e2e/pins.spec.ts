import { expect, test, type Page } from '@playwright/test';

type AtlasPinGlobal = typeof globalThis & {
  __atlas?: {
    ready: boolean;
    screenPointOf: (id: string) => { x: number; y: number } | null;
    waitIdle: () => Promise<void>;
    dispatch: (action: unknown) => void;
    getState: () => {
      pins: {
        items: { id: string; label: string; note: string }[];
      };
    };
  };
};

async function waitForAtlas(page: Page) {
  await page.goto('/');
  await page.waitForFunction(
    () => (globalThis as AtlasPinGlobal).__atlas?.ready === true,
    null,
    { timeout: 30_000 },
  );
  await page.evaluate(() => (globalThis as AtlasPinGlobal).__atlas?.waitIdle());
}

async function addPinViaContextMenu(
  page: Page,
  pt: { x: number; y: number },
  label: string,
  note?: string,
) {
  await page.mouse.move(pt.x, pt.y);
  await page.mouse.click(pt.x, pt.y, { button: 'right' });
  await page.getByRole('menuitem', { name: 'Add pin' }).click();

  const labelInput = page.getByLabel('Label');
  await labelInput.fill(label);
  if (note !== undefined) {
    await page.getByLabel('Note').fill(note);
  }
  await page.getByRole('button', { name: 'Save' }).click();
}

test('add, persist and delete a pin', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile',
    'Desktop context-menu pin flow',
  );
  await waitForAtlas(page);
  const pt = await page.evaluate(() =>
    (globalThis as AtlasPinGlobal).__atlas?.screenPointOf('femur--l'),
  );
  expect(pt).not.toBeNull();

  await addPinViaContextMenu(page, pt!, 'Test pin');
  await expect(
    page.getByRole('button', { name: 'Pin: Test pin' }),
  ).toBeVisible();

  await page.reload();
  await page.waitForFunction(
    () => (globalThis as AtlasPinGlobal).__atlas?.ready === true,
    null,
    { timeout: 30_000 },
  );
  await page.evaluate(() => (globalThis as AtlasPinGlobal).__atlas?.waitIdle());
  await expect(
    page.getByRole('button', { name: 'Pin: Test pin' }),
  ).toBeVisible();

  await page.getByRole('tab', { name: 'Pins' }).click();
  const listItem = page.locator('li', { hasText: 'Test pin' });
  await expect(listItem).toBeVisible();
  await listItem.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('Pin deleted')).toBeVisible();

  await page.reload();
  await page.waitForFunction(
    () => (globalThis as AtlasPinGlobal).__atlas?.ready === true,
    null,
    { timeout: 30_000 },
  );
  await page.evaluate(() => (globalThis as AtlasPinGlobal).__atlas?.waitIdle());
  await expect(page.getByRole('button', { name: 'Pin: Test pin' })).toHaveCount(
    0,
  );
});

test('pins hide with their mesh', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile',
    'Desktop context-menu and keyboard shortcut flow',
  );
  await waitForAtlas(page);
  const pt = await page.evaluate(() =>
    (globalThis as AtlasPinGlobal).__atlas?.screenPointOf('femur--l'),
  );
  expect(pt).not.toBeNull();

  await addPinViaContextMenu(page, pt!, 'Femur pin');
  await expect(
    page.getByRole('button', { name: 'Pin: Femur pin' }),
  ).toBeVisible();

  await page.mouse.click(pt!.x, pt!.y);
  await page.keyboard.press('h');
  await expect(
    page.getByRole('button', { name: 'Pin: Femur pin' }),
  ).toHaveCount(0);

  await page.keyboard.press('Control+z');
  await expect(
    page.getByRole('button', { name: 'Pin: Femur pin' }),
  ).toBeVisible();
});

test('notes do not overflow', async ({ page }, testInfo) => {
  await waitForAtlas(page);
  const longNote = 'x'.repeat(300);

  if (testInfo.project.name === 'mobile') {
    await page.evaluate((note) => {
      const atlas = (globalThis as AtlasPinGlobal).__atlas!;
      atlas.dispatch({
        type: 'pins/pinAdded',
        payload: {
          meshId: 'femur--l',
          local: [0, 0, 0],
          label: 'Mobile long note',
        },
      });
      const id = atlas.getState().pins.items[0]?.id;
      if (id) {
        atlas.dispatch({
          type: 'pins/pinEdited',
          payload: { id, label: 'Mobile long note', note },
        });
      }
    }, longNote);
    await page.getByRole('button', { name: 'Expand panel' }).click();
  } else {
    const pt = await page.evaluate(() =>
      (globalThis as AtlasPinGlobal).__atlas?.screenPointOf('femur--l'),
    );
    expect(pt).not.toBeNull();
    await addPinViaContextMenu(page, pt!, 'Desktop long note', longNote);
  }

  await page.getByRole('tab', { name: 'Pins' }).click();
  const listItem = page.locator('li', { hasText: 'xxxxxxxx' });
  await expect(listItem).toBeVisible();

  const metrics = await page
    .locator('section[aria-label="Body systems and browse"]')
    .evaluate((el) => {
      const panel = el.querySelector('[role="tabpanel"]');
      return {
        panelScrollW: panel?.scrollWidth ?? 0,
        panelClientW: panel?.clientWidth ?? 0,
        sectionScrollW: el.scrollWidth,
        sectionClientW: el.clientWidth,
      };
    });
  expect(metrics.panelScrollW).toBeLessThanOrEqual(metrics.panelClientW);
  expect(metrics.sectionScrollW).toBeLessThanOrEqual(metrics.sectionClientW);
});
