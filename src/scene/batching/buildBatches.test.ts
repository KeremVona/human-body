import {
  BatchedMesh,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Vector3,
} from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { MeshId } from '../../data/ids';
import { buildBatches, raycastBatchedMesh } from './buildBatches';

function makeBoxMesh(
  name: string,
  pos?: [number, number, number],
): Mesh {
  const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
  mesh.name = name;
  if (pos) {
    mesh.position.set(pos[0], pos[1], pos[2]);
  }
  return mesh;
}

describe('buildBatches', () => {
  it('groups by appearance preserving input order', () => {
    const bone = { system: 'skeletal' as const, tissue: 'bone' as const };
    const cart = { system: 'skeletal' as const, tissue: 'cartilage' as const };
    const entries = [
      { id: 'femur--l' as MeshId, mesh: makeBoxMesh('femur--l'), appearance: bone },
      {
        id: 'costal-cartilage-of-first-rib--l' as MeshId,
        mesh: makeBoxMesh('costal-cartilage-of-first-rib--l'),
        appearance: cart,
      },
      { id: 'tibia--l' as MeshId, mesh: makeBoxMesh('tibia--l'), appearance: bone },
      { id: 'unknown-part' as MeshId, mesh: makeBoxMesh('unknown-part'), appearance: undefined },
      { id: 'fibula--l' as MeshId, mesh: makeBoxMesh('fibula--l'), appearance: bone },
    ];

    const handles = buildBatches('skeletal', entries, () => new MeshBasicMaterial());
    expect(handles).toHaveLength(3);

    const boneHandle = handles.find((h) => h.key === 'skeletal|skeletal|bone|');
    expect(boneHandle).toBeDefined();
    expect(boneHandle!.meshIdAt).toEqual(['femur--l', 'tibia--l', 'fibula--l']);
    expect(boneHandle!.instanceOf.get('femur--l' as MeshId)).toBe(0);
    expect(boneHandle!.instanceOf.get('tibia--l' as MeshId)).toBe(1);
    expect(boneHandle!.instanceOf.get('fibula--l' as MeshId)).toBe(2);
    expect(boneHandle!.batch.name).toBe('batch:skeletal|skeletal|bone|');
    expect(boneHandle!.batch.raycast).toBe(raycastBatchedMesh);
    expect(boneHandle!.batch.boundsTrees?.length).toBe(3);

    boneHandle!.batch.visible = true;
    boneHandle!.batch.setVisibleAt(0, true);
    const hits = new Raycaster(
      new Vector3(0, 0, 5),
      new Vector3(0, 0, -1),
    ).intersectObject(boneHandle!.batch, false);
    expect(hits.length).toBeGreaterThan(0);
    expect((hits[0] as { batchId?: number }).batchId).toBe(0);

    const fallbackHandle = handles.find((h) => h.key === 'skeletal|fallback');
    expect(fallbackHandle).toBeDefined();
    expect(fallbackHandle!.appearance).toBeNull();
  });

  it('copies world matrices from source meshes', () => {
    const mesh = makeBoxMesh('femur--l', [1, 2, 3]);
    const handles = buildBatches(
      'skeletal',
      [
        {
          id: 'femur--l' as MeshId,
          mesh,
          appearance: { system: 'skeletal', tissue: 'bone' },
        },
      ],
      () => new MeshBasicMaterial(),
    );

    const m = new Matrix4();
    handles[0].batch.getMatrixAt(0, m);
    const v = new Vector3().setFromMatrixPosition(m);
    expect(v.x).toBeCloseTo(1);
    expect(v.y).toBeCloseTo(2);
    expect(v.z).toBeCloseTo(3);
  });

  it('starts hidden and unpickable with atlasBatch metadata', () => {
    const bone = { system: 'skeletal' as const, tissue: 'bone' as const };
    const handles = buildBatches(
      'skeletal',
      [
        { id: 'femur--l' as MeshId, mesh: makeBoxMesh('femur--l'), appearance: bone },
        { id: 'tibia--l' as MeshId, mesh: makeBoxMesh('tibia--l'), appearance: bone },
      ],
      () => new MeshBasicMaterial(),
    );

    const handle = handles[0];
    expect(handle.batch.visible).toBe(false);
    expect(handle.state).toBe('hidden');
    expect(handle.batch.getVisibleAt(0)).toBe(false);
    expect(handle.batch.getVisibleAt(1)).toBe(false);
    expect(handle.batch.userData.atlasBatch).toBe(true);
    expect(handle.batch.userData.meshIds).toEqual(['femur--l', 'tibia--l']);
    expect(Array.from(handle.batch.userData.pickable as Uint8Array)).toEqual([0, 0]);
  });

  it('sizes BatchedMesh to exact vertex and index capacity', () => {
    const bone = { system: 'skeletal' as const, tissue: 'bone' as const };
    const handles = buildBatches(
      'skeletal',
      [
        { id: 'femur--l' as MeshId, mesh: makeBoxMesh('femur--l'), appearance: bone },
        { id: 'tibia--l' as MeshId, mesh: makeBoxMesh('tibia--l'), appearance: bone },
      ],
      () => new MeshBasicMaterial(),
    );

    const batch = handles[0].batch;
    expect(batch.geometry.attributes.position.count).toBe(48);
    expect(batch.geometry.index?.count).toBe(72);
  });

  it('normalizes inconsistent uv attributes within an appearance group', () => {
    const bone = { system: 'skeletal' as const, tissue: 'bone' as const };
    const m1 = makeBoxMesh('femur--l');
    const g2 = new BufferGeometry();
    const box = new BoxGeometry(1, 1, 1);
    g2.setAttribute('position', box.attributes.position);
    g2.setAttribute('normal', box.attributes.normal);
    g2.setIndex(box.index);
    const m2 = new Mesh(g2, new MeshBasicMaterial());
    m2.name = 'tibia--l';

    const handles = buildBatches(
      'skeletal',
      [
        { id: 'femur--l' as MeshId, mesh: m1, appearance: bone },
        { id: 'tibia--l' as MeshId, mesh: m2, appearance: bone },
      ],
      () => new MeshBasicMaterial(),
    );
    expect(handles).toHaveLength(1);
    expect(handles[0].meshIdAt).toEqual(['femur--l', 'tibia--l']);
  });

  it('counts vertex count as index count for non-indexed geometries', () => {
    const bone = { system: 'skeletal' as const, tissue: 'bone' as const };
    const g1 = new BoxGeometry(1, 1, 1).toNonIndexed();
    const g2 = new BoxGeometry(1, 1, 1).toNonIndexed();
    const handles = buildBatches(
      'skeletal',
      [
        { id: 'femur--l' as MeshId, mesh: new Mesh(g1), appearance: bone },
        { id: 'tibia--l' as MeshId, mesh: new Mesh(g2), appearance: bone },
      ],
      () => new MeshBasicMaterial(),
    );
    expect(handles[0].batch.geometry.attributes.position.count).toBe(72);
    const internal = handles[0].batch as unknown as {
      _maxIndexCount: number;
    };
    expect(internal._maxIndexCount).toBe(72);
  });

  it('preserves BufferAttribute counts when mixed indexed and non-indexed geometries share a group', () => {
    const bone = { system: 'skeletal' as const, tissue: 'bone' as const };
    const indexed = makeBoxMesh('femur--l'); // 24 verts, 36 indices
    const nonIndexed = new Mesh(
      new BoxGeometry(1, 1, 1).toNonIndexed(),
      new MeshBasicMaterial(),
    ); // 36 verts, 36 indices
    nonIndexed.name = 'tibia--l';

    const handles = buildBatches(
      'skeletal',
      [
        { id: 'femur--l' as MeshId, mesh: indexed, appearance: bone },
        { id: 'tibia--l' as MeshId, mesh: nonIndexed, appearance: bone },
      ],
      () => new MeshBasicMaterial(),
    );
    expect(handles[0].batch.geometry.attributes.position.count).toBe(60);
    expect(handles[0].batch.geometry.index?.count).toBe(72);
    expect(
      handles[0].batch.geometry.attributes.position instanceof BufferAttribute,
    ).toBe(true);
  });

  it('disposes already-built batches if a subsequent group throws', () => {
    const bone = { system: 'skeletal' as const, tissue: 'bone' as const };
    const cart = { system: 'skeletal' as const, tissue: 'cartilage' as const };
    const disposeSpy = vi.spyOn(BatchedMesh.prototype, 'dispose');

    let calls = 0;
    expect(() =>
      buildBatches(
        'skeletal',
        [
          { id: 'femur--l' as MeshId, mesh: makeBoxMesh('femur--l'), appearance: bone },
          {
            id: 'costal-cartilage-of-first-rib--l' as MeshId,
            mesh: makeBoxMesh('costal-cartilage-of-first-rib--l'),
            appearance: cart,
          },
        ],
        () => {
          calls += 1;
          if (calls === 2) {
            throw new Error('material failure');
          }
          return new MeshBasicMaterial();
        },
      ),
    ).toThrow('material failure');

    expect(disposeSpy).toHaveBeenCalledTimes(1);
    disposeSpy.mockRestore();
  });
});
