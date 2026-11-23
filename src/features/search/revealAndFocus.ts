import type { AppThunk, RootState } from '../../app/store';
import type { MeshId, StructureId } from '../../data/ids';
import {
  bundlesRequested,
  selectBundlesForSystem,
} from '../assets/assetsSlice';
import { reveal } from '../dissection/dissectionSlice';
import { selected } from '../selection/selectionSlice';
import { systemToggled } from '../systems/systemsSlice';

export type BundleWaitStore = {
  getState(): RootState;
  subscribe?(listener: () => void): () => void;
};

/** Resolves once all requested bundles report `ready`, rejecting on error or timeout. */
export function waitForBundles(
  store: BundleWaitStore,
  ids: string[],
  timeoutMs = 30_000,
): Promise<void> {
  if (ids.length === 0) return Promise.resolve();

  const inspect = (): 'ready' | { error: string } | { pending: string } => {
    const bundles = store.getState().assets.bundles;
    let firstPending: string | null = null;
    for (const id of ids) {
      const status = bundles[id] ?? 'idle';
      if (status === 'error') return { error: id };
      if (status !== 'ready' && firstPending === null) firstPending = id;
    }
    return firstPending ? { pending: firstPending } : 'ready';
  };

  const initial = inspect();
  if (initial === 'ready') return Promise.resolve();
  if ('error' in initial) {
    return Promise.reject(new Error(`bundle failed: ${initial.error}`));
  }

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let unsub: (() => void) | undefined;

    const cleanup = () => {
      clearTimeout(timer);
      unsub?.();
      unsub = undefined;
    };

    const check = () => {
      if (settled) return;
      const result = inspect();
      if (result === 'ready') {
        settled = true;
        cleanup();
        resolve();
      } else if ('error' in result) {
        settled = true;
        cleanup();
        reject(new Error(`bundle failed: ${result.error}`));
      }
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      const result = inspect();
      const pendingId =
        typeof result === 'object' && 'pending' in result
          ? result.pending
          : ids[0];
      cleanup();
      reject(new Error(`bundle timeout: ${pendingId}`));
    }, timeoutMs);

    unsub = store.subscribe?.(check);
    check();
  });
}

function resolveMeshIds(
  structureId: StructureId,
  side: 'left' | 'right' | 'both',
  meshes: Record<string, unknown>,
): MeshId[] {
  const leftId = `${structureId}--l` as MeshId;
  const rightId = `${structureId}--r` as MeshId;
  const hasLeft = Object.hasOwn(meshes, leftId);
  const hasRight = Object.hasOwn(meshes, rightId);
  const hasUnpaired = Object.hasOwn(meshes, structureId);

  if (side === 'left') {
    if (hasLeft) return [leftId];
    return hasUnpaired ? [structureId as MeshId] : [];
  }
  if (side === 'right') {
    if (hasRight) return [rightId];
    return hasUnpaired ? [structureId as MeshId] : [];
  }

  const out: MeshId[] = [];
  if (hasLeft) out.push(leftId);
  if (hasRight) out.push(rightId);
  if (out.length === 0 && hasUnpaired) out.push(structureId as MeshId);
  return out;
}

/** Enables the target's system, waits for its bundles, unhides/exits isolation, selects, and focuses it. */
export function revealAndFocus(
  structureId: StructureId,
  side: 'left' | 'right' | 'both' = 'both',
): AppThunk<Promise<void>> {
  return async (dispatch, getState, extra) => {
    const state = getState();
    const manifest = state.assets.manifest;
    const entry = state.content.index?.structures.find(
      (s) => s.id === structureId,
    );
    if (!manifest || !entry) return;

    const meshIds = resolveMeshIds(structureId, side, manifest.meshes);
    if (meshIds.length === 0) return;

    if (!state.systems[entry.system].enabled) {
      dispatch(systemToggled(entry.system));
    }

    const bundleIds = selectBundlesForSystem(getState(), entry.system);
    const pendingBundles = bundleIds.filter(
      (id) => getState().assets.bundles[id] !== 'ready',
    );
    if (pendingBundles.length > 0) {
      dispatch(bundlesRequested(pendingBundles));
    }

    await waitForBundles({ getState, subscribe: extra?.subscribe }, bundleIds);

    dispatch(reveal(meshIds));
    dispatch(selected(meshIds));
    await extra?.camera?.current?.focusMeshes(meshIds);
  };
}
