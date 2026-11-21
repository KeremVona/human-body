import { createHash } from 'node:crypto';
import {
  getBounds,
  NodeIO,
  type Mesh,
  type Primitive,
} from '@gltf-transform/core';
import {
  ALL_EXTENSIONS,
  EXTMeshoptCompression,
} from '@gltf-transform/extensions';
import {
  dedup,
  prune,
  quantize,
  simplify,
  weld,
} from '@gltf-transform/functions';
import {
  MeshoptDecoder,
  MeshoptEncoder,
  MeshoptSimplifier,
} from 'meshoptimizer';
import type { MeshId } from '../../src/data/ids';
import type { Manifest } from '../../src/data/schema';

/** Per-mesh manifest metadata excluding its parent bundle id. */
export type MeshStats = Omit<Manifest['meshes'][string], 'bundle'>;

/** Classifies a mesh by its bounding-sphere radius relative to full body height. */
export function sizeClassFor(
  radius: number,
  bodyHeight: number,
): 'tiny' | 'small' | 'medium' | 'large' {
  const ratio = bodyHeight > 0 ? radius / bodyHeight : 0;
  if (ratio < 0.005) return 'tiny';
  if (ratio < 0.02) return 'small';
  if (ratio < 0.08) return 'medium';
  return 'large';
}

/** Computes the content-hashed GLB filename `<bundleId>.<sha256[0..8]>.glb`. */
export function bundleFileName(id: string, glb: Uint8Array): string {
  const hash = createHash('sha256').update(glb).digest('hex').slice(0, 8);
  return `${id}.${hash}.glb`;
}

function primitiveTriangles(prim: Primitive): number {
  const indices = prim.getIndices();
  if (indices) return Math.floor(indices.getCount() / 3);
  const pos = prim.getAttribute('POSITION');
  return pos ? Math.floor(pos.getCount() / 3) : 0;
}

function meshTriangles(mesh: Mesh): number {
  return mesh
    .listPrimitives()
    .reduce((sum, prim) => sum + primitiveTriangles(prim), 0);
}

/** Optimizes a raw GLB with dedup/weld/(simplify)/quantize/Meshopt and measures mesh stats. */
export async function optimizeBundle(
  glb: Uint8Array,
  opts: { ratio: number; error: number },
  bodyHeight?: number,
): Promise<{
  glb: Uint8Array;
  meshes: Record<MeshId, MeshStats>;
  height: number;
}> {
  await Promise.all([
    MeshoptEncoder.ready,
    MeshoptDecoder.ready,
    MeshoptSimplifier.ready,
  ]);

  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'meshopt.decoder': MeshoptDecoder,
      'meshopt.encoder': MeshoptEncoder,
    });

  const doc = await io.readBinary(glb);

  const preTransforms = [dedup(), weld()];
  if (opts.ratio !== 1) {
    preTransforms.push(
      simplify({
        simplifier: MeshoptSimplifier,
        ratio: opts.ratio,
        error: opts.error,
      }),
    );
  }
  await doc.transform(...preTransforms);

  const measured: Array<{
    name: MeshId;
    bounds: MeshStats['bounds'];
    triangles: number;
  }> = [];
  let minY = Infinity;
  let maxY = -Infinity;

  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const bounds = getBounds(node);
    const name = node.getName();
    if (!name) continue;
    minY = Math.min(minY, bounds.min[1]);
    maxY = Math.max(maxY, bounds.max[1]);
    measured.push({
      name,
      bounds: {
        min: [bounds.min[0], bounds.min[1], bounds.min[2]],
        max: [bounds.max[0], bounds.max[1], bounds.max[2]],
      },
      triangles: meshTriangles(mesh),
    });
  }

  const extentY = Number.isFinite(minY) && maxY > minY ? maxY - minY : 1;
  const resolvedHeight = bodyHeight ?? extentY;

  const meshes: Record<MeshId, MeshStats> = {};
  for (const entry of measured) {
    const dx = entry.bounds.max[0] - entry.bounds.min[0];
    const dy = entry.bounds.max[1] - entry.bounds.min[1];
    const dz = entry.bounds.max[2] - entry.bounds.min[2];
    const radius = 0.5 * Math.hypot(dx, dy, dz);
    meshes[entry.name] = {
      bounds: entry.bounds,
      triangles: entry.triangles,
      sizeClass: sizeClassFor(radius, resolvedHeight),
    };
  }

  await doc.transform(quantize());
  doc
    .createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({
      method: EXTMeshoptCompression.EncoderMethod.QUANTIZE,
    });
  await doc.transform(prune());

  const outGlb = await io.writeBinary(doc);
  return { glb: outGlb, meshes, height: resolvedHeight };
}
