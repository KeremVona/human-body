import { inflateSync } from 'node:zlib';
import { expect, test } from './fixtures';

type AtlasHandle = {
  ready: boolean;
  previewState: () => 'loading' | 'shown' | 'fading' | 'gone';
  getState: () => {
    selection: { selectedIds: string[]; hoveredId: string | null };
    dissection: { hidden: string[] };
  };
};

type AtlasGlobal = typeof globalThis & { __atlas?: AtlasHandle };

function decodePng(png: Buffer): {
  width: number;
  height: number;
  rgba: Uint8Array;
} {
  let offset = 8; // skip PNG signature
  let width = 0;
  let height = 0;
  let colorType = 6;
  const idatChunks: Buffer[] = [];

  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }

  const raw = inflateSync(Buffer.concat(idatChunks));
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const rgba = new Uint8Array(width * height * 4);
  const prevRow = new Uint8Array(stride);
  const currRow = new Uint8Array(stride);

  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    const filter = raw[rowStart];
    for (let i = 0; i < stride; i++) {
      const val = raw[rowStart + 1 + i];
      const left = i >= bpp ? currRow[i - bpp] : 0;
      const up = prevRow[i];
      const upLeft = i >= bpp ? prevRow[i - bpp] : 0;
      let recon = val;
      if (filter === 1) recon = (val + left) & 0xff;
      else if (filter === 2) recon = (val + up) & 0xff;
      else if (filter === 3) recon = (val + ((left + up) >> 1)) & 0xff;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        const pr = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        recon = (val + pr) & 0xff;
      }
      currRow[i] = recon;
    }
    prevRow.set(currRow);

    for (let x = 0; x < width; x++) {
      const dst = (y * width + x) * 4;
      const src = x * bpp;
      rgba[dst] = currRow[src];
      rgba[dst + 1] = currRow[src + 1];
      rgba[dst + 2] = currRow[src + 2];
      rgba[dst + 3] = bpp === 4 ? currRow[src + 3] : 255;
    }
  }

  return { width, height, rgba };
}

function silhouetteBbox(png: Buffer): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const { width, height, rgba } = decodePng(png);
  const bgR = rgba[0];
  const bgG = rgba[1];
  const bgB = rgba[2];

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const diff =
        Math.abs(rgba[i] - bgR) +
        Math.abs(rgba[i + 1] - bgG) +
        Math.abs(rgba[i + 2] - bgB);
      if (diff > 35) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, minY, maxX, maxY };
}

test('preview renders first with timing marks and LoadingDetailsChip before full skeleton', async ({
  page,
}) => {
  let releaseSkeletal!: () => void;
  const skeletalGate = new Promise<void>((resolve) => {
    releaseSkeletal = resolve;
  });

  await page.route('**/models/skeletal.*.glb', async (route) => {
    await skeletalGate;
    await route.continue();
  });

  await page.goto('/?debug');
  await expect(page.locator('canvas')).toBeVisible();

  await page.waitForFunction(
    () => (globalThis as AtlasGlobal).__atlas?.previewState() === 'shown',
    null,
    { timeout: 30_000 },
  );

  await expect(page.getByText('Loading anatomy details…')).toBeVisible();

  const marksDuringPreview = await page.evaluate(() => ({
    firstView: performance.getEntriesByName('atlas:first-view', 'mark').length,
    interactive: performance.getEntriesByName(
      'atlas:interactive-skeleton',
      'mark',
    ).length,
    ready: (globalThis as AtlasGlobal).__atlas?.ready,
  }));

  expect(marksDuringPreview.firstView).toBe(1);
  expect(marksDuringPreview.interactive).toBe(0);
  expect(marksDuringPreview.ready).toBe(false);

  releaseSkeletal();

  await page.waitForFunction(
    () =>
      (globalThis as AtlasGlobal).__atlas?.ready === true &&
      (globalThis as AtlasGlobal).__atlas?.previewState() === 'gone',
    null,
    { timeout: 30_000 },
  );

  await expect(page.getByText('Loading anatomy details…')).toBeHidden();

  const finalMarks = await page.evaluate(() => {
    const fv = performance.getEntriesByName('atlas:first-view', 'mark')[0];
    const inter = performance.getEntriesByName(
      'atlas:interactive-skeleton',
      'mark',
    )[0];
    return {
      firstViewMs: fv?.startTime ?? -1,
      interactiveMs: inter?.startTime ?? -1,
    };
  });

  expect(finalMarks.firstViewMs).toBeGreaterThan(0);
  expect(finalMarks.interactiveMs).toBeGreaterThan(finalMarks.firstViewMs);
});

