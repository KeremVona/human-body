import type { Manifest, Vec3 } from '../../src/data/schema';
import type { PipelineConfig } from './config';

function centerOf(bounds: { min: Vec3; max: Vec3 }): Vec3 {
  return [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ];
}

/** Verifies bundle budgets, disk file existence/hashes, body height, and orientation landmarks. */
export function verifyManifest(
  manifest: Manifest,
  config: PipelineConfig,
  files: Record<string, { bytes: number; sha256: string } | undefined>,
): string[] {
  const problems: string[] = [];

  const expectedFiles = new Set<string>();
  let totalBytes = 0;
  for (const bundle of manifest.bundles) {
    expectedFiles.add(bundle.file);
    totalBytes += bundle.bytes;
    const budget =
      config.budgets.perBundleBytes[bundle.id] ??
      config.budgets.defaultBundleBytes;
    if (bundle.bytes > budget) {
      problems.push(
        `bundle "${bundle.id}" is ${bundle.bytes} bytes, over its ${budget}-byte budget`,
      );
    }

    const disk = files[bundle.file];
    if (!disk) {
      problems.push(`bundle "${bundle.id}": file ${bundle.file} not found`);
      continue;
    }
    if (disk.sha256 !== bundle.sha256) {
      problems.push(`bundle "${bundle.id}": file hash does not match manifest`);
    }
    if (disk.bytes !== bundle.bytes) {
      problems.push(
        `bundle "${bundle.id}": file size ${disk.bytes} does not match manifest (${bundle.bytes})`,
      );
    }
  }

  for (const file of Object.keys(files).sort()) {
    if (file.endsWith('.glb') && !expectedFiles.has(file)) {
      problems.push(
        `stray unreferenced glb file "${file}" in models directory`,
      );
    }
  }

  if (totalBytes > config.budgets.totalBytes) {
    problems.push(
      `total bundle size is ${totalBytes} bytes, over its ${config.budgets.totalBytes}-byte budget`,
    );
  }

  const originMeshes = Object.values(manifest.meshes).filter(
    (m) => m.bundle === config.originBundle,
  );
  if (originMeshes.length === 0) {
    problems.push(
      `orientation: origin bundle "${config.originBundle}" has no meshes`,
    );
  } else {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const mesh of originMeshes) {
      minY = Math.min(minY, mesh.bounds.min[1]);
      maxY = Math.max(maxY, mesh.bounds.max[1]);
    }
    const height = maxY - minY;
    if (height < 1.4 || height > 2.2) {
      problems.push(
        `body height ${height.toFixed(2)} is outside 1.4–2.2 (check orientation.scale)`,
      );
    }
  }

  for (const [highId, lowId] of config.orientation.checks.above) {
    const high = manifest.meshes[highId];
    const low = manifest.meshes[lowId];
    if (!high) {
      problems.push(`orientation: missing mesh "${highId}"`);
      continue;
    }
    if (!low) {
      problems.push(`orientation: missing mesh "${lowId}"`);
      continue;
    }
    if (centerOf(high.bounds)[1] <= centerOf(low.bounds)[1]) {
      problems.push(`orientation: "${highId}" should be above "${lowId}"`);
    }
  }

  for (const [frontId, backId] of config.orientation.checks.anterior) {
    const front = manifest.meshes[frontId];
    const back = manifest.meshes[backId];
    if (!front) {
      problems.push(`orientation: missing mesh "${frontId}"`);
      continue;
    }
    if (!back) {
      problems.push(`orientation: missing mesh "${backId}"`);
      continue;
    }
    if (centerOf(front.bounds)[2] <= centerOf(back.bounds)[2]) {
      problems.push(
        `orientation: "${frontId}" should be anterior to "${backId}"`,
      );
    }
  }

  for (const id of config.orientation.checks.leftSide) {
    const mesh = manifest.meshes[id];
    if (!mesh) {
      problems.push(`orientation: missing mesh "${id}"`);
      continue;
    }
    if (centerOf(mesh.bounds)[0] <= 0) {
      problems.push(`orientation: "${id}" should be on +X (patient left)`);
    }
  }

  return problems;
}
