import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { runBlender } from './src/blender';

const root = path.resolve(import.meta.dirname, '..');

async function runInventory(): Promise<void> {
  const outDir = path.join(root, 'pipeline', 'out');
  mkdirSync(outDir, { recursive: true });
  await runBlender({
    blend: path.join(root, 'pipeline', 'source', 'Z-Anatomy.blend'),
    script: path.join(root, 'pipeline', 'blender', 'inventory.py'),
    scriptArgs: ['--out', path.join(outDir, 'inventory.json')],
  });
}

async function main(): Promise<void> {
  const subcommand = process.argv[2];
  switch (subcommand) {
    case 'inventory':
      await runInventory();
      break;
    default:
      console.error(
        `Unknown or missing subcommand: ${subcommand ?? '(none)'}. Expected: inventory`,
      );
      process.exitCode = 1;
  }
}

await main();