test('picking, hover, context menu, and dissection shortcuts stay inert while preview is shown', async ({
  page,
}) => {
  let releaseSkeletal!: () => void;
  const skeletalGate = new Promise<void>((resolve) => {
    releaseSkeletal = resolve;
  });

  await page.route('**/models/skeletal.*.glb', async (route) => {
    await skeletalGate;
    await route.continue();
  });

  await page.goto('/');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  await page.waitForFunction(
    () => (globalThis as AtlasGlobal).__atlas?.previewState() === 'shown',
    null,
    { timeout: 30_000 },
  );

  const box = (await canvas.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  await page.mouse.move(cx, cy);
  await page.mouse.click(cx, cy);
  await page.mouse.click(cx, cy, { button: 'right' });
  await page.keyboard.press('h');

  const stateDuringPreview = await page.evaluate(() => {
    const s = (globalThis as AtlasGlobal).__atlas?.getState();
    return {
      selected: s?.selection.selectedIds ?? [],
      hovered: s?.selection.hoveredId ?? null,
      hidden: s?.dissection.hidden ?? [],
    };
  });

  expect(stateDuringPreview.selected).toEqual([]);
  expect(stateDuringPreview.hovered).toBeNull();
  expect(stateDuringPreview.hidden).toEqual([]);
  await expect(page.getByRole('menu')).toHaveCount(0);

  releaseSkeletal();
  await page.waitForFunction(
    () => (globalThis as AtlasGlobal).__atlas?.ready === true,
    null,
    { timeout: 30_000 },
  );
});

test('preview-to-skeletal swap aligns silhouette within 4 px', async ({
  page,
}) => {
  let releaseSkeletal!: () => void;
  const skeletalGate = new Promise<void>((resolve) => {
    releaseSkeletal = resolve;
  });

  await page.route('**/models/skeletal.*.glb', async (route) => {
    await skeletalGate;
    await route.continue();
  });

  await page.addInitScript(() => {
    (
      globalThis as unknown as {
        localStorage: { setItem: (k: string, v: string) => void };
      }
    ).localStorage.setItem('atlas.hintDismissed', '1');
  });

  await page.goto('/');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  await page.waitForFunction(
    () => (globalThis as AtlasGlobal).__atlas?.previewState() === 'shown',
    null,
    { timeout: 30_000 },
  );

  // Exclude TopBar (top 52px), LeftPanel (left 320px), symmetrical right band, and bottom hints (110px)
  // so silhouetteBbox strictly measures the centered skeletal viewport silhouette.
  const box = (await canvas.boundingBox())!;
  const xPad = box.width > 760 ? 320 : Math.floor(box.width * 0.35);
  const clip = {
    x: box.x + xPad,
    y: box.y + 52,
    width: Math.max(120, box.width - xPad * 2),
    height: box.height - 160,
  };

  await page.waitForTimeout(100);
  const beforePng = await page.screenshot({ clip });
  const beforeBox = silhouetteBbox(beforePng);

  releaseSkeletal();

  await page.waitForFunction(
    () =>
      (globalThis as AtlasGlobal).__atlas?.ready === true &&
      (globalThis as AtlasGlobal).__atlas?.previewState() === 'gone',
    null,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(100);
  const afterPng = await page.screenshot({ clip });
  const afterBox = silhouetteBbox(afterPng);

  expect(beforeBox.maxX).toBeGreaterThan(beforeBox.minX);
  expect(afterBox.maxX).toBeGreaterThan(afterBox.minX);
  expect(Math.abs(beforeBox.minX - afterBox.minX)).toBeLessThanOrEqual(4);
  expect(Math.abs(beforeBox.minY - afterBox.minY)).toBeLessThanOrEqual(4);
  expect(Math.abs(beforeBox.maxX - afterBox.maxX)).toBeLessThanOrEqual(4);
  expect(Math.abs(beforeBox.maxY - afterBox.maxY)).toBeLessThanOrEqual(4);
});

test('preview failure degrades silently to full skeletal bundle', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.route('**/models/skeletal-preview.*.glb', (route) =>
    route.fulfill({ status: 404 }),
  );

  await page.goto('/');
  await page.waitForFunction(
    () => (globalThis as AtlasGlobal).__atlas?.ready === true,
    null,
    { timeout: 30_000 },
  );

  await expect(page.getByRole('alert')).toHaveCount(0);
  const state = await page.evaluate(() =>
    (globalThis as AtlasGlobal).__atlas?.previewState(),
  );
  expect(state).toBe('gone');
  expect(errors).toEqual([]);
});
