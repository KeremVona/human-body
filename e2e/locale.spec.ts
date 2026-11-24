import { expect, test, type Page } from '@playwright/test';

type AtlasGlobal = typeof globalThis & {
  __atlas?: {
    ready: boolean;
    select: (ids: string[]) => void;
    dispatch: (action: { type: string; payload: unknown }) => void;
    getState: () => {
      assets: { bundles: Record<string, string> };
    };
    waitIdle: () => Promise<void>;
  };
};

async function waitForReady(page: Page) {
  await page.waitForFunction(
    () => (globalThis as AtlasGlobal).__atlas?.ready === true,
    null,
    { timeout: 30_000 },
  );
  await page.evaluate(() => (globalThis as AtlasGlobal).__atlas?.waitIdle());
}

test('boots in Turkish via ?lang=tr and renders localized Inspector', async ({
  page,
}) => {
  await page.goto('/?lang=tr');
  await waitForReady(page);

  await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
  await expect(
    page.getByRole('combobox', { name: 'Yapıları ara' }),
  ).toHaveAttribute('placeholder', 'Anatomi ara (/)');

  const search = page.getByRole('combobox', { name: 'Yapıları ara' });
  await search.click();
  await search.fill('uyluk');
  await page
    .getByRole('option', { name: /Uyluk kemiği/i })
    .first()
    .click();

  const inspector = page.getByRole('complementary', {
    name: 'Yapı ayrıntıları',
  });
  await expect(inspector).toBeVisible();
  await expect(inspector).toContainText('Uyluk kemiği');
  await expect(inspector).toContainText('İskelet');
  await expect(inspector).toContainText('Odaklan');
});

test('detects Turkish automatically from navigator language tr-TR', async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: 'tr-TR' });
  const page = await context.newPage();
  await page.goto('/');
  await waitForReady(page);

  await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
  await expect(
    page.getByRole('combobox', { name: 'Yapıları ara' }),
  ).toBeVisible();
  await context.close();
});

test('switches language in Settings, persists across reload, and wraps longest Turkish labels without overflow', async ({
  page,
  request,
}) => {
  const trIndex = await (await request.get('/content/tr/index.json')).json();
  const longest = trIndex.structures.reduce(
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
  await waitForReady(page);

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('radio', { name: 'Türkçe' }).click();

  await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
  await expect(
    page.getByRole('combobox', { name: 'Yapıları ara' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');

  await page.reload();
  await waitForReady(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr');

  if (targetBundle && targetBundle.id !== 'skeletal') {
    await page.evaluate((sys) => {
      (globalThis as AtlasGlobal).__atlas!.dispatch({
        type: 'systems/systemToggled',
        payload: sys,
      });
    }, longest.system);
    await page.waitForFunction(
      (bundleId) =>
        (globalThis as AtlasGlobal).__atlas?.getState().assets.bundles[
          bundleId
        ] === 'ready',
      targetBundle.id,
      { timeout: 30_000 },
    );
  }

  await page.evaluate(
    (id) => (globalThis as AtlasGlobal).__atlas!.select([id]),
    meshId,
  );

  const inspector = page.getByRole('complementary', {
    name: 'Yapı ayrıntıları',
  });
  await expect(inspector).toBeVisible();
  await expect(inspector).toContainText(longest.names.common);

  const asideOverflow = await inspector.evaluate(
    (el) => el.scrollWidth > el.clientWidth + 1,
  );
  const docOverflow = await page.evaluate(() => {
    const g = globalThis as unknown as {
      document: { documentElement: { scrollWidth: number } };
      innerWidth: number;
    };
    return g.document.documentElement.scrollWidth > g.innerWidth + 1;
  });
  expect({ docOverflow, asideOverflow }).toEqual({
    docOverflow: false,
    asideOverflow: false,
  });
});
