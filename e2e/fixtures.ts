import { test as base, expect, type Page } from '@playwright/test';

function appendBatchingOff(url: string): string {
  if (url.startsWith('about:') || url.startsWith('data:')) {
    return url;
  }
  const parsed = new URL(url, 'http://localhost:5174');
  if (!parsed.searchParams.has('batching')) {
    parsed.searchParams.set('batching', 'off');
  }
  if (/^https?:\/\//i.test(url)) {
    return parsed.toString();
  }
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

function wrapPageGoto(page: Page): Page {
  const origGoto = page.goto.bind(page);
  page.goto = ((url: string, options?: Parameters<Page['goto']>[1]) =>
    origGoto(appendBatchingOff(url), options)) as Page['goto'];
  return page;
}

export const test = base.extend({
  context: async ({ context }, accept, testInfo) => {
    if (testInfo.project.name === 'chromium-batching-off') {
      const origNewPage = context.newPage.bind(context);
      context.newPage = (async (
        ...args: Parameters<typeof origNewPage>
      ) => {
        const p = await origNewPage(...args);
        return wrapPageGoto(p);
      }) as typeof context.newPage;
    }
    await accept(context);
  },
  page: async ({ page }, accept, testInfo) => {
    if (testInfo.project.name === 'chromium-batching-off') {
      wrapPageGoto(page);
    }
    await accept(page);
  },
});

export { expect };
export type { Page };
