import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { checkContent } from '../src/data/checkContent';

const root = path.resolve(import.meta.dirname, '..');

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

const report = checkContent({
  manifest: readJson(path.join(root, 'public', 'models', 'manifest.json')),
  taxonomy: readJson(path.join(root, 'content', 'taxonomy.json')),
  index: readJson(path.join(root, 'content', 'en', 'index.json')),
  structureFiles: loadStructureFiles(
    path.join(root, 'content', 'en', 'structures'),
  ),
});

for (const warning of report.warnings) {
  console.warn(`WARN  ${warning}`);
}
for (const error of report.errors) {
  console.error(`ERROR ${error}`);
}

console.log(
  `check:content: ${report.errors.length} errors, ${report.warnings.length} warnings`,
);

if (report.errors.length > 0) {
  process.exitCode = 1;
}
