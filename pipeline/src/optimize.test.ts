import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { bundleFileName, optimizeBundle, sizeClassFor } from './optimize';

async function makeGlb(boxes: Array<[string, number]>): Promise<Uint8Array> {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene();

  for (const [name, size] of boxes) {
    const h = size / 2;
    const positions = new Float32Array([
      -h,
      -h,
      -h,
      h,
      -h,
      -h,
      h,
      h,
      -h,
      -h,
      h,
      -h,
      -h,
      -h,
      h,
      h,
      -h,
      h,
      h,
      h,
      h,
      -h,
      h,
      h,
    ]);
    const indices = new Uint16Array([
      0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 2, 3, 7, 2, 7, 6, 0,
      4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5,
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
    const mesh = doc.createMesh(name).addPrimitive(prim);
    const node = doc.createNode(name).setMesh(mesh);
    scene.addChild(node);
  }

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  return io.writeBinary(doc);
}

async function readWithMeshopt(glb: Uint8Array): Promise<Document> {
  await MeshoptDecoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  return io.readBinary(glb);
}

it('keeps node names and applies meshopt compression', async () => {
  const { glb } = await optimizeBundle(
    await makeGlb([
      ['femur--l', 0.5],
      ['femur--r', 0.5],
    ]),
    { ratio: 1, error: 0.001 },
  );
  const doc = await readWithMeshopt(glb);
  expect(
    doc
      .getRoot()
      .listNodes()
      .map((n) => n.getName())
      .sort(),
  ).toEqual(['femur--l', 'femur--r']);
  expect(
    doc
      .getRoot()
      .listExtensionsUsed()
      .map((e) => e.extensionName),
  ).toContain('EXT_meshopt_compression');
});

it('measures bounds, triangles and size class before quantization', async () => {
  const { meshes } = await optimizeBundle(
    await makeGlb([
      ['skull', 0.5],
      ['stapes', 0.005],
    ]),
    { ratio: 1, error: 0.001 },
    1.7,
  );
  expect(meshes['skull']).toMatchObject({ triangles: 12, sizeClass: 'large' });
  expect(meshes['skull'].bounds.max[0]).toBeCloseTo(0.25, 3);
  expect(meshes['stapes'].sizeClass).toBe('tiny');
});

it('sizeClassFor uses the pinned thresholds', () => {
  expect([0.008, 0.03, 0.1, 0.2].map((r) => sizeClassFor(r, 1.7))).toEqual([
    'tiny',
    'small',
    'medium',
    'large',
  ]);
});

it('names files by content hash', () => {
  const bytes = new TextEncoder().encode('x');
  expect(bundleFileName('skeletal', bytes)).toBe('skeletal.2d711642.glb');
});
