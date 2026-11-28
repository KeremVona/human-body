import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';

type AtlasGlobal = typeof globalThis & {
  __atlas?: {
    ready: boolean;
    waitIdle: () => Promise<void>;
    select: (ids: string[]) => void;
    encodeView: () => Promise<string>;
    meshVisible: (id: string) => boolean;
    drawStats: () => {
      batches: number;
      promoted: number;
      individual: number;
      sceneChildren: number;
    };
    motionPhase: () => number;
    meshTransform: (id: string) => {
      position: number[];
      quaternion: number[];
      scale: number[];
    } | null;
    journey: () => {
      activeId: string | null;
      stageIndex: number;
      progress: number;
      playing: boolean;
      following: boolean;
    };
    setJourneyProgress: (u: number) => Promise<void>;
    journeyDrawCalls: () => number;
    getState: () => {
      motion: {
        activeId: string | null;
        owner: 'user' | 'journey' | null;
        playing: boolean;
      };
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
    () => (globalThis as AtlasGlobal).__atlas?.ready === true,
    null,
    { timeout: 30_000 },
  );
  await page.evaluate(() => (globalThis as AtlasGlobal).__atlas?.waitIdle());
  const gotIt = page.getByRole('button', { name: 'Got it' });
  if (await gotIt.isVisible()) {
    await gotIt.click();
  }
}

async function readStageBounds(
  bar: ReturnType<Page['getByRole']>,
): Promise<number[]> {
  const ticks = await bar
    .locator('[data-orientation="horizontal"] > span[aria-hidden="true"]')
    .evaluateAll((els) =>
      els.map((el) => {
        const style = el.getAttribute('style') ?? '';
        const match = /left:\s*([0-9.]+)%/.exec(style);
        return match ? Number.parseFloat(match[1]) / 100 : 0;
      }),
    );
  return [0, ...ticks, 1];
}

test('tours dialog lists three journeys; blood playback, heartbeat rhythm, meters, close-ups, screenshots, and exit', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await waitForAtlas(page);

  await page.getByRole('button', { name: 'Tours' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Journeys' })).toBeVisible();
  await expect(dialog.getByText('Follow a bite of food')).toBeVisible();
  await expect(dialog.getByText('Follow a drop of blood')).toBeVisible();
  await expect(dialog.getByText('Follow a breath of air')).toBeVisible();

  await dialog
    .locator('li')
    .filter({ hasText: 'Follow a drop of blood' })
    .getByRole('button', { name: 'Start' })
    .click();

  const bar = page.getByRole('region', { name: 'Follow a drop of blood' });
  await expect(bar).toBeVisible();
  await expect(bar.getByText('Stage 1 of 10')).toBeVisible();
  await expect(
    bar.getByRole('heading', { name: 'Delivering oxygen in the hand' }),
  ).toBeVisible();

  // Hand stage close-up accessible card + name
  await expect(bar.getByText('Close-up (not to scale)')).toBeVisible();
  await expect(
    bar.getByRole('img', { name: /Diagram of a capillary:/ }),
  ).toBeVisible();

  // Visit every blood stage and capture screenshot
  const bounds = await readStageBounds(bar);
  expect(bounds.length).toBe(11);

  for (let i = 0; i < 10; i += 1) {
    const mid = (bounds[i] + bounds[i + 1]) / 2;
    await page.evaluate(
      (u) => (globalThis as AtlasGlobal).__atlas?.setJourneyProgress(u),
      mid,
    );
    await expect(bar.getByText(`Stage ${i + 1} of 10`)).toBeVisible();

    await page.waitForFunction(
      () => {
        const atlas = (globalThis as AtlasGlobal).__atlas;
        if (!atlas) return false;
        const j = atlas.journey();
        const def = atlas.getState().journey.defs?.find((d) => d.id === 'blood');
        const st = def?.stages[j.stageIndex];
        return Boolean(st && st.organs.every((id) => atlas.meshVisible(id)));
      },
      null,
      { timeout: 30_000 },
    );

    const stageId = await page.evaluate(() => {
      const atlas = (globalThis as AtlasGlobal).__atlas;
      const j = atlas?.journey();
      const def = atlas?.getState().journey.defs?.find((d) => d.id === 'blood');
      return def?.stages[j?.stageIndex ?? 0]?.id ?? 'stage';
    });

    if (stageId === 'lung-capillaries') {
      await expect(
        bar.getByRole('img', { name: /Diagram of a lung capillary/ }),
      ).toBeVisible();
      const axeResults = await new AxeBuilder({ page }).analyze();
      const serious = axeResults.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );
      expect(serious).toEqual([]);
    }

    if (stageId === 'left-heart') {
      const jDraws = await page.evaluate(
        () => (globalThis as AtlasGlobal).__atlas?.journeyDrawCalls() ?? 99,
      );
      expect(jDraws).toBeLessThanOrEqual(4);
      if (testInfo.project.name !== 'chromium-batching-off') {
        const stats = await page.evaluate(() =>
          (globalThis as AtlasGlobal).__atlas?.drawStats(),
        );
        expect(stats).toBeDefined();
        expect(stats!.batches + stats!.individual).toBeLessThanOrEqual(200);
      }
    }

    await page.evaluate(() => (globalThis as AtlasGlobal).__atlas?.waitIdle());
    await page.screenshot({
      path: testInfo.outputPath(`journey-blood-${stageId}.png`),
    });
  }

  // Meters box at end of lung-capillaries reads Oxygen saturation: 98%
  await page.evaluate(
    (u) => (globalThis as AtlasGlobal).__atlas?.setJourneyProgress(u),
    bounds[6] - 0.0005,
  );
  await expect(bar.getByText('Stage 6 of 10')).toBeVisible();
  await bar.getByRole('button', { name: 'In this blood' }).click();
  await expect(
    bar.getByRole('meter', { name: 'Oxygen saturation' }),
  ).toHaveAttribute('aria-valuetext', 'Oxygen saturation: 98%');

  // Playing during right-heart: heartbeat rhythm owned by journey updates motionPhase
  await page.evaluate(
    (u) => (globalThis as AtlasGlobal).__atlas?.setJourneyProgress(u),
    (bounds[3] + bounds[4]) / 2,
  );
  await expect(bar.getByText('Stage 4 of 10')).toBeVisible();
  await page.waitForFunction(
    () =>
      (globalThis as AtlasGlobal).__atlas?.getState().motion.activeId ===
      'heartbeat',
    null,
    { timeout: 15_000 },
  );
  const mOwner = await page.evaluate(
    () => (globalThis as AtlasGlobal).__atlas?.getState().motion.owner,
  );
  expect(mOwner).toBe('journey');
  await bar.getByRole('button', { name: 'Play' }).click();
  const phaseA = await page.evaluate(
    () => (globalThis as AtlasGlobal).__atlas?.motionPhase() ?? 0,
  );
  await page.waitForFunction(
    (prev) => ((globalThis as AtlasGlobal).__atlas?.motionPhase() ?? 0) !== prev,
    phaseA,
    { timeout: 10_000 },
  );

  // During arm-arteries (stage 10) heartbeat motion is stopped
  await page.evaluate(
    (u) => (globalThis as AtlasGlobal).__atlas?.setJourneyProgress(u),
    (bounds[9] + bounds[10]) / 2,
  );
  await expect(bar.getByText('Stage 10 of 10')).toBeVisible();
  await page.waitForFunction(
    () =>
      (globalThis as AtlasGlobal).__atlas?.getState().motion.activeId === null,
    null,
    { timeout: 10_000 },
  );

  expect(pageErrors).toEqual([]);
});

test('breath journey stage screenshots, lung scale at alveoli and out-nose, meters, and alveoli close-up', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await waitForAtlas(page);

  await page.getByRole('button', { name: 'Tours' }).click();
  await page
    .getByRole('dialog')
    .locator('li')
    .filter({ hasText: 'Follow a breath of air' })
    .getByRole('button', { name: 'Start' })
    .click();

  const bar = page.getByRole('region', { name: 'Follow a breath of air' });
  await expect(bar).toBeVisible();
  await expect(bar.getByText('Stage 1 of 8')).toBeVisible();
  await expect(
    bar.getByRole('heading', { name: 'In through the nose' }),
  ).toBeVisible();

  // Pause at nose start to record resting lung scale
  await page.evaluate(
    () => (globalThis as AtlasGlobal).__atlas?.setJourneyProgress(0),
  );
  await page.waitForFunction(
    () =>
      Boolean(
        (globalThis as AtlasGlobal).__atlas?.meshTransform(
          'inferior-lobe-of-right-lung',
        ),
      ),
    null,
    { timeout: 30_000 },
  );
  const noseScaleY = await page.evaluate(
    () =>
      (globalThis as AtlasGlobal).__atlas?.meshTransform(
        'inferior-lobe-of-right-lung',
      )?.scale[1] ?? 1,
  );

  const bounds = await readStageBounds(bar);
  expect(bounds.length).toBe(9);

  for (let i = 0; i < 8; i += 1) {
    const mid = (bounds[i] + bounds[i + 1]) / 2;
    await page.evaluate(
      (u) => (globalThis as AtlasGlobal).__atlas?.setJourneyProgress(u),
      mid,
    );
    await expect(bar.getByText(`Stage ${i + 1} of 8`)).toBeVisible();

    await page.waitForFunction(
      () => {
        const atlas = (globalThis as AtlasGlobal).__atlas;
        if (!atlas) return false;
        const j = atlas.journey();
        const def = atlas.getState().journey.defs?.find((d) => d.id === 'breath');
        const st = def?.stages[j.stageIndex];
        return Boolean(st && st.organs.every((id) => atlas.meshVisible(id)));
      },
      null,
      { timeout: 30_000 },
    );

    const stageId = await page.evaluate(() => {
      const atlas = (globalThis as AtlasGlobal).__atlas;
      const j = atlas?.journey();
      const def = atlas?.getState().journey.defs?.find((d) => d.id === 'breath');
      return def?.stages[j?.stageIndex ?? 0]?.id ?? 'stage';
    });

    if (stageId === 'alveoli') {
      await expect(bar.getByText('Close-up (not to scale)')).toBeVisible();
      await expect(
        bar.getByRole('img', { name: /Diagram of a cluster of air sacs/ }),
      ).toBeVisible();
      const alveoliScaleY = await page.evaluate(
        () =>
          (globalThis as AtlasGlobal).__atlas?.meshTransform(
            'inferior-lobe-of-right-lung',
          )?.scale[1] ?? 1,
      );
      expect(alveoliScaleY).toBeGreaterThan(noseScaleY);

      const jDraws = await page.evaluate(
        () => (globalThis as AtlasGlobal).__atlas?.journeyDrawCalls() ?? 99,
      );
      expect(jDraws).toBeLessThanOrEqual(4);
      if (testInfo.project.name !== 'chromium-batching-off') {
        const stats = await page.evaluate(() =>
          (globalThis as AtlasGlobal).__atlas?.drawStats(),
        );
        expect(stats).toBeDefined();
        expect(stats!.batches + stats!.individual).toBeLessThanOrEqual(200);
      }
    }

    await page.evaluate(() => (globalThis as AtlasGlobal).__atlas?.waitIdle());
    await page.screenshot({
      path: testInfo.outputPath(`journey-breath-${stageId}.png`),
    });
  }

  // Meters box at end of alveoli reads Carbon dioxide: 5% of the air
  await page.evaluate(
    (u) => (globalThis as AtlasGlobal).__atlas?.setJourneyProgress(u),
    bounds[6] - 0.00001,
  );
  await bar.getByRole('button', { name: 'In this air' }).click();
  await expect(
    bar.getByRole('meter', { name: 'Carbon dioxide' }),
  ).toHaveAttribute('aria-valuetext', 'Carbon dioxide: 5% of the air');

  // At out-nose end (progress = 1), lung scale returns to resting scale (~1.000 relative to nose start, ±0.002)
  await page.evaluate(
    () => (globalThis as AtlasGlobal).__atlas?.setJourneyProgress(1),
  );
  await expect(bar.getByText('Stage 8 of 8')).toBeVisible();
  const endScaleY = await page.evaluate(
    () =>
      (globalThis as AtlasGlobal).__atlas?.meshTransform(
        'inferior-lobe-of-right-lung',
      )?.scale[1] ?? 0,
  );
  expect(Math.abs(endScaleY / noseScaleY - 1)).toBeLessThanOrEqual(0.002);
  expect(pageErrors).toEqual([]);
});

