import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { MeshId } from '../../src/data/ids';
import type { Manifest, Vec3 } from '../../src/data/schema';
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
  preview?: {
    glb: Uint8Array;
    bounds: { min: Vec3; max: Vec3 };
  },
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

  let manifestPreview: Manifest['preview'];
  if (preview) {
    const file = bundleFileName('skeletal-preview', preview.glb);
    const sha256 = createHash('sha256').update(preview.glb).digest('hex');
    writeFileSync(path.join(dir, file), preview.glb);
    writtenFiles.add(file);
    manifestPreview = {
      file,
      bytes: preview.glb.byteLength,
      sha256,
      bounds: preview.bounds,
    };
  }

  const manifest: Manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source,
    bundles: manifestBundles,
    ...(manifestPreview ? { preview: manifestPreview } : {}),
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
