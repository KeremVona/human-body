import { Document, getBounds, NodeIO } from '@gltf-transform/core';
import {
  ALL_EXTENSIONS,
  EXTMeshoptCompression,
} from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { expect, it } from 'vitest';
import { buildPreview } from './preview';

async function makeMultiBoxGlb(
  boxes: Array<{ name: string; center: [number, number, number]; size: number }>,
): Promise<Uint8Array> {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene();

  for (const box of boxes) {
    const h = box.size / 2;
    const [cx, cy, cz] = box.center;
    const positions = new Float32Array([
      cx - h, cy - h, cz - h,
      cx + h, cy - h, cz - h,
      cx + h, cy + h, cz - h,
      cx - h, cy + h, cz - h,
      cx - h, cy - h, cz + h,
      cx + h, cy - h, cz + h,
      cx + h, cy + h, cz + h,
      cx - h, cy + h, cz + h,
    ]);
    const indices = new Uint16Array([
      0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7,
      0, 1, 5, 0, 5, 4, 2, 3, 7, 2, 7, 6,
      0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5,
    ]);
    const posAcc = doc
      .createAccessor()
      .setType('VEC3')
      .setArray(positions)
      .setBuffer(buffer);
    const idxAcc = doc
      .createAccessor()
      .setType('SCALAR')
      .setArray(indices)
      .setBuffer(buffer);
    const prim = doc
      .createPrimitive()
      .setAttribute('POSITION', posAcc)
      .setIndices(idxAcc);
    const mesh = doc.createMesh(box.name).addPrimitive(prim);
    const node = doc.createNode(box.name).setMesh(mesh);
    scene.addChild(node);
  }

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  return io.writeBinary(doc);
}

async function makeDenseSphereGlb(latBands = 72, lonBands = 72): Promise<Uint8Array> {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene();

  const positions: number[] = [];
  const indices: number[] = [];
  for (let lat = 0; lat <= latBands; lat += 1) {
    const theta = (lat * Math.PI) / latBands;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    for (let lon = 0; lon <= lonBands; lon += 1) {
      const phi = (lon * 2 * Math.PI) / lonBands;
      positions.push(
        0.5 * Math.cos(phi) * sinTheta,
        0.5 * cosTheta,
        0.5 * Math.sin(phi) * sinTheta,
      );
    }
  }
  for (let lat = 0; lat < latBands; lat += 1) {
    for (let lon = 0; lon < lonBands; lon += 1) {
      const a = lat * (lonBands + 1) + lon;
      const b = a + lonBands + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const posAcc = doc
    .createAccessor()
    .setType('VEC3')
    .setArray(new Float32Array(positions))
    .setBuffer(buffer);
  const idxAcc = doc
    .createAccessor()
    .setType('SCALAR')
    .setArray(new Uint16Array(indices))
    .setBuffer(buffer);
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', posAcc)
    .setIndices(idxAcc);
  const mesh = doc.createMesh('dense-skull').addPrimitive(prim);
  scene.addChild(doc.createNode('dense-skull').setMesh(mesh));

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  return io.writeBinary(doc);
}

async function readPreviewDoc(glb: Uint8Array): Promise<Document> {
  await MeshoptDecoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  return io.readBinary(glb);
}

it('joins meshes into one named mesh with EXT_meshopt_compression and matching bounds', async () => {
  const raw = await makeMultiBoxGlb([
    { name: 'femur--l', center: [0.1, -0.4, 0], size: 0.4 },
    { name: 'femur--r', center: [-0.1, -0.4, 0], size: 0.4 },
    { name: 'skull', center: [0, 0.7, 0.05], size: 0.3 },
  ]);

  const { glb, bounds } = await buildPreview(raw, { ratio: 1, error: 0.01 });
  const doc = await readPreviewDoc(glb);

  const meshNodes = doc
    .getRoot()
    .listNodes()
    .filter((n) => Boolean(n.getMesh()));
  expect(meshNodes).toHaveLength(1);
  expect(meshNodes[0].getName()).toBe('skeletal-preview');
  expect(doc.getRoot().listMeshes()).toHaveLength(1);

  const usedExt = doc
    .getRoot()
    .listExtensionsUsed()
    .map((e) => e.extensionName);
  expect(usedExt).toContain(EXTMeshoptCompression.EXTENSION_NAME);

  const docBounds = getBounds(doc.getRoot().listScenes()[0]);
  const expectedMin = [-0.3, -0.6, -0.2];
  const expectedMax = [0.3, 0.85, 0.2];
  for (let i = 0; i < 3; i += 1) {
    expect(bounds.min[i]).toBeCloseTo(expectedMin[i], 3);
    expect(bounds.max[i]).toBeCloseTo(expectedMax[i], 3);
    expect(docBounds.min[i]).toBeCloseTo(expectedMin[i], 2);
    expect(docBounds.max[i]).toBeCloseTo(expectedMax[i], 2);
  }
});

it('simplifies dense geometry cleanly at low ratio', async () => {
  const raw = await makeDenseSphereGlb(72, 72); // ~10,368 triangles
  const { triangles } = await buildPreview(raw, { ratio: 0.1, error: 0.01 });
  expect(triangles).toBeLessThanOrEqual(1_500);
  expect(triangles).toBeGreaterThan(0);
});
