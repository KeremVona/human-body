import { expect, test, type Page } from './fixtures';

type AtlasTourGlobal = typeof globalThis & {
  __atlas?: {
    ready: boolean;
    tour: () => { activeId: string | null; stepIndex: number };
    select: (ids: string[]) => void;
    waitIdle: () => Promise<void>;
    getState: () => {
      assets: { bundles: Record<string, string> };
      motion: { activeId: string | null; playing: boolean };
      quiz: { status: string };
      section: { enabled: boolean; axis: string; t: number };
      selection: { selectedIds: string[] };
    };
  };
};

async function waitForAtlas(page: Page, url = '/') {
  await page.goto(url);
  await page.waitForFunction(
    () => (globalThis as AtlasTourGlobal).__atlas?.ready === true,
    null,
    { timeout: 30_000 },
  );
  await page.evaluate(() =>
    (globalThis as AtlasTourGlobal).__atlas?.waitIdle(),
  );
  const gotIt = page.getByRole('button', { name: 'Got it' });
  if (await gotIt.isVisible()) {
    await gotIt.click();
  }
}

test('play a tour end to end', async ({ page }) => {
  await waitForAtlas(page);

  await page.getByRole('button', { name: 'Tours' }).click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('heading', { name: 'Guided tours' }),
  ).toBeVisible();

  await dialog.getByRole('button', { name: 'Start' }).first().click();

  const bar = page.getByRole('region', { name: 'From bone to muscle: the arm' });
  await expect(bar).toBeVisible();
  await expect(bar.getByText('Step 1 of 5')).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Back' })).toBeDisabled();

  for (let step = 1; step < 5; step++) {
    await bar.getByRole('button', { name: 'Next' }).click();
    await expect(bar.getByText(`Step ${step + 1} of 5`)).toBeVisible();
  }

  await bar.getByRole('button', { name: 'Finish' }).click();
  await expect(bar).toHaveCount(0);

  const after = await page.evaluate(() => ({
    tour: (globalThis as AtlasTourGlobal).__atlas?.tour(),
    selected: (globalThis as AtlasTourGlobal).__atlas?.getState().selection
      .selectedIds,
  }));
  expect(after.tour).toEqual({ activeId: null, stepIndex: 0 });
  expect(after.selected).toEqual([]);
});

test('motion step', async ({ page }) => {
  await waitForAtlas(page);

  await page.getByRole('button', { name: 'Tours' }).click();
  const dialog = page.getByRole('dialog');
  const card = dialog
    .locator('li')
    .filter({ hasText: 'How the heart beats' });
  await card.getByRole('button', { name: 'Start' }).click();

  const bar = page.getByRole('region', { name: 'How the heart beats' });
  await expect(bar).toBeVisible();
  await bar.getByRole('button', { name: 'Next' }).click();

  await page.waitForFunction(
    () => {
      const st = (globalThis as AtlasTourGlobal).__atlas?.getState();
      return (
        st?.motion.activeId === 'heartbeat' &&
        st?.motion.playing === true &&
        st?.section.enabled === true &&
        st?.section.axis === 'coronal'
      );
    },
    null,
    { timeout: 30_000 },
  );

  await bar.getByRole('button', { name: 'Exit tour' }).click();
  await expect(bar).toHaveCount(0);
  await page.waitForFunction(
    () =>
      (globalThis as AtlasTourGlobal).__atlas?.getState().motion.activeId ===
      null,
    null,
    { timeout: 10_000 },
  );
});

test('tour link', async ({ page }) => {
  await waitForAtlas(page, '/#tour/how-the-heart-beats/2');

  const bar = page.getByRole('region', { name: 'How the heart beats' });
  await expect(bar).toBeVisible();
  await expect(bar.getByText('Step 2 of 5')).toBeVisible();

  await bar.getByRole('button', { name: 'Exit tour' }).click();
  await expect(bar).toHaveCount(0);
});

