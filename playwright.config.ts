import { defineConfig, devices } from '@playwright/test';

const e2eBase = process.env.E2E_BASE;
if (process.argv.some((arg) => arg.includes('chromium-sw'))) {
  process.env.E2E_SW = '1';
}
const wantsSw = process.env.E2E_SW === '1';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: e2eBase
      ? 'http://localhost:4174'
      : wantsSw
        ? 'http://localhost:4175'
        : 'http://localhost:5174',
    trace: 'on-first-retry',
  },
  projects: e2eBase
    ? [
        {
          name: 'base-path',
          testMatch: /base-path\.spec\.ts/,
          use: {
            ...devices['Desktop Chrome'],
            launchOptions: {
              args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
            },
          },
        },
      ]
    : wantsSw
      ? [
          {
            name: 'chromium-sw',
            testMatch: /(?:pwa-update|offline)\.spec\.ts/,
            use: {
              ...devices['Desktop Chrome'],
              launchOptions: {
                args: [
                  '--use-angle=swiftshader',
                  '--enable-unsafe-swiftshader',
                ],
              },
            },
          },
        ]
      : [
          {
            name: 'chromium',
            testIgnore: [
              /mobile\.spec\.ts/,
              /base-path\.spec\.ts/,
              /pwa-update\.spec\.ts/,
              /offline\.spec\.ts/,
            ],
            use: {
              ...devices['Desktop Chrome'],
              launchOptions: {
                args: [
                  '--use-angle=swiftshader',
                  '--enable-unsafe-swiftshader',
                ],
              },
            },
          },
          {
            name: 'chromium-batching-off',
            testIgnore: [
              /mobile\.spec\.ts/,
              /base-path\.spec\.ts/,
              /batching\.spec\.ts/,
              /pwa-update\.spec\.ts/,
              /offline\.spec\.ts/,
            ],
            use: {
              ...devices['Desktop Chrome'],
              launchOptions: {
                args: [
                  '--use-angle=swiftshader',
                  '--enable-unsafe-swiftshader',
                ],
              },
            },
          },
          {
            name: 'mobile',
            testMatch: /(?:mobile|layout|pins|locale)\.spec\.ts/,
            use: {
              ...devices['Pixel 7'],
              launchOptions: {
                args: [
                  '--use-angle=swiftshader',
                  '--enable-unsafe-swiftshader',
                ],
              },
            },
          },
        ],
  webServer: e2eBase
    ? {
        command: `npx vite preview --port 4174 --strictPort --base ${e2eBase}`,
        url: `http://localhost:4174${e2eBase}`,
        reuseExistingServer: false,
      }
    : wantsSw
      ? {
          command: 'npm run build && npx vite preview --port 4175 --strictPort',
          url: 'http://localhost:4175',
          reuseExistingServer: false,
          timeout: 120_000,
        }
      : {
          command: 'npm run dev -- --port 5174 --strictPort',
          url: 'http://localhost:5174',
          reuseExistingServer: false,
        },
});
