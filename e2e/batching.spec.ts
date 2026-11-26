import { expect, test, type Page } from '@playwright/test';

type DrawStats = {
  batches: number;
  promoted: number;
  individual: number;
  doubleDrawn?: number;
  sceneChildren: number;
};

type AtlasBatchGlobal = typeof globalThis & {
  __atlas?: {
    ready: boolean;
    screenPointOf: (id: string) => { x: number; y: number } | null;
    waitIdle: () => Promise<void>;
    drawStats: () => DrawStats;
    encodeView: () => Promise<string>;
    meshVisible: (id: string) => boolean;
    motionPhase: () => number;
    select: (ids: string[]) => void;
    dispatch: (action: unknown) => void;
    getState: () => {
      assets: { bundles: Record<string, string> };
      motion: { activeId: string | null; playing: boolean };
      selection: { selectedIds: string[] };
    };
  };
};

async function initLowQuality(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('atlas.quality', 'low');
  });
}

async function waitForAtlas(page: Page, url = '/') {
  await page.goto(url);
  await page.waitForFunction(
    () => (globalThis as AtlasBatchGlobal).__atlas?.ready === true,
    null,
    { timeout: 30_000 },
  );
  await page.evaluate(() =>
    (globalThis as AtlasBatchGlobal).__atlas?.waitIdle(),
  );
}

async function waitForAllBundles(page: Page) {
  await page.waitForFunction(
    () => {
      const bundles =
        (globalThis as AtlasBatchGlobal).__atlas?.getState().assets.bundles ??
        {};
      const keys = Object.keys(bundles);
      return keys.length > 0 && keys.every((k) => bundles[k] === 'ready');
    },
    null,
    { timeout: 60_000 },
  );
  await page.evaluate(() =>
    (globalThis as AtlasBatchGlobal).__atlas?.waitIdle(),
  );
}

async function enableAllSystems(page: Page) {
  const switches = page.getByRole('switch');
  const count = await switches.count();
  for (let i = 0; i < count; i += 1) {
    const sw = switches.nth(i);
    if ((await sw.getAttribute('aria-checked')) !== 'true') {
      await sw.click();
    }
  }
  await waitForAllBundles(page);
}

async function dismissHint(page: Page) {
  const gotIt = page.getByRole('button', { name: 'Got it' });
  if (await gotIt.isVisible().catch(() => false)) {
    await gotIt.click();
  }
}

async function pixelDiffRatio(
  page: Page,
  pngA: Buffer,
  pngB: Buffer,
): Promise<number> {
  const b64A = pngA.toString('base64');
  const b64B = pngB.toString('base64');
  return page.evaluate(
    async ({ a, b }) => {
      const load = async (b64: string) => {
        const res = await fetch(`data:image/png;base64,${b64}`);
        const blob = await res.blob();
        return createImageBitmap(blob);
      };
      const [bmpA, bmpB] = await Promise.all([load(a), load(b)]);
      const w = bmpA.width;
      const h = bmpA.height;
      if (bmpB.width !== w || bmpB.height !== h) return 1;

      const cA = document.createElement('canvas');
      cA.width = w;
      cA.height = h;
      const ctxA = cA.getContext('2d')!;
      ctxA.drawImage(bmpA, 0, 0);
      const dataA = ctxA.getImageData(0, 0, w, h).data;

      const cB = document.createElement('canvas');
      cB.width = w;
      cB.height = h;
      const ctxB = cB.getContext('2d')!;
      ctxB.drawImage(bmpB, 0, 0);
      const dataB = ctxB.getImageData(0, 0, w, h).data;

      let diff = 0;
      const total = w * h;
      for (let i = 0; i < dataA.length; i += 4) {
        const dr = Math.abs(dataA[i] - dataB[i]);
        const dg = Math.abs(dataA[i + 1] - dataB[i + 1]);
        const db = Math.abs(dataA[i + 2] - dataB[i + 2]);
        const da = Math.abs(dataA[i + 3] - dataB[i + 3]);
        if (Math.max(dr, dg, db, da) > 8) {
          diff += 1;
        }
      }
      return diff / total;
    },
    { a: b64A, b: b64B },
  );
}

