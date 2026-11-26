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
  flatten,
  join,
  normals,
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
import type { Vec3 } from '../../src/data/schema';

function primitiveTriangles(prim: Primitive): number {
  const indices = prim.getIndices();
  if (indices) return Math.floor(indices.getCount() / 3);
  const pos = prim.getAttribute('POSITION');
  return pos ? Math.floor(pos.getCount() / 3) : 0;
}

function countMeshTriangles(mesh: Mesh): number {
  return mesh
    .listPrimitives()
    .reduce((sum, prim) => sum + primitiveTriangles(prim), 0);
}

/** Builds a merged, simplified Meshopt preview GLB (`skeletal-preview`) from raw exported geometry. */
export async function buildPreview(
  rawGlb: Uint8Array,
  opts: { ratio: number; error: number },
): Promise<{
  glb: Uint8Array;
  bounds: { min: Vec3; max: Vec3 };
  triangles: number;
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

  const doc = await io.readBinary(rawGlb);

  // Bake all node transforms first, then normalize every primitive to POSITION-only on one material
  // so glTF-Transform join() merges every bone into a single mesh without attribute mismatches.
  await doc.transform(flatten());

  const sharedMaterial = doc.createMaterial('preview-material');
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      for (const semantic of prim.listSemantics()) {
        if (semantic !== 'POSITION') {
          prim.setAttribute(semantic, null);
        }
      }
      prim.setMaterial(sharedMaterial);
    }
  }

  // Place all mesh nodes under one shared parent node so join() merges them into a single node.
  const scene =
    doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  if (scene) {
    const group = doc.createNode('skeletal-preview');
    const meshNodes = scene.listChildren().filter((n) => Boolean(n.getMesh()));
    for (const child of meshNodes) {
      scene.removeChild(child);
      group.addChild(child);
    }
    scene.addChild(group);
  }

  await doc.transform(join({ keepNamed: false }), weld());

  if (opts.ratio !== 1) {
    await doc.transform(
      simplify({
        simplifier: MeshoptSimplifier,
        ratio: opts.ratio,
        error: opts.error,
      }),
    );
  }

  // Strip any existing normals, recompute smooth normals, quantize, and apply Meshopt compression.
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      if (prim.getAttribute('NORMAL')) {
        prim.setAttribute('NORMAL', null);
      }
    }
  }
  await doc.transform(normals({ overwrite: true }));

  const targetScene =
    doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const rawBounds = targetScene
    ? getBounds(targetScene)
    : { min: [0, 0, 0] as Vec3, max: [0, 0, 0] as Vec3 };
  const bounds = {
    min: [rawBounds.min[0], rawBounds.min[1], rawBounds.min[2]] as Vec3,
    max: [rawBounds.max[0], rawBounds.max[1], rawBounds.max[2]] as Vec3,
  };

  for (const node of doc.getRoot().listNodes()) {
    if (node.getMesh()) {
      node.setName('skeletal-preview');
    }
  }

  const triangles = doc
    .getRoot()
    .listMeshes()
    .reduce((sum, mesh) => sum + countMeshTriangles(mesh), 0);

  await doc.transform(quantize());
  doc
    .createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({
      method: EXTMeshoptCompression.EncoderMethod.QUANTIZE,
    });
  await doc.transform(prune());

  const glb = await io.writeBinary(doc);
  return { glb, bounds, triangles };
}
