import { expect, test, type Page } from '@playwright/test';

type AtlasTestGlobal = typeof globalThis & {
  __atlas?: {
    ready: boolean;
    meshIds: () => string[];
    getState: () => {
      assets: { bundles: Record<string, string> };
      dissection: { hidden: string[]; isolated: string[] | null };
      selection: { selectedIds: string[] };
      systems: Record<string, { enabled: boolean; opacity: number }>;
    };
    screenPointOf: (id: string) => { x: number; y: number } | null;
    waitIdle: () => Promise<void>;
    startQuiz: (seed?: number) => void;
    quizTarget: () => string | null;
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

test('opacity slider hides meshes and disables picking at 0%, restores cleanly', async ({
  page,
}) => {
  await waitForAtlas(page);

  const femurPt = await page.evaluate(() =>
    (globalThis as AtlasTestGlobal).__atlas?.screenPointOf('femur--l'),
  );
  expect(femurPt).not.toBeNull();
  expect(
    await page.evaluate(() =>
      (globalThis as AtlasTestGlobal).__atlas?.meshVisible('femur--l'),
    ),
  ).toBe(true);

  const slider = page.getByRole('slider', { name: 'Skeletal opacity' });
  await slider.focus();
  await page.keyboard.press('Home');
  await expect(slider).toHaveAttribute('aria-valuenow', '0');

  await page.waitForFunction(
    () =>
      (globalThis as AtlasTestGlobal).__atlas?.meshVisible('femur--l') ===
      false,
  );

  // Clicking where the femur used to be should not select anything.
  await page.mouse.click(femurPt!.x, femurPt!.y);
  await expect(
    page.locator('aside[aria-label="Structure details"]'),
  ).toHaveCount(0);

  await slider.focus();
  await page.keyboard.press('End');
  await expect(slider).toHaveAttribute('aria-valuenow', '100');
  await page.waitForFunction(
    () =>
      (globalThis as AtlasTestGlobal).__atlas?.meshVisible('femur--l') === true,
  );
});

test('organ systems load cleanly without Major Organs group', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await waitForAtlas(page);
  await expect(page.getByRole('switch', { name: 'Major Organs' })).toHaveCount(
    0,
  );

  for (const label of ['Cardiovascular', 'Nervous', 'Respiratory']) {
    await page.getByRole('switch', { name: label }).click();
  }

  await page.waitForFunction(
    () => {
      const bundles = (globalThis as AtlasTestGlobal).__atlas?.getState().assets
        .bundles;
      return bundles?.cardiovascular === 'ready' && bundles?.organs === 'ready';
    },
    null,
    { timeout: 30_000 },
  );

  expect(pageErrors).toEqual([]);
});

test('slash shortcut focuses search and selecting Left ventricle loads and focuses it', async ({
  page,
}) => {
  await waitForAtlas(page);

  await page.keyboard.press('/');
  const search = page.getByRole('combobox', { name: /Search structures/i });
  await expect(search).toBeFocused();

  await search.fill('left ventricle');
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('Enter');

  await page.waitForFunction(
    () =>
      (globalThis as AtlasTestGlobal).__atlas?.getState().assets.bundles
        .cardiovascular === 'ready',
    null,
    { timeout: 30_000 },
  );
  await expect(
    page.locator('aside[aria-label="Structure details"]'),
  ).toContainText('Left ventricle');
});

test('tree browse navigates with keyboard and eye button toggles visibility', async ({
  page,
}) => {
  await waitForAtlas(page);
  await page.getByRole('tab', { name: 'Browse' }).click();

  const skeletalItem = page.getByRole('treeitem', { name: /Skeletal/i });
  await skeletalItem.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect(
    page.locator('aside[aria-label="Structure details"]'),
  ).toBeVisible();

  const hideButton = page.getByRole('button', { name: /^Hide /i }).first();
  await hideButton.click();
  await expect(
    page.getByRole('button', { name: /^Show /i }).first(),
  ).toBeVisible();

  // Collapsing the selected ancestor stays collapsed
  await skeletalItem.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(skeletalItem).toHaveAttribute('aria-expanded', 'false');
});

test('find-and-click quiz suppresses dissection tools, tracks attempts, saves best, and restores state', async ({
  page,
}) => {
  await waitForAtlas(page);

  // Set identifiable pre-quiz state: hide one clavicle so restore can be verified.
  const clavPt = await page.evaluate(() =>
    (globalThis as AtlasTestGlobal).__atlas?.screenPointOf('clavicle--l'),
  );
  expect(clavPt).not.toBeNull();
  await page.mouse.click(clavPt!.x, clavPt!.y);
  await page.keyboard.press('h');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (globalThis as AtlasTestGlobal).__atlas?.getState().dissection.hidden
            .length ?? 0,
      ),
    )
    .toBe(1);

  await page.evaluate(() =>
    (globalThis as AtlasTestGlobal).__atlas?.startQuiz(12345),
  );

  await expect(page.getByText(/Question 1 of 10/)).toBeVisible();
  await expect(
    page.locator('aside[aria-label="Structure details"]'),
  ).toHaveCount(0);

  // Dissection shortcuts must do nothing during quiz.
  await page.keyboard.press('h');
  await page.keyboard.press('i');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (globalThis as AtlasTestGlobal).__atlas?.getState().dissection
            .isolated,
      ),
    )
    .toBeNull();

  // Exercise one wrong click on Q1 cleanly.
  const q1Target = await page.evaluate(
    () => (globalThis as AtlasTestGlobal).__atlas?.quizTarget() ?? null,
  );
  expect(q1Target).not.toBeNull();
  const wrongMesh = q1Target!.startsWith('femur') ? 'cranium' : 'femur--l';
  const wrongPt = await page.evaluate(
    (id) => (globalThis as AtlasTestGlobal).__atlas?.screenPointOf(id) ?? null,
    wrongMesh,
  );
  if (wrongPt) {
    await page.mouse.click(wrongPt.x, wrongPt.y);
    await expect(page.getByText(/That's the/)).toBeVisible();
    // Wait for 800ms wrong-flash timeout to return quiz status to 'asking'.
    await expect(page.getByRole('button', { name: 'Skip' })).toBeVisible();
    await page.waitForFunction(
      () => (globalThis as AtlasTestGlobal).__atlas?.quizTarget() !== null,
    );
  }

  // Answer or advance through all 10 questions cleanly, verifying positive scoring on unoccluded hits.
  let scoredCorrect = false;
  for (let i = 0; i < 10; i++) {
    const target = await page.evaluate(
      () => (globalThis as AtlasTestGlobal).__atlas?.quizTarget() ?? null,
    );
    if (!target) break;

    const pt = await page.evaluate(
      (id) =>
        (globalThis as AtlasTestGlobal).__atlas?.screenPointOf(id) ?? null,
      target,
    );

    if (pt) {
      await page.mouse.click(pt.x, pt.y);
    }

    const nextBtn = page.getByRole('button', { name: 'Next' });
    if (await nextBtn.isVisible().catch(() => false)) {
      if (
        await page
          .getByText('Correct!')
          .isVisible()
          .catch(() => false)
      ) {
        scoredCorrect = true;
      }
    } else {
      // Wait past any wrong flash if another mesh sat in front, then Skip.
      await page.waitForFunction(
        () => (globalThis as AtlasTestGlobal).__atlas?.quizTarget() !== null,
      );
      await page.getByRole('button', { name: 'Skip' }).click();
    }
    await nextBtn.click();
  }
  expect(scoredCorrect).toBe(true);

  await expect(
    page.getByRole('dialog', { name: /Quiz complete/i }),
  ).toBeVisible();
  const bestStored = await page.evaluate(() =>
    localStorage.getItem('atlas.quiz.best'),
  );
  expect(Number(bestStored)).toBeGreaterThanOrEqual(1);

  await page.getByRole('button', { name: 'Close' }).click();
  await expect(
    page.getByRole('dialog', { name: /Quiz complete/i }),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (globalThis as AtlasTestGlobal).__atlas?.getState().dissection.hidden
            .length ?? 0,
      ),
    )
    .toBe(1);
});