test('draw calls drop across default, all-systems, and fade-others states', async ({
  page,
}) => {
  await initLowQuality(page);
  await waitForAtlas(page);
  await dismissHint(page);

  const defStats = await page.evaluate(() =>
    (globalThis as AtlasBatchGlobal).__atlas!.drawStats(),
  );
  expect(defStats.batches).toBeGreaterThan(0);
  expect(defStats.batches + defStats.promoted).toBeLessThanOrEqual(40);

  await enableAllSystems(page);
  const allStats = await page.evaluate(() =>
    (globalThis as AtlasBatchGlobal).__atlas!.drawStats(),
  );
  expect(allStats.batches + allStats.promoted).toBeLessThanOrEqual(200);

  // Fade others with everything on using femur--l
  const pt = await page.evaluate(() =>
    (globalThis as AtlasBatchGlobal).__atlas?.screenPointOf('femur--l'),
  );
  expect(pt).not.toBeNull();
  await page.mouse.click(pt!.x, pt!.y, { button: 'right' });
  await page.getByRole('menuitem', { name: /Fade others/ }).click();
  await page.evaluate(() =>
    (globalThis as AtlasBatchGlobal).__atlas?.waitIdle(),
  );

  const fadeStats = await page.evaluate(() =>
    (globalThis as AtlasBatchGlobal).__atlas!.drawStats(),
  );
  expect(fadeStats.batches + fadeStats.promoted).toBeLessThanOrEqual(400);
});

const EQUIVALENCE_SCENARIOS: Array<{
  name: string;
  setup: (page: Page) => Promise<void>;
}> = [
  {
    name: 'default',
    setup: async () => {},
  },
  {
    name: 'all-systems',
    setup: async (page) => {
      await enableAllSystems(page);
    },
  },
  {
    name: 'skin-and-muscles',
    setup: async (page) => {
      await page.getByRole('switch', { name: 'Muscular' }).click();
      await page.getByRole('switch', { name: 'Integumentary' }).click();
      await waitForAllBundles(page);
      const muscleSlider = page.getByRole('slider', {
        name: 'Muscular opacity',
      });
      await page.evaluate(() => {
        (globalThis as AtlasBatchGlobal).__atlas!.dispatch({
          type: 'systems/opacitySet',
          payload: { systems: ['muscular'], opacity: 0.5 },
        });
      });
      await expect(muscleSlider).toHaveAttribute('aria-valuenow', '50');
    },
  },
  {
    name: 'fade-others-femur',
    setup: async (page) => {
      const pt = await page.evaluate(() =>
        (globalThis as AtlasBatchGlobal).__atlas?.screenPointOf('femur--l'),
      );
      expect(pt).not.toBeNull();
      await page.mouse.click(pt!.x, pt!.y, { button: 'right' });
      await page.getByRole('menuitem', { name: /Fade others/ }).click();
    },
  },
  {
    name: 'isolate-heart',
    setup: async (page) => {
      await page.keyboard.press('/');
      const search = page.getByRole('combobox', { name: /Search structures/i });
      await search.fill('left ventricle');
      await expect(page.getByRole('listbox')).toBeVisible();
      await page.keyboard.press('Enter');
      await page.waitForFunction(
        () =>
          (globalThis as AtlasBatchGlobal).__atlas?.getState().assets.bundles
            .cardiovascular === 'ready',
        null,
        { timeout: 30_000 },
      );
      await page.evaluate(() =>
        (globalThis as AtlasBatchGlobal).__atlas?.waitIdle(),
      );
      const pt = await page.evaluate(() =>
        (globalThis as AtlasBatchGlobal).__atlas?.screenPointOf(
          'left-ventricle',
        ),
      );
      expect(pt).not.toBeNull();
      await page.mouse.click(pt!.x, pt!.y, { button: 'right' });
      await page.getByRole('menuitem', { name: /Isolate/ }).click();
    },
  },
  {
    name: 'axial-section',
    setup: async (page) => {
      await page.keyboard.press('x');
    },
  },
  {
    name: 'femur-selected',
    setup: async (page) => {
      await page.evaluate(() => {
        (globalThis as AtlasBatchGlobal).__atlas!.select(['femur--l']);
      });
    },
  },
];

test('pixel equivalence across rendering scenarios (batching on vs off)', async ({
  page,
  context,
}) => {
  test.setTimeout(180_000);
  await initLowQuality(page);
  await waitForAtlas(page);
  await dismissHint(page);

  for (const scenario of EQUIVALENCE_SCENARIOS) {
    await page.goto('/');
    await waitForAtlas(page, '/');
    await dismissHint(page);

    await scenario.setup(page);
    await page.mouse.move(10, 100);
    await page.evaluate(() =>
      (globalThis as AtlasBatchGlobal).__atlas?.waitIdle(),
    );
    await page.waitForTimeout(150);

    const hash = await page.evaluate(() =>
      (globalThis as AtlasBatchGlobal).__atlas!.encodeView(),
    );

    // Reload both pages cleanly with identical share hash so pose matches deterministically
    await waitForAtlas(page, `/${hash}`);
    await waitForAllBundles(page);
    await dismissHint(page);
    await page.mouse.move(10, 100);
    await page.waitForTimeout(150);
    const pngOn = await page.locator('canvas').screenshot();

    const offPage = await context.newPage();
    await initLowQuality(offPage);
    await waitForAtlas(offPage, `/?batching=off${hash}`);
    await waitForAllBundles(offPage);
    await dismissHint(offPage);
    await offPage.mouse.move(10, 100);
    await offPage.waitForTimeout(150);
    const pngOff = await offPage.locator('canvas').screenshot();

    const ratio = await pixelDiffRatio(page, pngOn, pngOff);
    await offPage.close();
    expect(ratio, `pixel diff ratio for ${scenario.name}`).toBeLessThanOrEqual(
      0.005,
    );
  }
});

