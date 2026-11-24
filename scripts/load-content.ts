import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function loadStructureFiles(structuresDir: string): Record<string, unknown> {
  if (!existsSync(structuresDir)) return {};
  const files = readdirSync(structuresDir)
    .filter((name) => name.endsWith('.json'))
    .sort();
  const result: Record<string, unknown> = {};
  for (const name of files) {
    result[`structures/${name}`] = readJson(path.join(structuresDir, name));
  }
  return result;
}

/** Loads manifest, taxonomy, English index, structure JSON files, and optional motions file from disk. */
export function loadContentInput(root: string): {
  manifest: unknown;
  taxonomy: unknown;
  index: unknown;
  structureFiles: Record<string, unknown>;
  motions?: unknown;
} {
  const motionsPath = path.join(root, 'content', 'motions.json');
  return {
    manifest: readJson(path.join(root, 'public', 'models', 'manifest.json')),
    taxonomy: readJson(path.join(root, 'content', 'taxonomy.json')),
    index: readJson(path.join(root, 'content', 'en', 'index.json')),
    structureFiles: loadStructureFiles(
      path.join(root, 'content', 'en', 'structures'),
    ),
    motions: existsSync(motionsPath) ? readJson(motionsPath) : undefined,
  };
}
