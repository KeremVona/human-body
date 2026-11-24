import { defineConfig, devices } from '@playwright/test';

const e2eBase = process.env.E2E_BASE;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: e2eBase ? 'http://localhost:4174' : 'http://localhost:5174',
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
    : [
        {
          name: 'chromium',
          testIgnore: [/mobile\.spec\.ts/, /base-path\.spec\.ts/],
          use: {
            ...devices['Desktop Chrome'],
            launchOptions: {
              args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
            },
          },
        },
        {
          name: 'mobile',
          testMatch: /(?:mobile|layout|pins|locale)\.spec\.ts/,
          use: {
            ...devices['Pixel 7'],
            launchOptions: {
              args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
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
    : {
        command: 'npm run dev -- --port 5174 --strictPort',
        url: 'http://localhost:5174',
        reuseExistingServer: false,
      },
});