test('hover sweep never double-draws or grows scene children', async ({
  page,
}) => {
  await initLowQuality(page);
  await waitForAtlas(page);
  await dismissHint(page);

  const box = await page.locator('canvas').boundingBox();
  expect(box).not.toBeNull();
  const before = await page.evaluate(() =>
    (globalThis as AtlasBatchGlobal).__atlas!.drawStats(),
  );

  for (let i = 0; i < 40; i += 1) {
    const col = (i % 4) - 1.5;
    const row = Math.floor(i / 4) / 10;
    const px = box!.x + box!.width * (0.5 + col * 0.04);
    const py = box!.y + box!.height * (0.18 + row * 0.65);
    await page.mouse.move(px, py);
    await page.waitForTimeout(25);
    const stats = await page.evaluate(() =>
      (globalThis as AtlasBatchGlobal).__atlas!.drawStats(),
    );
    expect(stats.doubleDrawn ?? 0).toBe(0);
    expect(stats.promoted).toBeLessThanOrEqual(2);
  }

  const after = await page.evaluate(() =>
    (globalThis as AtlasBatchGlobal).__atlas!.drawStats(),
  );
  expect(after.sceneChildren).toBe(before.sceneChildren);
});

test('clicks pass through unpickable muscular batch at 0.3 opacity to select sternum', async ({
  page,
}) => {
  await initLowQuality(page);
  await waitForAtlas(page);
  await dismissHint(page);

  await enableAllSystems(page);
  const muscleSlider = page.getByRole('slider', { name: 'Muscular opacity' });
  await page.evaluate(() => {
    (globalThis as AtlasBatchGlobal).__atlas!.dispatch({
      type: 'systems/opacitySet',
      payload: { systems: ['muscular'], opacity: 0.3 },
    });
  });
  await expect(muscleSlider).toHaveAttribute('aria-valuenow', '30');

  // Set integumentary to 0 so skin stays out of focus or remains unpickable at 0.35
  const sternumPt = await page.evaluate(() =>
    (globalThis as AtlasBatchGlobal).__atlas?.screenPointOf(
      'body-of-sternum',
    ),
  );
  expect(sternumPt).not.toBeNull();
  await page.mouse.click(sternumPt!.x, sternumPt!.y);

  await expect(
    page.locator('aside[aria-label="Structure details"]'),
  ).toContainText('Body of sternum');
});

test('motion promotes moving radius and demotes it on stop', async ({
  page,
}) => {
  await initLowQuality(page);
  await waitForAtlas(page);
  await dismissHint(page);

  await page.getByRole('tab', { name: 'Motion' }).click();
  await page
    .getByRole('button', { name: 'Elbow flexion and extension' })
    .click();

  await page.waitForFunction(
    () => {
      const a = (globalThis as AtlasBatchGlobal).__atlas;
      return (
        a?.getState().motion.activeId === 'elbow-flexion' &&
        a.motionPhase() > 0.1
      );
    },
    null,
    { timeout: 30_000 },
  );

  const activeStats = await page.evaluate(() => ({
    draw: (globalThis as AtlasBatchGlobal).__atlas!.drawStats(),
    radiusVisible: (globalThis as AtlasBatchGlobal).__atlas!.meshVisible(
      'radius--l',
    ),
  }));
  expect(activeStats.radiusVisible).toBe(true);
  expect(activeStats.draw.promoted).toBeGreaterThanOrEqual(1);

  await page.mouse.move(10, 100);
  await page.getByRole('button', { name: 'Stop' }).click();
  await page.waitForFunction(
    () =>
      (globalThis as AtlasBatchGlobal).__atlas?.getState().motion.activeId ===
      null,
    null,
    { timeout: 10_000 },
  );
  await page.waitForTimeout(100);

  const stoppedStats = await page.evaluate(() =>
    (globalThis as AtlasBatchGlobal).__atlas!.drawStats(),
  );
  expect(stoppedStats.promoted).toBe(0);
});
