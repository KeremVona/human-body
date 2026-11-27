import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';

type AtlasJourneyGlobal = typeof globalThis & {
  __atlas?: {
    ready: boolean;
    waitIdle: () => Promise<void>;
    select: (ids: string[]) => void;
    encodeView: () => Promise<string>;
    meshVisible: (id: string) => boolean;
    journey: () => {
      activeId: string | null;
      stageIndex: number;
      progress: number;
      playing: boolean;
      following: boolean;
    };
    setJourneyProgress: (u: number) => Promise<void>;
    journeyDrawCalls: () => number;
    tour: () => { activeId: string | null; stepIndex: number };
    startQuiz: (seed?: number) => void;
    dispatch: (action: unknown) => unknown;
    getState: () => {
      journey: {
        defs: Array<{
          id: string;
          stages: Array<{ id: string; organs: string[]; durationS: number }>;
        }> | null;
      };
      assets: { bundles: Record<string, string> };
    };
  };
};

async function waitForAtlas(page: Page, url = '/') {
  await page.goto(url);
  await page.waitForFunction(
    () => (globalThis as AtlasJourneyGlobal).__atlas?.ready === true,
    null,
    { timeout: 30_000 },
  );
  await page.evaluate(() =>
    (globalThis as AtlasJourneyGlobal).__atlas?.waitIdle(),
  );
  const gotIt = page.getByRole('button', { name: 'Got it' });
  if (await gotIt.isVisible()) {
    await gotIt.click();
  }
}

