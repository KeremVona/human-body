import { expect, test, type Page } from './fixtures';

type AtlasSectionGlobal = typeof globalThis & {
  __atlas?: {
    ready: boolean;
    screenPointOf: (id: string) => { x: number; y: number } | null;
    waitIdle: () => Promise<void>;
    dispatch: (action: unknown) => void;
    encodeView: () => Promise<string>;
    getPose: () => {
      position: [number, number, number];
      target: [number, number, number];
    } | null;
    section: () => SectionState;
    getState: () => {
      selection: { selectedIds: string[] };
      assets: {
        manifest: {
          bundles: { id: string; meshIds: string[] }[];
          meshes: Record<
            string,
            {
              bounds: {
                min: [number, number, number];
                max: [number, number, number];
              };
            }
          >;
        } | null;
      };
    };
  };
};

type SectionState = {
  enabled: boolean;
  axis: 'axial' | 'sagittal' | 'coronal';
  t: number;
  flip: boolean;
};

async function waitForAtlas(page: Page, url = '/') {
  await page.goto(url);
  await page.waitForFunction(
    () => (globalThis as AtlasSectionGlobal).__atlas?.ready === true,
    null,
    { timeout: 30_000 },
  );
  await page.evaluate(() =>
    (globalThis as AtlasSectionGlobal).__atlas?.waitIdle(),
  );
}

test('toggle with X and frame the cut', async ({ page }) => {
  await waitForAtlas(page);

  await page.keyboard.press('x');
  await page.evaluate(() =>
    (globalThis as AtlasSectionGlobal).__atlas?.waitIdle(),
  );

  const info = await page.evaluate(() => {
    const atlas = (globalThis as AtlasSectionGlobal).__atlas!;
    const manifest = atlas.getState().assets.manifest;
    const meshes = manifest?.meshes ?? {};
    const skelIds =
      manifest?.bundles.find((b) => b.id === 'skeletal')?.meshIds ??
      Object.keys(meshes);
    let minY = Infinity;
    let maxY = -Infinity;
    for (const id of skelIds) {
      const m = meshes[id];
      if (!m) continue;
      if (m.bounds.min[1] < minY) minY = m.bounds.min[1];
      if (m.bounds.max[1] > maxY) maxY = m.bounds.max[1];
    }
    const centerY = (minY + maxY) / 2;
    return {
      sec: atlas.section(),
      pose: atlas.getPose(),
      centerY,
    };
  });

  expect(info.sec.enabled).toBe(true);
  expect(info.sec.axis).toBe('axial');
  expect(info.pose).not.toBeNull();
  expect(info.pose!.position[1]).toBeGreaterThan(info.centerY);
});

test('removed side is not pickable', async ({ page }) => {
  await waitForAtlas(page);

  await page.evaluate(() => {
    const atlas = (globalThis as AtlasSectionGlobal).__atlas!;
    atlas.dispatch({
      type: 'section/sectionSet',
      payload: { enabled: true, axis: 'sagittal', t: 0.5, flip: false },
    });
  });
  await page.evaluate(() =>
    (globalThis as AtlasSectionGlobal).__atlas?.waitIdle(),
  );

  await page.getByRole('button', { name: 'Anterior view' }).click();
  await page.evaluate(() =>
    (globalThis as AtlasSectionGlobal).__atlas?.waitIdle(),
  );

  const pt = await page.evaluate(() =>
    (globalThis as AtlasSectionGlobal).__atlas?.screenPointOf('femur--l'),
  );
  expect(pt).not.toBeNull();

  await page.mouse.click(pt!.x, pt!.y);
  const selectedIds = await page.evaluate(
    () =>
      (globalThis as AtlasSectionGlobal).__atlas?.getState().selection
        .selectedIds ?? [],
  );
  expect(selectedIds).not.toContain('femur--l');
});

test('cut face is pickable', async ({ page }) => {
  await waitForAtlas(page);

  const cutT = await page.evaluate(() => {
    const atlas = (globalThis as AtlasSectionGlobal).__atlas!;
    const manifest = atlas.getState().assets.manifest;
    const meshes = manifest?.meshes ?? {};
    const skelIds =
      manifest?.bundles.find((b) => b.id === 'skeletal')?.meshIds ??
      Object.keys(meshes);
    let minY = Infinity;
    let maxY = -Infinity;
    for (const id of skelIds) {
      const m = meshes[id];
      if (!m) continue;
      if (m.bounds.min[1] < minY) minY = m.bounds.min[1];
      if (m.bounds.max[1] > maxY) maxY = m.bounds.max[1];
    }
    const femur = meshes['femur--l'];
    const femurMidY = (femur.bounds.min[1] + femur.bounds.max[1]) / 2;
    return (femurMidY - minY) / (maxY - minY);
  });

  await page.evaluate((t) => {
    const atlas = (globalThis as AtlasSectionGlobal).__atlas!;
    atlas.dispatch({
      type: 'section/sectionSet',
      payload: { enabled: true, axis: 'axial', t, flip: false },
    });
  }, cutT);
  await page.evaluate(() =>
    (globalThis as AtlasSectionGlobal).__atlas?.waitIdle(),
  );

  const pt = await page.evaluate(() =>
    (globalThis as AtlasSectionGlobal).__atlas?.screenPointOf('femur--l'),
  );
  expect(pt).not.toBeNull();

  await page.mouse.click(pt!.x - 10, pt!.y);
  const selectedIds = await page.evaluate(
    () =>
      (globalThis as AtlasSectionGlobal).__atlas?.getState().selection
        .selectedIds ?? [],
  );
  expect(selectedIds).toEqual(['femur--l']);
});

