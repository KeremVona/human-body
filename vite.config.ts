import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { cpSync, existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  defineConfig,
  type Connect,
  type HtmlTagDescriptor,
  type Plugin,
  type ResolvedConfig,
} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

function copyContentPlugin(): Plugin {
  let resolved: ResolvedConfig | null = null;
  return {
    name: 'copy-content-dir',
    apply: 'build',
    configResolved(config) {
      resolved = config;
    },
    closeBundle() {
      if (!resolved) return;
      const src = path.resolve(resolved.root, 'content');
      if (!existsSync(src)) return;
      const dest = path.resolve(
        resolved.root,
        resolved.build.outDir,
        'content',
      );
      cpSync(src, dest, {
        recursive: true,
        filter: (file) => path.basename(file) !== '.gitkeep',
      });
    },
  };
}

function content404Plugin(): Plugin {
  let root = process.cwd();
  let outDir = 'dist';
  let base = '/';
  const attach = (middlewares: Connect.Server, baseDir: string) => {
    const normalizedBase = base.endsWith('/') ? base : `${base}/`;
    const contentPrefix = `${normalizedBase}content/`;
    const contentRoot = path.resolve(baseDir, 'content');
    middlewares.use((req, res, next) => {
      const cleanUrl = req.url?.split('?')[0] ?? '';
      if (!cleanUrl.startsWith(contentPrefix)) {
        next();
        return;
      }
      const rel = cleanUrl.slice(normalizedBase.length);
      const filePath = path.resolve(baseDir, rel);
      if (
        !filePath.startsWith(contentRoot + path.sep) ||
        !existsSync(filePath) ||
        !statSync(filePath).isFile()
      ) {
        res.statusCode = 404;
        res.end();
        return;
      }
      next();
    });
  };
  return {
    name: 'content-404',
    configResolved(config) {
      root = config.root;
      outDir = config.build.outDir;
      base = config.base;
    },
    configureServer(server) {
      attach(server.middlewares, root);
    },
    configurePreviewServer(server) {
      attach(server.middlewares, path.resolve(root, outDir));
    },
  };
}

function preloadAssetsPlugin(): Plugin {
  let root = process.cwd();
  let base = '/';
  return {
    name: 'preload-atlas-assets',
    configResolved(config) {
      root = config.root;
      base = config.base;
    },
    transformIndexHtml() {
      const normalizedBase = base.endsWith('/') ? base : `${base}/`;
      const manifestPath = path.resolve(root, 'public/models/manifest.json');
      let skeletalFile: string | undefined;
      let previewFile: string | undefined;
      if (existsSync(manifestPath)) {
        try {
          const parsed = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
            bundles?: Array<{ id?: string; file?: string }>;
            preview?: { file?: string };
          };
          skeletalFile = parsed.bundles?.find((b) => b.id === 'skeletal')?.file;
          previewFile = parsed.preview?.file;
        } catch {
          skeletalFile = undefined;
          previewFile = undefined;
        }
      }

      const tags: HtmlTagDescriptor[] = [
        {
          tag: 'link',
          attrs: {
            rel: 'preload',
            as: 'fetch',
            crossorigin: 'anonymous',
            href: `${normalizedBase}models/manifest.json`,
          },
          injectTo: 'head',
        },
        {
          tag: 'link',
          attrs: {
            rel: 'preload',
            as: 'fetch',
            crossorigin: 'anonymous',
            href: `${normalizedBase}content/taxonomy.json`,
          },
          injectTo: 'head',
        },
        {
          tag: 'link',
          attrs: {
            rel: 'preload',
            as: 'fetch',
            crossorigin: 'anonymous',
            href: `${normalizedBase}content/en/index.json`,
          },
          injectTo: 'head',
        },
      ];

      if (previewFile) {
        tags.push(
          {
            tag: 'link',
            attrs: {
              rel: 'preload',
              as: 'fetch',
              crossorigin: 'anonymous',
              fetchpriority: 'high',
              href: `${normalizedBase}models/${previewFile}`,
            },
            injectTo: 'head',
          },
          {
            tag: 'meta',
            attrs: {
              name: 'atlas-preview',
              content: `${normalizedBase}models/${previewFile}`,
            },
            injectTo: 'head',
          },
        );
      }

      if (skeletalFile) {
        tags.push({
          tag: 'meta',
          attrs: {
            name: 'atlas-skeletal',
            content: `${normalizedBase}models/${skeletalFile}`,
          },
          injectTo: 'head',
        });
      }

      tags.push({
        tag: 'meta',
        attrs: {
          name: 'atlas-build',
          content: process.env.VITE_BUILD_ID ?? 'dev',
        },
        injectTo: 'head',
      });

      return tags;
    },
  };
}

const appBase = process.env.ATLAS_BASE_PATH ?? '/';
const normalizedAppBase = appBase.endsWith('/') ? appBase : `${appBase}/`;

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    copyContentPlugin(),
    content404Plugin(),
    preloadAssetsPlugin(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'Anatomy Atlas',
        short_name: 'Atlas',
        description:
          'Interactive open-source 3D human anatomy atlas in your browser.',
        start_url: normalizedAppBase,
        scope: normalizedAppBase,
        display: 'standalone',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,wasm}'],
        globIgnores: ['models/**', 'content/**'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: /\/models\/.*\.(glb|json)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'atlas-models',
              matchOptions: {
                ignoreVary: true,
              },
              expiration: {
                maxEntries: 32,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\/content\/.*\.json$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'atlas-content',
              matchOptions: {
                ignoreVary: true,
              },
              expiration: {
                maxEntries: 64,
                maxAgeSeconds: 14 * 24 * 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: process.env.E2E_SW === '1',
        type: 'module',
      },
    }),
  ],
  base: appBase,
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'three',
              test: /[\\/]node_modules[\\/]three[\\/]/,
              priority: 3,
            },
            {
              name: 'r3f',
              test: /[\\/]node_modules[\\/](@react-three|camera-controls|three-mesh-bvh|its-fine|suspend-react|zustand)[\\/]/,
              priority: 2,
            },
            {
              name: 'react',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler|react-redux|@reduxjs|redux|immer|reselect)[\\/]/,
              priority: 2,
            },
          ],
        },
      },
    },
  },
});
