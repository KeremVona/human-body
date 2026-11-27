import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { LocaleContentInput } from '../src/data/checkContent';

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

function loadLocaleDirs(root: string): Record<string, LocaleContentInput> {
  const contentDir = path.join(root, 'content');
  const locales: Record<string, LocaleContentInput> = {};
  for (const entry of readdirSync(contentDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'en') continue;
    const locDir = path.join(contentDir, entry.name);
    const indexPath = path.join(locDir, 'index.json');
    const structuresDir = path.join(locDir, 'structures');
    if (!existsSync(indexPath) && !existsSync(structuresDir)) continue;
    locales[entry.name] = {
      index: existsSync(indexPath)
        ? readJson(indexPath)
        : { locale: entry.name, structures: [] },
      structureFiles: loadStructureFiles(structuresDir),
    };
  }
  return locales;
}

function loadTextsByFile(
  root: string,
  fileName: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const contentDir = path.join(root, 'content');
  for (const entry of readdirSync(contentDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const filePath = path.join(contentDir, entry.name, fileName);
    if (existsSync(filePath)) {
      result[entry.name] = readJson(filePath);
    }
  }
  return result;
}

/** Loads manifest, taxonomy, English content, non-en locale folders, optional motions, tours, centerlines, and journeys from disk. */
export function loadContentInput(root: string): {
  manifest: unknown;
  taxonomy: unknown;
  index: unknown;
  structureFiles: Record<string, unknown>;
  motions?: unknown;
  locales?: Record<string, LocaleContentInput>;
  tours?: unknown;
  tourTexts?: Record<string, unknown>;
  centerlines?: unknown;
  journeys?: unknown;
  journeyTexts?: Record<string, unknown>;
} {
  const motionsPath = path.join(root, 'content', 'motions.json');
  const toursPath = path.join(root, 'content', 'tours.json');
  const journeysPath = path.join(root, 'content', 'journeys.json');
  const locales = loadLocaleDirs(root);
  const tourTexts = loadTextsByFile(root, 'tours.json');
  const journeyTexts = loadTextsByFile(root, 'journeys.json');
  const manifest = readJson(path.join(root, 'public', 'models', 'manifest.json'));
  const clFile = (manifest as { centerlines?: { file?: string } }).centerlines?.file;
  const centerlinesPath = clFile
    ? path.join(root, 'public', 'models', clFile)
    : null;
  return {
    manifest,
    taxonomy: readJson(path.join(root, 'content', 'taxonomy.json')),
    index: readJson(path.join(root, 'content', 'en', 'index.json')),
    structureFiles: loadStructureFiles(
      path.join(root, 'content', 'en', 'structures'),
    ),
    motions: existsSync(motionsPath) ? readJson(motionsPath) : undefined,
    locales,
    tours: existsSync(toursPath) ? readJson(toursPath) : undefined,
    tourTexts: Object.keys(tourTexts).length > 0 ? tourTexts : undefined,
    centerlines:
      centerlinesPath && existsSync(centerlinesPath)
        ? readJson(centerlinesPath)
        : undefined,
    journeys: existsSync(journeysPath) ? readJson(journeysPath) : undefined,
    journeyTexts:
      Object.keys(journeyTexts).length > 0 ? journeyTexts : undefined,
  };
}
