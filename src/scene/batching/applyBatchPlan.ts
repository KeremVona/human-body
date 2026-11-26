import type { MeshId } from '../../data/ids';
import { attachMeshBvh } from '../bvh';
import { RENDER_ORDER, type createMaterialLibrary } from '../materials';
import type { MeshRegistry } from '../meshRegistry';
import type { MeshState } from '../resolveMeshState';
import type { BatchHandle, BatchUserData } from './buildBatches';
import type { BatchPlan } from './planBatches';

const instanceVisibilityCache = new WeakMap<BatchHandle, Uint8Array>();

function getTrackedVisibility(handle: BatchHandle): Uint8Array {
  let tracked = instanceVisibilityCache.get(handle);
  if (!tracked || tracked.length !== handle.meshIdAt.length) {
    // buildBatches starts every instance hidden (0).
    tracked = new Uint8Array(handle.meshIdAt.length);
    instanceVisibilityCache.set(handle, tracked);
  }
  return tracked;
}

/**
 * Applies a computed `BatchPlan` to all live `BatchHandle`s and promoted registry meshes.
 * Tracks per-instance visibility so unchanged frames skip `setVisibleAt` calls.
 */
export function applyBatchPlan({
  handles,
  plan,
  states,
  registry,
  library,
}: {
  handles: readonly BatchHandle[];
  plan: BatchPlan;
  states: ReadonlyMap<MeshId, MeshState>;
  registry: MeshRegistry;
  library: ReturnType<typeof createMaterialLibrary>;
}): { promoted: number; visibleBatches: number } {
  let visibleBatches = 0;

  for (const handle of handles) {
    const batchState = plan.batchState.get(handle.key) ?? 'hidden';
    const tracked = getTrackedVisibility(handle);
    const pickableArr = (handle.batch.userData as BatchUserData).pickable;
    let anyInstanceVisible = false;

    for (let i = 0; i < handle.meshIdAt.length; i += 1) {
      const id = handle.meshIdAt[i];
      const nextInst = plan.instanceVisible.get(id) === true;
      const nextBit = nextInst ? 1 : 0;

      if (tracked[i] !== nextBit) {
        handle.batch.setVisibleAt(i, nextInst);
        tracked[i] = nextBit;
      }

      pickableArr[i] = nextInst && states.get(id)?.pickable === true ? 1 : 0;
      if (nextInst) {
        anyInstanceVisible = true;
      }

      const mesh = registry.get(id);
      if (mesh) {
        const shouldShowMesh = plan.promoted.has(id);
        if (shouldShowMesh) {
          attachMeshBvh(mesh);
        }
        if (mesh.visible !== shouldShowMesh) {
          mesh.visible = shouldShowMesh;
        }
      }
    }

    const mat =
      handle.appearance === null
        ? library.fallback()
        : library.get({
            system: handle.appearance.system,
            tissue: handle.appearance.tissue,
            color: handle.appearance.color,
            state: batchState === 'ghost' ? 'ghost' : 'base',
          });
    const order =
      (handle.appearance ? RENDER_ORDER[handle.appearance.system] : 0) +
      (batchState === 'ghost' ? 10 : 0);
    const shouldShowBatch = batchState !== 'hidden' && anyInstanceVisible;

    handle.state = batchState;
    if (handle.batch.material !== mat) {
      handle.batch.material = mat;
    }
    if (handle.batch.renderOrder !== order) {
      handle.batch.renderOrder = order;
    }
    if (handle.batch.sortObjects !== mat.transparent) {
      handle.batch.sortObjects = mat.transparent;
    }
    handle.batch.perObjectFrustumCulled = true;
    if (handle.batch.visible !== shouldShowBatch) {
      handle.batch.visible = shouldShowBatch;
    }
    if (shouldShowBatch) {
      visibleBatches += 1;
    }
  }

  return {
    promoted: plan.promoted.size,
    visibleBatches,
  };
}
