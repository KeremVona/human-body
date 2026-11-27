import { readFileSync } from 'node:fs';
import path from 'node:path';
import { NodeIO, type Mesh as GltfMesh } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Vector3,
} from 'three';
import { CENTER, MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
import { describe, expect, it } from 'vitest';
import { CenterlinesFileSchema } from '../../src/data/centerlines';
import { ManifestSchema } from '../../src/data/schema';
import { buildRoute } from '../../src/features/journey/route';
import { JourneysFileSchema } from '../../src/features/journey/schema';

Mesh.prototype.raycast = acceleratedRaycast;

function buildMeshGeometry(gltfMesh: GltfMesh, worldMatrix: Float32Array | number[]): Mesh {
  const mat = new Matrix4().fromArray(worldMatrix);
  const positions: number[] = [];
  const indices: number[] = [];
  const tmp = new Vector3();

  for (const prim of gltfMesh.listPrimitives()) {
    const posAcc = prim.getAttribute('POSITION');
    if (!posAcc) continue;
    const baseVertex = positions.length / 3;
    const count = posAcc.getCount();
    const elem: [number, number, number] = [0, 0, 0];

    for (let i = 0; i < count; i += 1) {
      posAcc.getElement(i, elem);
      tmp.set(elem[0], elem[1], elem[2]).applyMatrix4(mat);
      positions.push(tmp.x, tmp.y, tmp.z);
    }

    const idxAcc = prim.getIndices();
    if (idxAcc) {
      const idxCount = idxAcc.getCount();
      for (let i = 0; i < idxCount; i += 1) {
        indices.push(baseVertex + idxAcc.getScalar(i));
      }
    } else {
      for (let i = 0; i < count; i += 1) {
        indices.push(baseVertex + i);
      }
    }
  }

  const geom = new BufferGeometry();
  geom.setAttribute(
    'position',
    new BufferAttribute(new Float32Array(positions), 3),
  );
  if (indices.length > 0) {
    geom.setIndex(indices);
  }
  const mesh = new Mesh(geom, new MeshBasicMaterial({ side: DoubleSide }));
  geom.boundsTree = new MeshBVH(geom, { strategy: CENTER, setBoundingBox: true });
  return mesh;
}

function isPointInsideMesh(
  raycaster: Raycaster,
  origin: Vector3,
  meshes: Mesh[],
): boolean {
  const posDirs = [
    new Vector3(1, 0, 0),
    new Vector3(0, 1, 0),
    new Vector3(0, 0, 1),
  ];
  const negDirs = [
    new Vector3(-1, 0, 0),
    new Vector3(0, -1, 0),
    new Vector3(0, 0, -1),
  ];

  for (const mesh of meshes) {
    let oddVotes = 0;
    let lumenAxes = 0;
    for (let axis = 0; axis < 3; axis += 1) {
      raycaster.set(origin, posDirs[axis]);
      raycaster.firstHitOnly = false;
      const posHits = raycaster.intersectObject(mesh, false);
      if (posHits.length % 2 === 1) {
        oddVotes += 1;
      }

      // Solidify-extruded tubes (esophagus, colon) have thin double walls: rays inside
      // the hollow lumen hit >=2 layers on both opposite directions within lumen radius.
      if (posHits.length >= 2 && posHits.length % 2 === 0 && posHits[0].distance < 0.05) {
        raycaster.set(origin, negDirs[axis]);
        const negHits = raycaster.intersectObject(mesh, false);
        if (negHits.length >= 2 && negHits.length % 2 === 0 && negHits[0].distance < 0.05) {
          lumenAxes += 1;
        }
      }
    }
    if (oddVotes >= 2 || lumenAxes >= 2) {
      return true;
    }
  }
  return false;
}

describe('digestion journey inside-mesh gate', () => {
  it('keeps at least 85% of every inside-checked stage route inside the target organ meshes', async () => {
    await MeshoptDecoder.ready;

    const root = path.resolve(import.meta.dirname, '..', '..');
    const modelsDir = path.join(root, 'public', 'models');
    const manifest = ManifestSchema.parse(
      JSON.parse(readFileSync(path.join(modelsDir, 'manifest.json'), 'utf8')),
    );
    expect(manifest.centerlines).toBeDefined();
    const centerlines = CenterlinesFileSchema.parse(
      JSON.parse(
        readFileSync(path.join(modelsDir, manifest.centerlines!.file), 'utf8'),
      ),
    );
    const journeys = JourneysFileSchema.parse(
      JSON.parse(readFileSync(path.join(root, 'content', 'journeys.json'), 'utf8')),
    );
    const digestion = journeys.journeys.find((j) => j.id === 'digestion')!;
    expect(digestion).toBeDefined();

    const neededMeshes = new Set<string>();
    const neededBundles = new Set<string>();
    for (const stage of digestion.stages) {
      for (const id of stage.inside ?? []) {
        neededMeshes.add(id);
        const entry = manifest.meshes[id];
        if (entry) neededBundles.add(entry.bundle);
      }
    }

    const io = new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

    const threeMeshes = new Map<string, Mesh>();
    for (const bundleId of neededBundles) {
      const bundle = manifest.bundles.find((b) => b.id === bundleId);
      if (!bundle) continue;
      const bytes = new Uint8Array(readFileSync(path.join(modelsDir, bundle.file)));
      const doc = await io.readBinary(bytes);
      for (const node of doc.getRoot().listNodes()) {
        const name = node.getName();
        if (!neededMeshes.has(name)) continue;
        const gMesh = node.getMesh();
        if (!gMesh) continue;
        threeMeshes.set(name, buildMeshGeometry(gMesh, node.getWorldMatrix()));
      }
    }

    const route = buildRoute(digestion, centerlines.lines, manifest.meshes);
    const raycaster = new Raycaster();
    const samplePt = new Vector3();

    for (let s = 0; s < digestion.stages.length; s += 1) {
      const stage = digestion.stages[s];
      if (!stage.inside || stage.inside.length === 0) continue;

      const stageMeshes = stage.inside.map((id) => {
        const m = threeMeshes.get(id);
        expect(m, `missing mesh ${id} for stage ${stage.id}`).toBeDefined();
        return m!;
      });

      const u0 = route.stageStart[s];
      const u1 = route.stageEnd[s];
      const arcMeters = (u1 - u0) * route.length;
      const sampleCount = Math.max(10, Math.ceil(arcMeters / 0.002));

      let insideCount = 0;
      let curRunStart: [number, number, number] | null = null;
      let curRunLen = 0;
      let worstRunLen = 0;
      let worstStart: [number, number, number] | null = null;
      let worstEnd: [number, number, number] | null = null;
      let prevPt: [number, number, number] | null = null;

      for (let i = 0; i < sampleCount; i += 1) {
        const frac = sampleCount > 1 ? i / (sampleCount - 1) : 0.5;
        const u = u0 + (u1 - u0) * frac;
        route.pointAt(u, samplePt);
        const curCoords: [number, number, number] = [
          +samplePt.x.toFixed(4),
          +samplePt.y.toFixed(4),
          +samplePt.z.toFixed(4),
        ];

        if (isPointInsideMesh(raycaster, samplePt, stageMeshes)) {
          insideCount += 1;
          if (curRunLen > worstRunLen && prevPt) {
            worstRunLen = curRunLen;
            worstStart = curRunStart;
            worstEnd = prevPt;
          }
          curRunStart = null;
          curRunLen = 0;
        } else {
          if (curRunStart === null) curRunStart = curCoords;
          curRunLen += 1;
        }
        prevPt = curCoords;
      }
      if (curRunLen > worstRunLen && prevPt) {
        worstRunLen = curRunLen;
        worstStart = curRunStart;
        worstEnd = prevPt;
      }

      const pct = (insideCount / sampleCount) * 100;
      expect(
        pct,
        `stage "${stage.id}" only ${pct.toFixed(1)}% inside (${insideCount}/${sampleCount}), worst outside run ${worstRunLen} samples from ${JSON.stringify(worstStart)} to ${JSON.stringify(worstEnd)}`,
      ).toBeGreaterThanOrEqual(85);
    }
  });
});