test('hash boot, exit view restore, reduced motion, Inspector links, and Turkish titles for blood & breath', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await waitForAtlas(page);

  const before = await page.evaluate(() =>
    (globalThis as AtlasGlobal).__atlas?.encodeView(),
  );

  // Hash boot into blood/4 (right-heart) & exit restores view + stops heartbeat
  await waitForAtlas(page, '/#journey/blood/4');
  const bloodBar = page.getByRole('region', { name: 'Follow a drop of blood' });
  await expect(bloodBar).toBeVisible();
  await expect(bloodBar.getByText('Stage 4 of 10')).toBeVisible();
  await expect(
    bloodBar.getByRole('heading', { name: 'Through the right side of the heart' }),
  ).toBeVisible();
  await page.waitForFunction(
    () =>
      (globalThis as AtlasGlobal).__atlas?.getState().motion.activeId ===
      'heartbeat',
    null,
    { timeout: 15_000 },
  );
  await bloodBar.getByRole('button', { name: 'Exit journey' }).click();
  await expect(bloodBar).toHaveCount(0);
  await page.waitForFunction(
    () =>
      (globalThis as AtlasGlobal).__atlas?.getState().motion.activeId === null,
    null,
    { timeout: 10_000 },
  );
  const afterBloodExit = await page.evaluate(() =>
    (globalThis as AtlasGlobal).__atlas?.encodeView(),
  );
  expect(afterBloodExit).toEqual(before);

  // Hash boot into breath/6 (alveoli)
  await waitForAtlas(page, '/#journey/breath/6');
  const breathBar = page.getByRole('region', { name: 'Follow a breath of air' });
  await expect(breathBar).toBeVisible();
  await expect(breathBar.getByText('Stage 6 of 8')).toBeVisible();
  await expect(
    breathBar.getByRole('heading', { name: 'Swapping gases in the air sacs' }),
  ).toBeVisible();
  await breathBar.getByRole('button', { name: 'Exit journey' }).click();
  await expect(breathBar).toHaveCount(0);

  // Inspector links: left-ventricle -> blood; epiglottis -> digestion + breath
  await page.evaluate(() => {
    const atlas = (globalThis as AtlasGlobal).__atlas;
    atlas?.select(['left-ventricle']);
  });
  await expect(
    page.getByRole('button', { name: /Watch blood flow through here/ }),
  ).toBeVisible();

  await page.evaluate(() => {
    const atlas = (globalThis as AtlasGlobal).__atlas;
    atlas?.select(['epiglottis']);
  });
  await expect(
    page.getByRole('button', { name: /Watch food pass through here/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Watch air pass through here/ }),
  ).toBeVisible();

  // Turkish locale titles
  await waitForAtlas(page, '/?lang=tr');
  await page.getByRole('button', { name: 'Turlar' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Bir damla kanın yolculuğu')).toBeVisible();
  await expect(dialog.getByText('Bir nefes havanın yolculuğu')).toBeVisible();

  // Reduced motion: no heartbeat in right-heart, full-inhale pose in alveoli
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await waitForAtlas(page, '/#journey/blood/4');
  const bloodReduced = page.getByRole('region', {
    name: 'Follow a drop of blood',
  });
  await expect(bloodReduced).toBeVisible();
  await page.waitForTimeout(400);
  const rmMotion = await page.evaluate(
    () => (globalThis as AtlasGlobal).__atlas?.getState().motion.activeId,
  );
  expect(rmMotion).toBeNull();
  const pA = await page.evaluate(
    () => (globalThis as AtlasGlobal).__atlas?.journey().progress,
  );
  await page.waitForTimeout(400);
  const pB = await page.evaluate(
    () => (globalThis as AtlasGlobal).__atlas?.journey().progress,
  );
  expect(pB).toBe(pA);

  // Read resting lung scale at out-nose end (phase 1.0) then verify full-inhale pose at alveoli (phase 0.4, +5%)
  await waitForAtlas(page, '/#journey/breath/8');
  await page.waitForFunction(
    () =>
      (globalThis as AtlasGlobal).__atlas?.getState().motion.activeId ===
        'breathing' &&
      Boolean(
        (globalThis as AtlasGlobal).__atlas?.meshTransform(
          'inferior-lobe-of-right-lung',
        ),
      ),
    null,
    { timeout: 20_000 },
  );
  const restRmScaleY = await page.evaluate(
    () =>
      (globalThis as AtlasGlobal).__atlas?.meshTransform(
        'inferior-lobe-of-right-lung',
      )?.scale[1] ?? 1,
  );

  await waitForAtlas(page, '/#journey/breath/6');
  await page.waitForFunction(
    (rest) =>
      ((globalThis as AtlasGlobal).__atlas?.meshTransform(
        'inferior-lobe-of-right-lung',
      )?.scale[1] ?? 0) >
      rest * 1.04,
    restRmScaleY,
    { timeout: 20_000 },
  );
});
