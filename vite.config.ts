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
      if (existsSync(manifestPath)) {
        try {
          const parsed = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
            bundles?: Array<{ id?: string; file?: string }>;
          };
          skeletalFile = parsed.bundles?.find((b) => b.id === 'skeletal')?.file;
        } catch {
          skeletalFile = undefined;
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

      return tags;
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    copyContentPlugin(),
    content404Plugin(),
    preloadAssetsPlugin(),
  ],
  base: process.env.ATLAS_BASE_PATH ?? '/',
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
