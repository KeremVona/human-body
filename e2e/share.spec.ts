import { expect, test, type Page } from './fixtures';

type AtlasShareGlobal = typeof globalThis & {
  __atlas?: {
    ready: boolean;
    select: (ids: string[]) => void;
    getState: () => {
      assets: { bundles: Record<string, string> };
      systems: Record<string, { enabled: boolean; opacity: number }>;
      dissection: { hidden: string[]; isolated: string[] | null };
      selection: { selectedIds: string[] };
    };
    dispatch: (action: unknown) => void;
    screenPointOf: (id: string) => { x: number; y: number } | null;
    waitIdle: () => Promise<void>;
    encodeView: () => Promise<string>;
    getPose: () => {
      position: [number, number, number];
      target: [number, number, number];
    } | null;
  };
};

async function waitForAtlas(page: Page, url = '/') {
  await page.goto(url);
  await page.waitForFunction(
    () => (globalThis as AtlasShareGlobal).__atlas?.ready === true,
    null,
    { timeout: 30_000 },
  );
  await page.evaluate(() =>
    (globalThis as AtlasShareGlobal).__atlas?.waitIdle(),
  );
}

test('a shared link restores the view', async ({ page, context }) => {
  await waitForAtlas(page);

  await page.getByRole('switch', { name: 'Muscular' }).click();
  await page.waitForFunction(
    () =>
      (globalThis as AtlasShareGlobal).__atlas?.getState().assets.bundles
        .muscular === 'ready',
    null,
    { timeout: 30_000 },
  );

  await page.evaluate(() => {
    const atlas = (globalThis as AtlasShareGlobal).__atlas!;
    atlas.select(['femur--l']);
  });
  await page.keyboard.press('h');

  await page.evaluate(() => {
    (globalThis as AtlasShareGlobal).__atlas!.select(['body-of-sternum']);
  });
  await page.getByRole('button', { name: 'Left lateral view' }).click();
  await page.evaluate(() =>
    (globalThis as AtlasShareGlobal).__atlas?.waitIdle(),
  );

  const original = await page.evaluate(async () => {
    const atlas = (globalThis as AtlasShareGlobal).__atlas!;
    return {
      hash: await atlas.encodeView(),
      pose: atlas.getPose(),
    };
  });
  expect(original.hash).toMatch(/^#v1\./);
  expect(original.pose).not.toBeNull();

  const page2 = await context.newPage();
  await waitForAtlas(page2, `/${original.hash}`);
  await page2.waitForFunction(
    () =>
      (globalThis as AtlasShareGlobal).__atlas?.getState().assets.bundles
        .muscular === 'ready',
    null,
    { timeout: 30_000 },
  );
  await page2.evaluate(() =>
    (globalThis as AtlasShareGlobal).__atlas?.waitIdle(),
  );

  const restored = await page2.evaluate(() => {
    const atlas = (globalThis as AtlasShareGlobal).__atlas!;
    return {
      state: atlas.getState(),
      pose: atlas.getPose(),
    };
  });

  expect(restored.state.systems.muscular?.enabled).toBe(true);
  expect(restored.state.dissection.hidden).toContain('femur--l');
  expect(restored.state.selection.selectedIds).toEqual(['body-of-sternum']);
  expect(restored.pose).not.toBeNull();
  for (let i = 0; i < 3; i += 1) {
    expect(
      Math.abs(restored.pose!.position[i] - original.pose!.position[i]),
    ).toBeLessThan(0.01);
    expect(
      Math.abs(restored.pose!.target[i] - original.pose!.target[i]),
    ).toBeLessThan(0.01);
  }
  await page2.close();
});

test('a stale link applies what it can', async ({ page, context }) => {
  await waitForAtlas(page);
  await page.evaluate(() => {
    (globalThis as AtlasShareGlobal).__atlas!.select(['body-of-sternum']);
  });

  const editedHash = await page.evaluate(async () => {
    const atlas = (globalThis as AtlasShareGlobal).__atlas!;
    const hash = await atlas.encodeView();
    const codecUrl = '/src/features/share/codec.ts';
    const { decodeViewState, encodeViewState } = (await import(
      /* @vite-ignore */ codecUrl
    )) as {
      decodeViewState: (
        h: string,
        known: { meshIds: Set<string>; systems: Set<string> },
      ) => Promise<
        { ok: true; view: { h: string[] } } | { ok: false; reason: string }
      >;
      encodeViewState: (v: unknown) => Promise<string>;
    };
    const decoded = await decodeViewState(hash, {
      meshIds: new Set(['body-of-sternum', 'femur--l']),
      systems: new Set(['skeletal']),
    });
    if (!decoded.ok) throw new Error('Failed to decode captured view');
    decoded.view.h = [...decoded.view.h, 'gone--l'];
    return encodeViewState(decoded.view);
  });

  const page2 = await context.newPage();
  await waitForAtlas(page2, `/${editedHash}`);
  await expect(
    page2.getByRole('status').filter({
      hasText: 'Some parts in this link no longer exist and were skipped.',
    }),
  ).toBeVisible();
  const selected = await page2.evaluate(
    () =>
      (globalThis as AtlasShareGlobal).__atlas?.getState().selection
        .selectedIds ?? [],
  );
  expect(selected).toEqual(['body-of-sternum']);
  await page2.close();
});

test('a malformed link is harmless', async ({ page }) => {
  await waitForAtlas(page, '/#v1.garbage');

  await expect(
    page.getByRole('status').filter({ hasText: "This link couldn't be read." }),
  ).toBeVisible();
  const systems = await page.evaluate(
    () => (globalThis as AtlasShareGlobal).__atlas?.getState().systems ?? {},
  );
  const enabled = Object.entries(systems)
    .filter(([, s]) => s.enabled)
    .map(([id]) => id);
  expect(enabled).toEqual(['skeletal']);
});

test('copy link', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await waitForAtlas(page);

  await page.getByRole('button', { name: 'Share view' }).click();
  const shareInput = page.getByLabel('Share link');
  await expect(shareInput).not.toHaveValue('');
  const expectedLink = await shareInput.inputValue();

  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.getByText('Link copied')).toBeVisible();

  const clipboardText = await page.evaluate(() =>
    (
      globalThis as unknown as {
        navigator: { clipboard: { readText: () => Promise<string> } };
      }
    ).navigator.clipboard.readText(),
  );
  expect(clipboardText).toBe(expectedLink);
});
