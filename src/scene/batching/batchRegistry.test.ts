import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { MeshId } from '../../data/ids';
import { createBatchRegistry } from './batchRegistry';
import { buildBatches } from './buildBatches';

function makeHandles(bundleId: string, ids: MeshId[]) {
  const appearance = { system: 'skeletal' as const, tissue: 'bone' as const };
  return buildBatches(
    bundleId,
    ids.map((id) => {
      const m = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
      m.name = id;
      return { id, mesh: m, appearance };
    }),
    () => new MeshBasicMaterial(),
  );
}

describe('createBatchRegistry', () => {
  it('tracks handles across bundles, maps byMesh, removes bundles, and notifies subscribers', () => {
    const reg = createBatchRegistry();
    const listener = vi.fn();
    const unsub = reg.subscribe(listener);

    const skeletalHandles = makeHandles('skeletal', ['femur--l', 'tibia--l'] as MeshId[]);
    const muscularHandles = makeHandles('muscular', ['biceps-brachii--l'] as MeshId[]);

    reg.add(skeletalHandles);
    reg.add(muscularHandles);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(reg.all()).toHaveLength(2);

    const hit = reg.byMesh('tibia--l' as MeshId);
    expect(hit).toEqual({ handle: skeletalHandles[0], instance: 1 });
    expect(reg.byMesh('biceps-brachii--l' as MeshId)?.instance).toBe(0);

    const removed = reg.removeBundle('skeletal');
    expect(removed).toEqual(skeletalHandles);
    expect(reg.all()).toEqual(muscularHandles);
    expect(reg.byMesh('femur--l' as MeshId)).toBeUndefined();
    expect(reg.byMesh('tibia--l' as MeshId)).toBeUndefined();
    expect(reg.byMesh('biceps-brachii--l' as MeshId)).toBeDefined();
    expect(listener).toHaveBeenCalledTimes(3);

    unsub();
    reg.removeBundle('muscular');
    expect(listener).toHaveBeenCalledTimes(3);
  });
});