test('bad tour link', async ({ page }) => {
  await waitForAtlas(page, '/#tour/nonexistent-tour/1');

  await expect(
    page.getByText("This tour couldn't be found."),
  ).toBeVisible();

  // Atlas remains interactive after dismissing/ignoring the notice
  await page.getByRole('button', { name: 'Tours' }).click();
  await expect(
    page.getByRole('heading', { name: 'Guided tours' }),
  ).toBeVisible();
});

test('keyboard navigation and Escape ordering', async ({ page }) => {
  await waitForAtlas(page);

  await page.getByRole('button', { name: 'Tours' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Start' }).first().click();

  const bar = page.getByRole('region', { name: 'From bone to muscle: the arm' });
  await expect(bar.getByText('Step 1 of 5')).toBeVisible();

  // Clear initial selection or verify Escape clears selection BEFORE exiting tour
  await page.waitForFunction(
    () =>
      ((globalThis as AtlasTourGlobal).__atlas?.getState().selection
        .selectedIds.length ?? 0) > 0,
    null,
    { timeout: 30_000 },
  );

  await page.keyboard.press('ArrowRight');
  await expect(bar.getByText('Step 2 of 5')).toBeVisible();

  await page.keyboard.press('ArrowLeft');
  await expect(bar.getByText('Step 1 of 5')).toBeVisible();
  await page.evaluate(() =>
    (globalThis as AtlasTourGlobal).__atlas?.waitIdle(),
  );

  // Ensure a selection exists so first Escape clears selection without exiting tour
  await page.evaluate(() => {
    (globalThis as AtlasTourGlobal).__atlas?.select(['humerus--l']);
  });
  await page.keyboard.press('Escape');
  await expect(bar).toBeVisible();
  const midSel = await page.evaluate(
    () =>
      (globalThis as AtlasTourGlobal).__atlas?.getState().selection.selectedIds,
  );
  expect(midSel).toEqual([]);

  // Second Escape with empty selection exits the tour
  await page.keyboard.press('Escape');
  await expect(bar).toHaveCount(0);
});

test('turkish on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/?lang=tr');
  await page.waitForFunction(
    () => (globalThis as AtlasTourGlobal).__atlas?.ready === true,
    null,
    { timeout: 30_000 },
  );
  await page.evaluate(() =>
    (globalThis as AtlasTourGlobal).__atlas?.waitIdle(),
  );
  const anladim = page.getByRole('button', { name: 'Anladım' });
  if (await anladim.isVisible()) {
    await anladim.click();
  }

  await page.getByRole('button', { name: 'Turlar' }).click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('heading', { name: 'Rehberli turlar' }),
  ).toBeVisible();
  await dialog
    .locator('li')
    .filter({ hasText: 'Lenf düğümleri ve bağışıklık' })
    .getByRole('button', { name: 'Başla' })
    .click();

  const bar = page.getByRole('region', {
    name: 'Lenf düğümleri ve bağışıklık',
  });
  await expect(bar).toBeVisible();
  await expect(bar.getByText('Adım 1 / 5')).toBeVisible();

  const layout = await bar.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      x: r.x,
      width: r.width,
      height: r.height,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    };
  });
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
  expect(layout.x).toBeGreaterThanOrEqual(0);
  expect(layout.x + layout.width).toBeLessThanOrEqual(375);
  expect(layout.height).toBeLessThan(360);

  await bar.getByRole('button', { name: 'Sonraki' }).click();
  await expect(bar.getByText('Adım 2 / 5')).toBeVisible();
});

test('quiz and tour exclusive', async ({ page }) => {
  await waitForAtlas(page);

  await page.getByRole('button', { name: 'Tours' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Start' }).first().click();

  const quizBtn = page.getByRole('button', { name: 'Start quiz' });
  await expect(quizBtn).toBeDisabled();
  await expect(quizBtn).toHaveAttribute('title', 'Finish the tour first');

  await page.getByRole('button', { name: 'Exit tour' }).click();
  await expect(quizBtn).toBeEnabled();

  await quizBtn.click();
  await expect(page.getByRole('button', { name: 'Tours' })).toHaveCount(0);
});
