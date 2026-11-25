import {
  BatchedMesh,
  BufferAttribute,
  BufferGeometry,
  type Material,
  type Mesh,
} from 'three';
import {
  CENTER,
  acceleratedRaycast,
  computeBatchedBoundsTree,
  disposeBatchedBoundsTree,
} from 'three-mesh-bvh';
import type { MeshId } from '../../data/ids';
import type { MeshAppearance } from '../applyMeshStates';
import { appearanceKey } from './keys';

/** Entry representing one source mesh inside a bundle ready for batching. */
export type BatchEntry = {
  id: MeshId;
  mesh: Mesh;
  appearance: MeshAppearance | undefined;
};

/** Runtime handle for one appearance-keyed BatchedMesh and its member mapping. */
export type BatchHandle = {
  key: string;
  bundleId: string;
  appearance: MeshAppearance | null;
  batch: BatchedMesh;
  instanceOf: Map<MeshId, number>;
  meshIdAt: MeshId[];
  state: 'base' | 'ghost' | 'hidden';
};

/** UserData contract attached to every atlas BatchedMesh instance. */
export type BatchUserData = {
  atlasBatch: true;
  meshIds: MeshId[];
  pickable: Uint8Array;
};

type BatchedWithBvh = BatchedMesh & {
  computeBoundsTree?: typeof computeBatchedBoundsTree;
  disposeBoundsTree?: typeof disposeBatchedBoundsTree;
};

function commonAttributeNames(entries: readonly BatchEntry[]): string[] {
  const first = entries[0]?.mesh.geometry;
  if (!first) return [];
  let names = Object.keys(first.attributes);
  for (let i = 1; i < entries.length; i += 1) {
    const attrs = entries[i].mesh.geometry.attributes;
    names = names.filter((name) => {
      const a = attrs[name];
      const b = first.attributes[name];
      return Boolean(
        a &&
          b &&
          a.itemSize === b.itemSize &&
          a.normalized === b.normalized,
      );
    });
  }
  return names;
}

function normalizeGeometry(
  source: BufferGeometry,
  attributeNames: readonly string[],
  forceIndexed: boolean,
): BufferGeometry {
  const sameAttrs =
    Object.keys(source.attributes).length === attributeNames.length &&
    attributeNames.every((name) => Boolean(source.attributes[name]));

  if (sameAttrs && (!forceIndexed || Boolean(source.index))) {
    return source;
  }

  const normalized = new BufferGeometry();
  for (const name of attributeNames) {
    const attr = source.attributes[name];
    if (attr) {
      normalized.setAttribute(name, attr);
    }
  }
  if (source.index) {
    normalized.setIndex(source.index);
  } else if (forceIndexed && source.attributes.position) {
    const count = source.attributes.position.count;
    const indices =
      count > 65535 ? new Uint32Array(count) : new Uint16Array(count);
    for (let i = 0; i < count; i += 1) {
      indices[i] = i;
    }
    normalized.setIndex(new BufferAttribute(indices, 1));
  }
  return normalized;
}

/**
 * Packs source meshes into appearance-keyed `BatchedMesh` handles with batched BVHs.
 * Every batch and instance starts hidden and unpickable; source geometries remain unmodified.
 */
export function buildBatches(
  bundleId: string,
  entries: readonly BatchEntry[],
  material: (appearance: MeshAppearance | null) => Material,
): BatchHandle[] {
  const groups = new Map<
    string,
    { appearance: MeshAppearance | null; members: BatchEntry[] }
  >();

  for (const entry of entries) {
    const key = appearanceKey(bundleId, entry.appearance);
    let group = groups.get(key);
    if (!group) {
      group = {
        appearance: entry.appearance ?? null,
        members: [],
      };
      groups.set(key, group);
    }
    group.members.push(entry);
  }

  const handles: BatchHandle[] = [];

  for (const [key, { appearance, members }] of groups) {
    const attributeNames = commonAttributeNames(members);
    const anyIndexed = members.some((m) => Boolean(m.mesh.geometry.index));

    let maxVertexCount = 0;
    let maxIndexCount = 0;
    for (const { mesh } of members) {
      const pos = mesh.geometry.attributes.position;
      const vCount = pos ? pos.count : 0;
      maxVertexCount += vCount;
      maxIndexCount += mesh.geometry.index ? mesh.geometry.index.count : vCount;
    }

    const batch = new BatchedMesh(
      members.length,
      maxVertexCount,
      maxIndexCount,
      material(appearance),
    ) as BatchedWithBvh;
    batch.name = `batch:${key}`;
    batch.visible = false;

    const instanceOf = new Map<MeshId, number>();
    const meshIdAt: MeshId[] = new Array<MeshId>(members.length);

    for (const { id, mesh } of members) {
      const prepared = normalizeGeometry(
        mesh.geometry,
        attributeNames,
        anyIndexed,
      );
      const geomId = batch.addGeometry(prepared);
      const instanceId = batch.addInstance(geomId);
      mesh.updateWorldMatrix(true, false);
      batch.setMatrixAt(instanceId, mesh.matrixWorld);
      batch.setVisibleAt(instanceId, false);
      instanceOf.set(id, instanceId);
      meshIdAt[instanceId] = id;
    }

    const userData: BatchUserData = {
      atlasBatch: true,
      meshIds: meshIdAt,
      pickable: new Uint8Array(members.length),
    };
    batch.userData = userData;

    batch.computeBoundsTree = computeBatchedBoundsTree;
    batch.disposeBoundsTree = disposeBatchedBoundsTree;
    batch.computeBoundsTree(-1, {
      strategy: CENTER,
      targetLeafSize: 10,
      setBoundingBox: true,
    });
    batch.raycast = acceleratedRaycast;
    batch.computeBoundingBox();
    batch.computeBoundingSphere();

    handles.push({
      key,
      bundleId,
      appearance,
      batch,
      instanceOf,
      meshIdAt,
      state: 'hidden',
    });
  }

  return handles;
}
