import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { MeshId } from '../../src/data/ids';
import type { Manifest } from '../../src/data/schema';
import { bundleFileName, type MeshStats } from './optimize';

function compareAscii(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Writes content-hashed GLBs and manifest.json to `dir`, removing stale GLB files. */
export function writeOutputs(
  dir: string,
  bundles: Array<{
    id: string;
    glb: Uint8Array;
    meshes: Record<MeshId, MeshStats>;
  }>,
  source: Manifest['source'],
): Manifest {
  mkdirSync(dir, { recursive: true });

  const manifestBundles: Manifest['bundles'] = [];
  const rawMeshes: Array<[MeshId, Manifest['meshes'][string]]> = [];
  const writtenFiles = new Set<string>();

  for (const bundle of bundles) {
    const file = bundleFileName(bundle.id, bundle.glb);
    const sha256 = createHash('sha256').update(bundle.glb).digest('hex');
    const meshIds = Object.keys(bundle.meshes).sort(compareAscii);

    writeFileSync(path.join(dir, file), bundle.glb);
    writtenFiles.add(file);

    manifestBundles.push({
      id: bundle.id,
      file,
      bytes: bundle.glb.byteLength,
      sha256,
      meshIds,
    });

    for (const meshId of meshIds) {
      rawMeshes.push([meshId, { bundle: bundle.id, ...bundle.meshes[meshId] }]);
    }
  }

  rawMeshes.sort(([a], [b]) => compareAscii(a, b));
  const meshes: Manifest['meshes'] = {};
  for (const [meshId, stats] of rawMeshes) {
    meshes[meshId] = stats;
  }

  const manifest: Manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source,
    bundles: manifestBundles,
    meshes,
  };

  writeFileSync(
    path.join(dir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );

  for (const entry of readdirSync(dir)) {
    if (entry.endsWith('.glb') && !writtenFiles.has(entry)) {
      unlinkSync(path.join(dir, entry));
    }
  }

  return manifest;
}
