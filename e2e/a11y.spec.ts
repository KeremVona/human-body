import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';

type AtlasTestGlobal = typeof globalThis & {
  __atlas?: {
    ready: boolean;
    screenPointOf: (id: string) => { x: number; y: number } | null;
    waitIdle: () => Promise<void>;
    startQuiz: (seed?: number) => void;
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

function seriousOrCritical(
  results: Awaited<ReturnType<AxeBuilder['analyze']>>,
) {
  return results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
}

test('default loaded view has no serious or critical axe violations', async ({
  page,
}) => {
  await waitForAtlas(page);
  const results = await new AxeBuilder({ page }).analyze();
  expect(seriousOrCritical(results)).toEqual([]);
});

test('inspector open state has no serious or critical axe violations', async ({
  page,
}) => {
  await waitForAtlas(page);
  const pt = await page.evaluate(() =>
    (globalThis as AtlasTestGlobal).__atlas?.screenPointOf('femur--l'),
  );
  expect(pt).not.toBeNull();
  await page.mouse.click(pt!.x, pt!.y);
  await expect(
    page.locator('aside[aria-label="Structure details"]'),
  ).toContainText('Femur');

  const results = await new AxeBuilder({ page }).analyze();
  expect(seriousOrCritical(results)).toEqual([]);
});

test('about dialog open state has no serious or critical axe violations', async ({
  page,
}) => {
  await waitForAtlas(page);
  await page.getByRole('button', { name: 'About this atlas' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(seriousOrCritical(results)).toEqual([]);
});

test('quiz banner active state has no serious or critical axe violations', async ({
  page,
}) => {
  await waitForAtlas(page);
  await page.evaluate(() =>
    (globalThis as AtlasTestGlobal).__atlas?.startQuiz(12345),
  );
  await expect(page.getByText(/Question 1 of 10/)).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(seriousOrCritical(results)).toEqual([]);
});

test('browse tree, search results, settings popover, and quiz summary pass axe checks', async ({
  page,
}) => {
  await waitForAtlas(page);

  await page.getByRole('tab', { name: 'Browse' }).click();
  const skeletalItem = page.getByRole('treeitem', { name: /Skeletal/i });
  await skeletalItem.click();
  await expect(skeletalItem).toHaveAttribute('aria-expanded', 'true');
  expect(seriousOrCritical(await new AxeBuilder({ page }).analyze())).toEqual(
    [],
  );

  const search = page.getByRole('combobox', { name: /Search structures/i });
  await search.click();
  await search.fill('fem');
  await expect(page.getByRole('listbox')).toBeVisible();
  expect(seriousOrCritical(await new AxeBuilder({ page }).analyze())).toEqual(
    [],
  );
  await search.press('Escape');

  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(
    page.getByRole('radiogroup', { name: 'Graphics quality' }),
  ).toBeVisible();
  expect(seriousOrCritical(await new AxeBuilder({ page }).analyze())).toEqual(
    [],
  );
  await page.keyboard.press('Escape');

  await page.evaluate(() =>
    (globalThis as AtlasTestGlobal).__atlas?.startQuiz(12345),
  );
  for (let i = 0; i < 10; i++) {
    await page.getByRole('button', { name: 'Skip' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
  }
  await expect(
    page.getByRole('dialog', { name: /Quiz complete/i }),
  ).toBeVisible();
  expect(seriousOrCritical(await new AxeBuilder({ page }).analyze())).toEqual(
    [],
  );
});
