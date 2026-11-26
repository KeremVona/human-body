import { expect, test, type Page } from './fixtures';

type MeshTransform = {
  position: number[];
  quaternion: number[];
  scale: number[];
};

type AtlasMotionGlobal = typeof globalThis & {
  __atlas?: {
    ready: boolean;
    screenPointOf: (id: string) => { x: number; y: number } | null;
    waitIdle: () => Promise<void>;
    dispatch: (action: unknown) => void;
    motionPhase: () => number;
    meshTransform: (id: string) => MeshTransform | null;
    getState: () => {
      motion: { activeId: string | null; playing: boolean };
      quiz: { status: string };
      section: { enabled: boolean; axis: string; t: number };
      selection: { selectedIds: string[] };
    };
  };
};

async function waitForAtlas(page: Page) {
  await page.goto('/');
  await page.waitForFunction(
    () => (globalThis as AtlasMotionGlobal).__atlas?.ready === true,
    null,
    { timeout: 30_000 },
  );
  await page.evaluate(() =>
    (globalThis as AtlasMotionGlobal).__atlas?.waitIdle(),
  );
  const gotIt = page.getByRole('button', { name: 'Got it' });
  if (await gotIt.isVisible()) {
    await gotIt.click();
  }
}

test('elbow demo moves the forearm and restores it', async ({ page }) => {
  await waitForAtlas(page);

  const rest = await page.evaluate(() =>
    (globalThis as AtlasMotionGlobal).__atlas?.meshTransform('radius--l'),
  );
  expect(rest).not.toBeNull();

  await page.getByRole('tab', { name: 'Motion' }).click();
  await page
    .getByRole('button', { name: 'Elbow flexion and extension' })
    .click();

  await page.waitForFunction(
    () => {
      const a = (globalThis as AtlasMotionGlobal).__atlas;
      return (
        a?.getState().motion.activeId === 'elbow-flexion' &&
        a.motionPhase() > 0.05
      );
    },
    null,
    { timeout: 30_000 },
  );

  const moved = await page.evaluate(() =>
    (globalThis as AtlasMotionGlobal).__atlas?.meshTransform('radius--l'),
  );
  expect(moved).not.toBeNull();
  const deltaY = Math.abs(moved!.position[1] - rest!.position[1]);
  const deltaQ = Math.abs(moved!.quaternion[0] - rest!.quaternion[0]);
  expect(deltaY + deltaQ).toBeGreaterThan(0.01);

  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'Stop' }).click();

  await page.waitForFunction(
    () =>
      (globalThis as AtlasMotionGlobal).__atlas?.getState().motion.activeId ===
      null,
    null,
    { timeout: 10_000 },
  );

  const restored = await page.evaluate(() =>
    (globalThis as AtlasMotionGlobal).__atlas?.meshTransform('radius--l'),
  );
  expect(restored).not.toBeNull();
  for (let i = 0; i < 3; i++) {
    expect(restored!.position[i]).toBeCloseTo(rest!.position[i], 4);
  }
  for (let i = 0; i < 4; i++) {
    expect(restored!.quaternion[i]).toBeCloseTo(rest!.quaternion[i], 4);
  }
});

test('crossing muscles are ghosted and unpickable', async ({ page }) => {
  await waitForAtlas(page);

  await page.getByRole('tab', { name: 'Motion' }).click();
  await page
    .getByRole('button', { name: 'Elbow flexion and extension' })
    .click();

  await page.waitForFunction(
    () =>
      (globalThis as AtlasMotionGlobal).__atlas?.getState().motion.activeId ===
        'elbow-flexion' &&
      (globalThis as AtlasMotionGlobal).__atlas?.screenPointOf(
        'long-head-of-triceps-brachii--l',
      ) !== null,
    null,
    { timeout: 30_000 },
  );

  await page.evaluate(() => {
    (globalThis as AtlasMotionGlobal).__atlas?.dispatch({
      type: 'motion/motionPaused',
      payload: 0.25,
    });
  });
  await page.evaluate(() =>
    (globalThis as AtlasMotionGlobal).__atlas?.waitIdle(),
  );

  for (const id of [
    'long-head-of-triceps-brachii--l',
    'long-head-of-biceps-brachii--l',
  ]) {
    const pt = await page.evaluate(
      (meshId) =>
        (globalThis as AtlasMotionGlobal).__atlas?.screenPointOf(meshId) ??
        null,
      id,
    );
    expect(pt).not.toBeNull();
    await page.mouse.click(pt!.x, pt!.y);
    const selectedIds = await page.evaluate(
      () =>
        (globalThis as AtlasMotionGlobal).__atlas?.getState().selection
          .selectedIds ?? [],
    );
    expect(selectedIds).not.toContain(id);
  }
});

