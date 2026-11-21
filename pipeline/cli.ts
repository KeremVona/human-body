import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { checkContent } from '../src/data/checkContent';
import {
  IndexFileSchema,
  ManifestSchema,
  type IndexFile,
} from '../src/data/schema';
import { runBlender } from './src/blender';
import { PipelineConfigSchema, type PipelineConfig } from './src/config';
import { updateNameMap, type NameMap } from './src/nameMap';
import { optimizeBundle, type MeshStats } from './src/optimize';
import { writeOutputs } from './src/outputs';
import { resolvePlan } from './src/resolvePlan';
import { scaffoldIndex } from './src/scaffold';
import { selectObjects } from './src/select';
import type { Inventory } from './src/types';
import { verifyManifest } from './src/verify';

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

function loadStructureFiles(structuresDir: string): Record<string, unknown> {
  if (!existsSync(structuresDir)) return {};
  const result: Record<string, unknown> = {};
  for (const name of readdirSync(structuresDir)
    .filter((n) => n.endsWith('.json'))
    .sort()) {
    result[`structures/${name}`] = readJson(path.join(structuresDir, name));
  }
  return result;
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

function runVerify(): boolean {
  const config = loadConfig();
  const modelsDir = path.join(root, 'public', 'models');
  const rawManifest = readJson<unknown>(path.join(modelsDir, 'manifest.json'));
  const rawTaxonomy = readJson<unknown>(
    path.join(root, 'content', 'taxonomy.json'),
  );
  const rawIndex = readJson<unknown>(
    path.join(root, 'content', 'en', 'index.json'),
  );
  const structureFiles = loadStructureFiles(
    path.join(root, 'content', 'en', 'structures'),
  );

  const report = checkContent({
    manifest: rawManifest,
    taxonomy: rawTaxonomy,
    index: rawIndex,
    structureFiles,
  });

  for (const warning of report.warnings) {
    console.warn(`WARN  ${warning}`);
  }

  const problems = [...report.errors];
  const parsedManifest = ManifestSchema.safeParse(rawManifest);
  if (parsedManifest.success) {
    const files: Record<string, { bytes: number; sha256: string } | undefined> =
      {};
    for (const bundle of parsedManifest.data.bundles) {
      const filePath = path.join(modelsDir, bundle.file);
      if (existsSync(filePath)) {
        const buf = readFileSync(filePath);
        files[bundle.file] = {
          bytes: statSync(filePath).size,
          sha256: createHash('sha256').update(buf).digest('hex'),
        };
      }
    }
    problems.push(...verifyManifest(parsedManifest.data, config, files));
  }

  for (const problem of problems) {
    console.error(`ERROR ${problem}`);
  }

  console.log(
    `assets:verify: ${problems.length} errors, ${report.warnings.length} warnings`,
  );

  if (problems.length > 0) {
    process.exitCode = 1;
    return false;
  }
  return true;
}

async function runBuild(): Promise<void> {
  const config = loadConfig();
  const inventory = loadInventory();
  const nameMap = loadNameMap();

  const { plan, stubs, problems } = resolvePlan(config, inventory, nameMap);
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

  const nonEmptyBundles = plan.bundles.filter((b) => b.objects.length > 0);
  const orderedBundles = [
    ...nonEmptyBundles.filter((b) => b.id === config.originBundle),
    ...nonEmptyBundles.filter((b) => b.id !== config.originBundle),
  ];

  const optimized: Array<{
    id: string;
    glb: Uint8Array;
    meshes: Record<string, MeshStats>;
  }> = [];
  let bodyHeight: number | undefined;

  for (const bundle of orderedBundles) {
    const rawBytes = new Uint8Array(
      readFileSync(path.join(rawDir, `${bundle.id}.glb`)),
    );
    const result = await optimizeBundle(rawBytes, config.simplify, bodyHeight);
    if (bundle.id === config.originBundle) {
      bodyHeight = result.height;
    }
    optimized.push({
      id: bundle.id,
      glb: result.glb,
      meshes: result.meshes,
    });
  }

  const modelsDir = path.join(root, 'public', 'models');
  const manifest = writeOutputs(modelsDir, optimized, {
    name: config.source.name,
    version: config.source.version,
    license: config.source.license,
  });
  for (const bundle of manifest.bundles) {
    console.log(
      `Wrote ${bundle.file}: ${bundle.bytes} bytes, ${bundle.meshIds.length} meshes`,
    );
  }

  const indexPath = path.join(root, 'content', 'en', 'index.json');
  const existingIndex: IndexFile = IndexFileSchema.parse(readJson(indexPath));
  const nextIndex = scaffoldIndex(existingIndex, stubs);
  writeFileSync(indexPath, `${JSON.stringify(nextIndex, null, 2)}\n`, 'utf8');
  console.log(
    `Scaffolded content/en/index.json: ${nextIndex.structures.length} structures`,
  );

  runVerify();
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
    case 'verify':
      runVerify();
      break;
    default:
      console.error(
        `Unknown or missing subcommand: ${subcommand ?? '(none)'}. Expected: inventory | namemap | build | verify`,
      );
      process.exitCode = 1;
  }
}

await main();
