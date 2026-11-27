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

  if (manifest.preview) {
    const preview = manifest.preview;
    expectedFiles.add(preview.file);
    if (preview.bytes > config.preview.maxBytes) {
      problems.push(
        `preview is ${preview.bytes} bytes, over its ${config.preview.maxBytes}-byte budget`,
      );
    }

    const disk = files[preview.file];
    if (!disk) {
      problems.push(`preview: file ${preview.file} not found`);
    } else {
      if (disk.sha256 !== preview.sha256) {
        problems.push('preview: file hash does not match manifest');
      }
      if (disk.bytes !== preview.bytes) {
        problems.push(
          `preview: file size ${disk.bytes} does not match manifest (${preview.bytes})`,
        );
      }
    }

    const sourceMeshes = Object.values(manifest.meshes).filter(
      (m) => m.bundle === config.preview.from,
    );
    if (sourceMeshes.length > 0) {
      const unionMin: Vec3 = [Infinity, Infinity, Infinity];
      const unionMax: Vec3 = [-Infinity, -Infinity, -Infinity];
      for (const m of sourceMeshes) {
        for (let i = 0; i < 3; i += 1) {
          unionMin[i] = Math.min(unionMin[i], m.bounds.min[i]);
          unionMax[i] = Math.max(unionMax[i], m.bounds.max[i]);
        }
      }
      let maxDiff = 0;
      for (let i = 0; i < 3; i += 1) {
        maxDiff = Math.max(
          maxDiff,
          Math.abs(preview.bounds.min[i] - unionMin[i]),
          Math.abs(preview.bounds.max[i] - unionMax[i]),
        );
      }
      if (maxDiff > 0.01) {
        problems.push(
          `preview bounds differ from ${config.preview.from} bounds by ${maxDiff.toFixed(3)} m`,
        );
      }
    }
  }

  if (manifest.centerlines) {
    const cl = manifest.centerlines;
    expectedFiles.add(cl.file);
    if (cl.bytes > 60_000) {
      problems.push(
        `centerlines is ${cl.bytes} bytes, over its 60,000-byte budget`,
      );
    }
    const disk = files[cl.file];
    if (!disk) {
      problems.push(`centerlines: file ${cl.file} not found`);
    } else {
      if (disk.sha256 !== cl.sha256) {
        problems.push('centerlines: file hash does not match manifest');
      }
      if (disk.bytes !== cl.bytes) {
        problems.push(
          `centerlines: file size ${disk.bytes} does not match manifest (${cl.bytes})`,
        );
      }
    }
  }

  for (const file of Object.keys(files).sort()) {
    if (file.endsWith('.glb') && !expectedFiles.has(file)) {
      problems.push(
        `stray unreferenced glb file "${file}" in models directory`,
      );
    }
    if (
      /^centerlines\.[0-9a-f]{8}\.json$/.test(file) &&
      !expectedFiles.has(file)
    ) {
      problems.push(
        `stray unreferenced centerlines file "${file}" in models directory`,
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
