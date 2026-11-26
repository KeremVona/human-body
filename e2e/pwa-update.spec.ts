import { cpSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from './fixtures';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function startSwappableServer(initialDir: string) {
  let rootDir = initialDir;
  const server = createServer((req, res) => {
    const reqUrl = (req.url ?? '/').split('?')[0];
    const relPath = reqUrl === '/' ? 'index.html' : reqUrl.replace(/^\/+/, '');
    const filePath = path.join(rootDir, relPath);
    try {
      const st = statSync(filePath);
      if (st.isFile()) {
        const ext = path.extname(filePath);
        res.setHeader(
          'Content-Type',
          MIME_TYPES[ext] ?? 'application/octet-stream',
        );
        res.setHeader('Cache-Control', 'no-store');
        res.end(readFileSync(filePath));
        return;
      }
    } catch {
      // Fall through to 404
    }
    res.statusCode = 404;
    res.end('Not found');
  });

  return {
    server,
    setRoot: (nextDir: string) => {
      rootDir = nextDir;
    },
  };
}

function cloneDistWithVersion(dest: string, version: string): void {
  const distDir = path.resolve(process.cwd(), 'dist');
  cpSync(distDir, dest, { recursive: true });

  const htmlPath = path.join(dest, 'index.html');
  const html = readFileSync(htmlPath, 'utf8').replace(
    /<meta name="atlas-build" content="[^"]*"\s*\/?>/,
    `<meta name="atlas-build" content="${version}">`,
  );
  writeFileSync(htmlPath, html, 'utf8');

  const swPath = path.join(dest, 'sw.js');
  const rawSw = readFileSync(swPath, 'utf8');
  const sw = rawSw.replace(
    /("index\.html",revision:")([^"]+)(")/,
    `$1${version}-rev$3`,
  );
  if (sw === rawSw) {
    throw new Error('Failed to patch index.html revision inside cloned sw.js');
  }
  writeFileSync(swPath, sw, 'utf8');
}

test('holds waiting SW until user clicks Reload in UpdateToast, then switches build', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const workDir = mkdtempSync(path.join(tmpdir(), 'atlas-sw-update-'));
  const v1Dir = path.join(workDir, 'v1');
  const v2Dir = path.join(workDir, 'v2');

  cloneDistWithVersion(v1Dir, 'v1');
  cloneDistWithVersion(v2Dir, 'v2');

  const { server, setRoot } = startSwappableServer(v1Dir);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const origin = `http://127.0.0.1:${port}`;

  try {
    await page.goto(origin);
    await page.waitForFunction(
      async () => {
        const nav = (
          globalThis as unknown as {
            navigator?: {
              serviceWorker?: {
                controller?: unknown;
                ready: Promise<unknown>;
              };
            };
          }
        ).navigator;
        if (!nav?.serviceWorker) return false;
        await nav.serviceWorker.ready;
        return Boolean(nav.serviceWorker.controller);
      },
      null,
      { timeout: 20_000 },
    );

    const buildV1 = await page
      .locator('meta[name="atlas-build"]')
      .getAttribute('content');
    expect(buildV1).toBe('v1');

    // Switch backend static files to v2 and trigger SW update check
    setRoot(v2Dir);
    await page.evaluate(async () => {
      const nav = (
        globalThis as unknown as {
          navigator: {
            serviceWorker: {
              ready: Promise<{ update: () => Promise<unknown> }>;
            };
          };
        }
      ).navigator;
      const reg = await nav.serviceWorker.ready;
      await reg.update();
    });

    // UpdateToast appears while page stays on v1 with waiting SW held
    await expect(page.getByText('New version ready')).toBeVisible({
      timeout: 15_000,
    });
    const waitingState = await page.evaluate(async () => {
      const g = globalThis as unknown as {
        navigator: {
          serviceWorker: {
            getRegistration: () => Promise<{ waiting?: unknown } | undefined>;
          };
        };
        document: {
          querySelector: (s: string) => { getAttribute: (a: string) => string | null } | null;
        };
      };
      const reg = await g.navigator.serviceWorker.getRegistration();
      return {
        hasWaiting: Boolean(reg?.waiting),
        build: g.document
          .querySelector('meta[name="atlas-build"]')
          ?.getAttribute('content'),
      };
    });
    expect(waitingState.hasWaiting).toBe(true);
    expect(waitingState.build).toBe('v1');

    // Click Reload to activate waiting SW and reload onto v2
    const reloadButton = page.getByRole('button', { name: 'Reload' });
    await reloadButton.click();

    await page.waitForFunction(
      () => {
        const doc = (
          globalThis as unknown as {
            document: {
              querySelector: (s: string) => { getAttribute: (a: string) => string | null } | null;
            };
          }
        ).document;
        return (
          doc
            .querySelector('meta[name="atlas-build"]')
            ?.getAttribute('content') === 'v2'
        );
      },
      null,
      { timeout: 20_000 },
    );
    await expect(page.getByText('New version ready')).toBeHidden();
  } finally {
    server.close();
    rmSync(workDir, { recursive: true, force: true });
  }
});
