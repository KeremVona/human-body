import {
  createContext,
  createElement,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import type { MeshId } from '../../data/ids';
import type { BatchHandle } from './buildBatches';

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
  const byMeshMap = new Map<
    MeshId,
    { handle: BatchHandle; instance: number }
  >();
  const listeners = new Set<() => void>();

  function notify(): void {
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
      return [...handles];
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

/** Returns the active BatchRegistry inside `<AtlasCanvas>`. */
export function useBatchRegistry(): BatchRegistry {
  const registry = useContext(BatchRegistryContext);
  if (!registry) {
    throw new Error('useBatchRegistry requires BatchRegistryProvider');
  }
  return registry;
}