test('share link carries the section and preserves camera pose', async ({
  page,
  context,
}) => {
  await waitForAtlas(page);

  await page.evaluate(() => {
    const atlas = (globalThis as AtlasSectionGlobal).__atlas!;
    atlas.dispatch({
      type: 'section/sectionSet',
      payload: { enabled: true, axis: 'axial', t: 0.4, flip: false },
    });
  });
  await page.evaluate(() =>
    (globalThis as AtlasSectionGlobal).__atlas?.waitIdle(),
  );
  await page.getByRole('button', { name: 'Anterior view' }).click();
  await page.evaluate(() =>
    (globalThis as AtlasSectionGlobal).__atlas?.waitIdle(),
  );

  const original = await page.evaluate(async () => {
    const atlas = (globalThis as AtlasSectionGlobal).__atlas!;
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
      (globalThis as AtlasSectionGlobal).__atlas?.section().enabled === true,
    null,
    { timeout: 10_000 },
  );
  await page2.evaluate(() =>
    (globalThis as AtlasSectionGlobal).__atlas?.waitIdle(),
  );

  const restored = await page2.evaluate(() => {
    const atlas = (globalThis as AtlasSectionGlobal).__atlas!;
    return {
      sec: atlas.section(),
      pose: atlas.getPose(),
    };
  });
  expect(restored.sec).toEqual({
    enabled: true,
    axis: 'axial',
    t: 0.4,
    flip: false,
  });
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

test('turning off restores rendering', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Desktop rendering diff check');
  await waitForAtlas(page);
  await page.waitForTimeout(250);

  const beforePng = await page.locator('canvas').screenshot();

  await page.keyboard.press('x');
  await page.evaluate(() =>
    (globalThis as AtlasSectionGlobal).__atlas?.waitIdle(),
  );
  await page.keyboard.press('x');
  await page.evaluate(() =>
    (globalThis as AtlasSectionGlobal).__atlas?.waitIdle(),
  );
  await page.getByRole('button', { name: 'Reset view' }).click();
  await page.evaluate(() =>
    (globalThis as AtlasSectionGlobal).__atlas?.waitIdle(),
  );
  await page.waitForTimeout(250);

  const afterPng = await page.locator('canvas').screenshot();

  const beforeB64 = beforePng.toString('base64');
  const afterB64 = afterPng.toString('base64');
  const diffRatio = await page.evaluate(
    async ({ a, b }) => {
      type Bmp = { width: number; height: number };
      const win = globalThis as unknown as {
        createImageBitmap(blob: Blob): Promise<Bmp>;
        document: {
          createElement(tag: 'canvas'): {
            width: number;
            height: number;
            getContext(kind: '2d'): {
              drawImage(img: Bmp, x: number, y: number): void;
              getImageData(
                x: number,
                y: number,
                w: number,
                h: number,
              ): { data: Uint8ClampedArray };
            } | null;
          };
        };
      };
      const decode = async (b64: string) => {
        const res = await fetch(`data:image/png;base64,${b64}`);
        const blob = await res.blob();
        const bmp = await win.createImageBitmap(blob);
        const canvas = win.document.createElement('canvas');
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(bmp, 0, 0);
        return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      };
      const imgA = await decode(a);
      const imgB = await decode(b);
      const pixels = imgA.length / 4;
      let diff = 0;
      for (let i = 0; i < imgA.length; i += 4) {
        if (
          Math.abs(imgA[i] - imgB[i]) > 6 ||
          Math.abs(imgA[i + 1] - imgB[i + 1]) > 6 ||
          Math.abs(imgA[i + 2] - imgB[i + 2]) > 6
        ) {
          diff += 1;
        }
      }
      return diff / pixels;
    },
    { a: beforeB64, b: afterB64 },
  );

  expect(diffRatio).toBeLessThanOrEqual(0.01);
});
