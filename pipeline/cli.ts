import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { runBlender } from './src/blender';
import { PipelineConfigSchema, type PipelineConfig } from './src/config';
import { updateNameMap, type NameMap } from './src/nameMap';
import { resolvePlan } from './src/resolvePlan';
import { selectObjects } from './src/select';
import type { Inventory } from './src/types';

const root = path.resolve(import.meta.dirname, '..');

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function loadConfig(): PipelineConfig {
  return PipelineConfigSchema.parse(
    readJson(path.join(root, 'pipeline', 'config.json')),
  );
}

function loadInventory(): Inventory {
  return readJson<Inventory>(
    path.join(root, 'pipeline', 'out', 'inventory.json'),
  );
}

function loadNameMap(): NameMap {
  const nameMapPath = path.join(root, 'pipeline', 'name-map.json');
  return existsSync(nameMapPath) ? readJson<NameMap>(nameMapPath) : {};
}

async function runInventory(): Promise<void> {
  const outDir = path.join(root, 'pipeline', 'out');
  mkdirSync(outDir, { recursive: true });
  await runBlender({
    blend: path.join(root, 'pipeline', 'source', 'Z-Anatomy.blend'),
    script: path.join(root, 'pipeline', 'blender', 'inventory.py'),
    scriptArgs: ['--out', path.join(outDir, 'inventory.json')],
  });
}

function runNamemap(): void {
  const config = loadConfig();
  const inventory = loadInventory();
  const { selected, unmatched } = selectObjects(config, inventory.objects);

  const nameMapPath = path.join(root, 'pipeline', 'name-map.json');
  const existing = loadNameMap();

  const sourceNames = selected.map((s) => s.object.name);
  const { map, added, needsReview } = updateNameMap(existing, sourceNames);

  writeFileSync(nameMapPath, `${JSON.stringify(map, null, 2)}\n`, 'utf8');

  console.log(
    `Selected ${selected.length} objects (${unmatched} unmatched MESH objects).`,
  );
  console.log(`Added (${added.length}):`, added);
  console.log(`Needs review (${needsReview.length}):`, needsReview);
}

async function runBuild(): Promise<void> {
  const config = loadConfig();
  const inventory = loadInventory();
  const nameMap = loadNameMap();

  const { plan, problems } = resolvePlan(config, inventory, nameMap);
  if (problems.length > 0) {
    for (const problem of problems) {
      console.error(`ERROR ${problem}`);
    }
    process.exitCode = 1;
    return;
  }

  const outDir = path.join(root, 'pipeline', 'out');
  const rawDir = path.join(outDir, 'raw');
  mkdirSync(rawDir, { recursive: true });

  const planPath = path.join(outDir, 'export-plan.json');
  writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');

  await runBlender({
    blend: path.join(root, config.source.file),
    script: path.join(root, 'pipeline', 'blender', 'export.py'),
    scriptArgs: ['--plan', planPath, '--out', rawDir],
  });
}

async function main(): Promise<void> {
  const subcommand = process.argv[2];
  switch (subcommand) {
    case 'inventory':
      await runInventory();
      break;
    case 'namemap':
      runNamemap();
      break;
    case 'build':
      await runBuild();
      break;
    default:
      console.error(
        `Unknown or missing subcommand: ${subcommand ?? '(none)'}. Expected: inventory | namemap | build`,
      );
      process.exitCode = 1;
  }
}

await main();
