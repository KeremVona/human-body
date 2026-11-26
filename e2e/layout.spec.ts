import { expect, test } from './fixtures';

type AtlasGlobal = typeof globalThis & {
  __atlas?: {
    ready: boolean;
    select: (ids: string[]) => void;
    setPointer: (x: number, y: number) => void;
    dispatch: (action: { type: string; payload: unknown }) => void;
    getState: () => {
      assets: { bundles: Record<string, string> };
    };
  };
};

test('longest names wrap inside the Inspector and hover label', async ({
  page,
  request,
}) => {
  const index = await (await request.get('/content/en/index.json')).json();
  const longest = index.structures.reduce(
    (
      a: {
        id: string;
        system: string;
        names: { common: string; latin?: string };
      },
      b: {
        id: string;
        system: string;
        names: { common: string; latin?: string };
      },
    ) =>
      Math.max(b.names.common.length, (b.names.latin ?? '').length) >
      Math.max(a.names.common.length, (a.names.latin ?? '').length)
        ? b
        : a,
  );
  const manifest = await (await request.get('/models/manifest.json')).json();
  const meshId = Object.keys(manifest.meshes).find(
    (m) => m === longest.id || m.startsWith(`${longest.id}--`),
  )!;
  const targetBundle = manifest.bundles.find(
    (b: { id: string; meshIds: string[] }) => b.meshIds.includes(meshId),
  );

  await page.goto('/');
  await page.waitForFunction(
    () => (globalThis as AtlasGlobal).__atlas?.ready === true,
    null,
    { timeout: 30_000 },
  );

  if (targetBundle && targetBundle.id !== 'skeletal') {
    await page.evaluate((sys) => {
      (globalThis as AtlasGlobal).__atlas!.dispatch({
        type: 'systems/systemToggled',
        payload: sys,
      });
    }, longest.system);
    await page.waitForFunction(
      (bId) =>
        (globalThis as AtlasGlobal).__atlas?.getState().assets.bundles[bId] ===
        'ready',
      targetBundle.id,
      { timeout: 30_000 },
    );
  }

  await page.evaluate(
    (id) => (globalThis as AtlasGlobal).__atlas!.select([id]),
    meshId,
  );
  const aside = page.getByRole('complementary', { name: 'Structure details' });
  await expect(aside).toBeVisible();
  const overflow = await aside.evaluate(
    (el) => el.scrollWidth - el.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  const isCoarse = await page.evaluate(
    () =>
      (
        globalThis as unknown as { matchMedia(q: string): { matches: boolean } }
      ).matchMedia('(pointer: coarse)').matches,
  );
  if (!isCoarse) {
    await page.evaluate((id) => {
      (globalThis as AtlasGlobal).__atlas!.setPointer(1250, 300);
      (globalThis as AtlasGlobal).__atlas!.dispatch({
        type: 'selection/hovered',
        payload: id,
      });
    }, meshId);
    const hoverBox = page.locator('div[aria-hidden="true"]', {
      hasText: longest.names.common,
    });
    await expect(hoverBox).toBeVisible();
    const hoverMetrics = await hoverBox.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        scrollW: el.scrollWidth,
        clientW: el.clientWidth,
        left: r.left,
        width: r.width,
        right: r.right,
        vw: (globalThis as unknown as { innerWidth: number }).innerWidth,
      };
    });
    expect(hoverMetrics.left).toBeGreaterThanOrEqual(800);
    expect(hoverMetrics.scrollW).toBeLessThanOrEqual(hoverMetrics.clientW);
    expect(hoverMetrics.right).toBeLessThanOrEqual(hoverMetrics.vw);
    expect(hoverMetrics.width).toBeLessThanOrEqual(270);
  }
});
