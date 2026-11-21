import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { cpSync, existsSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin, type ResolvedConfig } from 'vite';

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

export default defineConfig({
  plugins: [react(), tailwindcss(), copyContentPlugin()],
  base: process.env.ATLAS_BASE_PATH ?? '/',
});
