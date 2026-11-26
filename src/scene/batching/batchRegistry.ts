import {
  createContext,
  createElement,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import type { MeshId } from '../../data/ids';
import type { MeshRegistry } from '../meshRegistry';
import type { BatchHandle } from './buildBatches';

/** Live draw breakdown counts across batches and individual meshes. */
export type DrawStats = {
  batches: number;
  promoted: number;
  individual: number;
  doubleDrawn?: number;
};

/** Registry tracking live appearance-keyed BatchedMesh handles across loaded bundles. */
export type BatchRegistry = {
  add(handles: BatchHandle[]): void;
  removeBundle(bundleId: string): BatchHandle[];
  all(): BatchHandle[];
  byMesh(id: MeshId): { handle: BatchHandle; instance: number } | undefined;
  subscribe(listener: () => void): () => void;
};

/** Creates an isolated BatchRegistry tracking handles by bundle and mesh id. */
export function createBatchRegistry(): BatchRegistry {
  const handles: BatchHandle[] = [];
  let snapshot: BatchHandle[] = [];
  const byMeshMap = new Map<
    MeshId,
    { handle: BatchHandle; instance: number }
  >();
  const listeners = new Set<() => void>();

  function notify(): void {
    snapshot = [...handles];
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    add(next: BatchHandle[]): void {
      if (next.length === 0) return;
      for (const handle of next) {
        handles.push(handle);
        for (const [id, instance] of handle.instanceOf) {
          byMeshMap.set(id, { handle, instance });
        }
      }
      notify();
    },
    removeBundle(bundleId: string): BatchHandle[] {
      const removed: BatchHandle[] = [];
      for (let i = handles.length - 1; i >= 0; i -= 1) {
        if (handles[i].bundleId === bundleId) {
          removed.unshift(handles[i]);
          handles.splice(i, 1);
        }
      }
      if (removed.length > 0) {
        for (const handle of removed) {
          for (const id of handle.meshIdAt) {
            byMeshMap.delete(id);
          }
        }
        notify();
      }
      return removed;
    },
    all(): BatchHandle[] {
      return snapshot;
    },
    byMesh(id: MeshId): { handle: BatchHandle; instance: number } | undefined {
      return byMeshMap.get(id);
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const BatchRegistryContext = createContext<BatchRegistry | null>(null);

/** Provides an explicit or lazily created BatchRegistry to Canvas children. */
export function BatchRegistryProvider({
  registry,
  children,
}: {
  registry?: BatchRegistry;
  children: ReactNode;
}) {
  const [fallback] = useState(() => createBatchRegistry());
  const value = registry ?? fallback;
  return createElement(BatchRegistryContext.Provider, { value }, children);
}

/** Returns the active BatchRegistry from context if mounted, or null otherwise. */
export function useOptionalBatchRegistry(): BatchRegistry | null {
  return useContext(BatchRegistryContext);
}

/** Returns the active BatchRegistry inside `<AtlasCanvas>`. */
export function useBatchRegistry(): BatchRegistry {
  const registry = useContext(BatchRegistryContext);
  if (!registry) {
    throw new Error('useBatchRegistry requires BatchRegistryProvider');
  }
  return registry;
}

/** Counts visible batches, promoted batched meshes, individual visible meshes, and any double-draws. */
export function computeDrawStats(
  meshRegistry: MeshRegistry,
  batchRegistry: BatchRegistry | null,
): DrawStats {
  let batches = 0;
  let promoted = 0;
  let individual = 0;
  let doubleDrawn = 0;

  if (batchRegistry) {
    for (const handle of batchRegistry.all()) {
      if (handle.batch.visible) {
        batches += 1;
      }
    }
  }

  for (const id of meshRegistry.ids()) {
    const mesh = meshRegistry.get(id);
    if (!mesh) continue;
    const batchEntry = batchRegistry?.byMesh(id);
    const inBatchVisible = Boolean(
      batchEntry &&
        batchEntry.handle.batch.visible &&
        batchEntry.handle.batch.getVisibleAt(batchEntry.instance),
    );
    if (mesh.visible) {
      individual += 1;
      if (batchEntry) {
        promoted += 1;
      }
      if (inBatchVisible) {
        doubleDrawn += 1;
      }
    }
  }

  return { batches, promoted, individual, doubleDrawn };
}
