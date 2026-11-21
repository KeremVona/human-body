import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { cpSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  defineConfig,
  type Connect,
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

export default defineConfig({
  plugins: [react(), tailwindcss(), copyContentPlugin(), content404Plugin()],
  base: process.env.ATLAS_BASE_PATH ?? '/',
});
