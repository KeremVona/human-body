import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      projects: [
        {
          extends: true,
          test: {
            name: 'web',
            include: ['src/**/*.test.{ts,tsx}'],
            environment: 'jsdom',
            setupFiles: ['src/test/setup.ts'],
          },
        },
        {
          extends: true,
          test: {
            name: 'node',
            include: ['pipeline/**/*.test.ts', 'scripts/**/*.test.ts'],
            environment: 'node',
          },
        },
      ],
    },
  }),
);