test('digestion journey playback, stage screenshots, draw calls, and accessibility', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await waitForAtlas(page);

  await page.getByRole('button', { name: 'Tours' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Journeys' })).toBeVisible();
  await dialog
    .locator('li')
    .filter({ hasText: 'Follow a bite of food' })
    .getByRole('button', { name: 'Start' })
    .click();

  const bar = page.getByRole('region', { name: 'Follow a bite of food' });
  await expect(bar).toBeVisible();
  await expect(bar.getByText('Stage 1 of 8')).toBeVisible();
  await expect(bar.getByRole('heading', { name: 'Chewing and saliva' })).toBeVisible();

  await page.waitForFunction(
    () => {
      const atlas = (globalThis as AtlasJourneyGlobal).__atlas;
      return (
        atlas?.journey().playing === true &&
        atlas.getState().assets.bundles.organs === 'ready'
      );
    },
    null,
    { timeout: 30_000 },
  );
  const p0 = await page.evaluate(
    () => (globalThis as AtlasJourneyGlobal).__atlas?.journey().progress ?? 0,
  );
  await page.waitForTimeout(1500);
  const p1 = await page.evaluate(
    () => (globalThis as AtlasJourneyGlobal).__atlas?.journey().progress ?? 0,
  );
  expect(pageErrors).toEqual([]);
  expect(p1).toBeGreaterThan(p0);

  // Axe accessibility audit on active JourneyBar
  const axeResults = await new AxeBuilder({ page }).analyze();
  const serious = axeResults.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(serious).toEqual([]);

  // Check draw calls <= 4
  const drawCalls = await page.evaluate(
    () => (globalThis as AtlasJourneyGlobal).__atlas?.journeyDrawCalls() ?? 99,
  );
  expect(drawCalls).toBeLessThanOrEqual(4);

  // Visit each of the 8 stages deterministically using rendered scrubber stage ticks
  const ticks = await bar
    .locator('[data-orientation="horizontal"] > span[aria-hidden="true"]')
    .evaluateAll((els) =>
      els.map((el) => {
        const style = el.getAttribute('style') ?? '';
        const match = /left:\s*([0-9.]+)%/.exec(style);
        return match ? Number.parseFloat(match[1]) / 100 : 0;
      }),
    );
  const stageBounds = [0, ...ticks, 1];
  expect(stageBounds.length).toBe(9);

  for (let i = 0; i < 8; i += 1) {
    const mid = (stageBounds[i] + stageBounds[i + 1]) / 2;
    await page.evaluate(
      (u) => (globalThis as AtlasJourneyGlobal).__atlas?.setJourneyProgress(u),
      mid,
    );
    await expect(bar.getByText(`Stage ${i + 1} of 8`)).toBeVisible();

    await page.waitForFunction(
      () => {
        const atlas = (globalThis as AtlasJourneyGlobal).__atlas;
        if (!atlas) return false;
        const j = atlas.journey();
        const def = atlas.getState().journey.defs?.find((d) => d.id === 'digestion');
        const st = def?.stages[j.stageIndex];
        if (!st) return false;
        return st.organs.every((id) => atlas.meshVisible(id));
      },
      null,
      { timeout: 30_000 },
    );

    const stageId = await page.evaluate(() => {
      const atlas = (globalThis as AtlasJourneyGlobal).__atlas;
      const j = atlas?.journey();
      const def = atlas?.getState().journey.defs?.find((d) => d.id === 'digestion');
      return def?.stages[j?.stageIndex ?? 0]?.id ?? 'stage';
    });
    await page.evaluate(() =>
      (globalThis as AtlasJourneyGlobal).__atlas?.waitIdle(),
    );
    await page.screenshot({
      path: testInfo.outputPath(`journey-${stageId}.png`),
    });
  }
});

test('exit restores prior view including hidden bones, selection, and section', async ({
  page,
}) => {
  await waitForAtlas(page);

  await page.evaluate(() => {
    const atlas = (globalThis as AtlasJourneyGlobal).__atlas;
    atlas?.dispatch({ type: 'dissection/hide', payload: ['femur--l'] });
    atlas?.select(['humerus--l']);
    atlas?.dispatch({
      type: 'section/sectionSet',
      payload: { enabled: true, axis: 'coronal', t: 0.45, flip: false },
    });
  });
  await page.evaluate(() =>
    (globalThis as AtlasJourneyGlobal).__atlas?.waitIdle(),
  );
  const before = await page.evaluate(() =>
    (globalThis as AtlasJourneyGlobal).__atlas?.encodeView(),
  );

  await page.getByRole('button', { name: 'Tours' }).click();
  await page
    .getByRole('dialog')
    .locator('li')
    .filter({ hasText: 'Follow a bite of food' })
    .getByRole('button', { name: 'Start' })
    .click();

  const bar = page.getByRole('region', { name: 'Follow a bite of food' });
  await expect(bar).toBeVisible();
  await page.evaluate(() =>
    (globalThis as AtlasJourneyGlobal).__atlas?.setJourneyProgress(0.5),
  );

  await bar.getByRole('button', { name: 'Exit journey' }).click();
  await expect(bar).toHaveCount(0);
  await page.evaluate(() =>
    (globalThis as AtlasJourneyGlobal).__atlas?.waitIdle(),
  );

  const after = await page.evaluate(() =>
    (globalThis as AtlasJourneyGlobal).__atlas?.encodeView(),
  );
  expect(after).toEqual(before);
});

test('hash boot and exclusivity with tours and quiz', async ({ page }) => {
  await waitForAtlas(page, '/#journey/digestion/4');
  const bar = page.getByRole('region', { name: 'Follow a bite of food' });
  await expect(bar).toBeVisible();
  await expect(bar.getByText('Stage 4 of 8')).toBeVisible();

  await expect(page.getByRole('button', { name: 'Tours' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Tours' })).toHaveAttribute(
    'title',
    'Finish the journey first',
  );
  await expect(page.getByRole('button', { name: 'Start quiz' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Start quiz' })).toHaveAttribute(
    'title',
    'Finish the journey first',
  );

  await bar.getByRole('button', { name: 'Exit journey' }).click();
  await expect(bar).toHaveCount(0);

  // Starting a tour and then starting a journey exits the tour cleanly
  await page.getByRole('button', { name: 'Tours' }).click();
  const dialog = page.getByRole('dialog');
  await dialog
    .locator('li')
    .filter({ hasText: 'From bone to muscle: the arm' })
    .getByRole('button', { name: 'Start' })
    .click();
  await expect(
    page.getByRole('region', { name: 'From bone to muscle: the arm' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Tours' }).click();
  await page
    .getByRole('dialog')
    .locator('li')
    .filter({ hasText: 'Follow a bite of food' })
    .getByRole('button', { name: 'Start' })
    .click();
  await expect(bar).toBeVisible();
  const tourId = await page.evaluate(
    () => (globalThis as AtlasJourneyGlobal).__atlas?.tour().activeId,
  );
  expect(tourId).toBeNull();
});

test('bad journey link shows notice', async ({ page }) => {
  await waitForAtlas(page, '/#journey/nope');
  await expect(page.getByText("This journey couldn't be found.")).toBeVisible();
});

test('reduced motion and Turkish localization', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await waitForAtlas(page, '/?lang=tr');

  await page.getByRole('button', { name: 'Turlar' }).click();
  const dialog = page.getByRole('dialog');
  await dialog
    .locator('li')
    .filter({ hasText: 'Bir lokmanın yolculuğu' })
    .getByRole('button', { name: 'Başlat' })
    .click();

  const bar = page.getByRole('region', { name: 'Bir lokmanın yolculuğu' });
  await expect(bar).toBeVisible();
  await expect(bar.getByText('Aşama 1 / 8')).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Oynat' })).toHaveCount(0);
  await expect(bar.getByRole('button', { name: 'Duraklat' })).toHaveCount(0);

  const pA = await page.evaluate(
    () => (globalThis as AtlasJourneyGlobal).__atlas?.journey().progress,
  );
  await page.waitForTimeout(1000);
  const pB = await page.evaluate(
    () => (globalThis as AtlasJourneyGlobal).__atlas?.journey().progress,
  );
  expect(pB).toBe(pA);

  await bar.getByRole('button', { name: 'Sonraki aşama' }).click();
  await expect(bar.getByText('Aşama 2 / 8')).toBeVisible();
});
