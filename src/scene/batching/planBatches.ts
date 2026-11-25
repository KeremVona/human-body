import type { MeshId } from '../../data/ids';
import { materialStateFor } from '../materials';
import type { MeshState } from '../resolveMeshState';

/** Planned per-batch state, promoted individual meshes, and per-mesh batch instance visibility. */
export type BatchPlan = {
  batchState: Map<string, 'base' | 'ghost' | 'hidden'>;
  promoted: Set<MeshId>;
  instanceVisible: Map<MeshId, boolean>;
};

/** Computes batch appearance states and per-mesh promotions from resolved mesh states and moving sets. */
export function planBatches(input: {
  members: ReadonlyMap<string, readonly MeshId[]>;
  states: ReadonlyMap<MeshId, MeshState>;
  moving: ReadonlySet<MeshId>;
}): BatchPlan {
  const batchState = new Map<string, 'base' | 'ghost' | 'hidden'>();
  const promoted = new Set<MeshId>();
  const instanceVisible = new Map<MeshId, boolean>();

  for (const [key, ids] of input.members) {
    let visibleCount = 0;
    let ghostCount = 0;
    let baseCount = 0;

    for (const id of ids) {
      const st = input.states.get(id);
      if (!st || !st.visible) continue;
      visibleCount += 1;
      const matState = materialStateFor(st);
      if (matState === 'ghost') {
        ghostCount += 1;
      } else if (matState === 'base') {
        baseCount += 1;
      }
    }

    const mode: 'base' | 'ghost' | 'hidden' =
      visibleCount === 0
        ? 'hidden'
        : ghostCount > baseCount
          ? 'ghost'
          : 'base';
    batchState.set(key, mode);

    for (const id of ids) {
      const st = input.states.get(id);
      if (!st || !st.visible || mode === 'hidden') {
        instanceVisible.set(id, false);
        continue;
      }
      const needsPromotion =
        materialStateFor(st) !== mode || input.moving.has(id);
      if (needsPromotion) {
        promoted.add(id);
        instanceVisible.set(id, false);
      } else {
        instanceVisible.set(id, true);
      }
    }
  }

  return { batchState, promoted, instanceVisible };
}