test('pins follow the bone', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile',
    'Desktop context-menu pin flow',
  );
  await waitForAtlas(page);

  await page.getByRole('tab', { name: 'Motion' }).click();
  await page
    .getByRole('button', { name: 'Elbow flexion and extension' })
    .click();

  await page.waitForFunction(
    () =>
      (globalThis as AtlasMotionGlobal).__atlas?.getState().motion.activeId ===
        'elbow-flexion' &&
      (globalThis as AtlasMotionGlobal).__atlas?.meshTransform('radius--l') !==
        null,
    null,
    { timeout: 30_000 },
  );

  await page.evaluate(() => {
    (globalThis as AtlasMotionGlobal).__atlas?.dispatch({
      type: 'motion/motionPaused',
      payload: 0,
    });
  });
  await page.evaluate(() =>
    (globalThis as AtlasMotionGlobal).__atlas?.waitIdle(),
  );

  const pt = await page.evaluate(() =>
    (globalThis as AtlasMotionGlobal).__atlas?.screenPointOf('radius--l'),
  );
  expect(pt).not.toBeNull();

  await page.mouse.move(pt!.x, pt!.y);
  await page.mouse.click(pt!.x, pt!.y, { button: 'right' });
  await page.getByRole('menuitem', { name: 'Add pin' }).click();
  await page.getByLabel('Label').fill('Radial pin');
  await page.getByRole('button', { name: 'Save' }).click();

  const pinBtn = page.getByRole('button', { name: 'Pin: Radial pin' });
  await expect(pinBtn).toBeVisible();
  const boxStart = await pinBtn.boundingBox();
  expect(boxStart).not.toBeNull();

  await page.evaluate(() => {
    (globalThis as AtlasMotionGlobal).__atlas?.dispatch({
      type: 'motion/motionPaused',
      payload: 0.5,
    });
  });

  await expect
    .poll(async () => {
      const box = await pinBtn.boundingBox();
      if (!box) return 0;
      return Math.hypot(box.x - boxStart!.x, box.y - boxStart!.y);
    })
    .toBeGreaterThan(25);
});

test('works with a section', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await waitForAtlas(page);

  await page.getByRole('tab', { name: 'Motion' }).click();
  await page.getByRole('button', { name: 'Heartbeat' }).click();

  await page.waitForFunction(
    () =>
      (globalThis as AtlasMotionGlobal).__atlas?.getState().motion.activeId ===
        'heartbeat' &&
      (globalThis as AtlasMotionGlobal).__atlas?.meshTransform(
        'left-ventricle',
      ) !== null,
    null,
    { timeout: 30_000 },
  );

  await page.evaluate(() => {
    (globalThis as AtlasMotionGlobal).__atlas?.dispatch({
      type: 'section/sectionSet',
      payload: { enabled: true, axis: 'sagittal', t: 0.55, flip: false },
    });
  });
  await page.evaluate(() =>
    (globalThis as AtlasMotionGlobal).__atlas?.waitIdle(),
  );

  // Playback continues smoothly while sectioned
  const phaseStart = await page.evaluate(
    () => (globalThis as AtlasMotionGlobal).__atlas?.motionPhase() ?? 0,
  );
  await expect
    .poll(() =>
      page.evaluate(
        () => (globalThis as AtlasMotionGlobal).__atlas?.motionPhase() ?? 0,
      ),
    )
    .not.toBe(phaseStart);

  await page.evaluate(() => {
    (globalThis as AtlasMotionGlobal).__atlas?.dispatch({
      type: 'motion/motionPaused',
      payload: 0,
    });
  });
  let s0: MeshTransform | null = null;
  await expect
    .poll(async () => {
      s0 = await page.evaluate(
        () =>
          (globalThis as AtlasMotionGlobal).__atlas?.meshTransform(
            'left-ventricle',
          ) ?? null,
      );
      return s0?.scale[0] ?? 0;
    })
    .toBeGreaterThan(0);

  await page.evaluate(() => {
    (globalThis as AtlasMotionGlobal).__atlas?.dispatch({
      type: 'motion/motionPaused',
      payload: 0.25,
    });
  });
  await expect
    .poll(async () => {
      const sPeak = await page.evaluate(
        () =>
          (globalThis as AtlasMotionGlobal).__atlas?.meshTransform(
            'left-ventricle',
          ) ?? null,
      );
      return sPeak && s0 ? Math.abs(sPeak.scale[0] - s0.scale[0]) : 0;
    })
    .toBeGreaterThan(0.001);

  expect(pageErrors).toEqual([]);
});

test('quiz stops the demo', async ({ page }) => {
  await waitForAtlas(page);

  const rest = await page.evaluate(() =>
    (globalThis as AtlasMotionGlobal).__atlas?.meshTransform('radius--l'),
  );
  expect(rest).not.toBeNull();

  await page.getByRole('tab', { name: 'Motion' }).click();
  await page
    .getByRole('button', { name: 'Elbow flexion and extension' })
    .click();

  await page.waitForFunction(
    () => {
      const a = (globalThis as AtlasMotionGlobal).__atlas;
      return (
        a?.getState().motion.activeId === 'elbow-flexion' &&
        a.motionPhase() > 0.05
      );
    },
    null,
    { timeout: 30_000 },
  );

  await page.getByRole('button', { name: 'Start quiz' }).click();

  await page.waitForFunction(
    () => {
      const st = (globalThis as AtlasMotionGlobal).__atlas?.getState();
      return st?.quiz.status !== 'off' && st?.motion.activeId === null;
    },
    null,
    { timeout: 10_000 },
  );

  const restored = await page.evaluate(() =>
    (globalThis as AtlasMotionGlobal).__atlas?.meshTransform('radius--l'),
  );
  expect(restored).not.toBeNull();
  for (let i = 0; i < 3; i++) {
    expect(restored!.position[i]).toBeCloseTo(rest!.position[i], 4);
  }

  const elbowBtn = page.getByRole('button', {
    name: 'Elbow flexion and extension',
  });
  await expect(elbowBtn).toBeDisabled();
  await expect(elbowBtn).toHaveAttribute('title', 'Finish the quiz first');
});
