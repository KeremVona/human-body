import {
  createContext,
  createElement,
  useContext,
  type ReactNode,
} from 'react';
import type { Mesh, Object3D } from 'three';
import { isMeshId, type MeshId } from '../data/ids';

/** Registry mapping stable MeshIds to live Three.js Mesh instances. */
export type MeshRegistry = {
  register(id: MeshId, mesh: Mesh): void;
  unregister(ids: MeshId[]): void;
  get(id: MeshId): Mesh | undefined;
  ids(): MeshId[];
  subscribe(listener: () => void): () => void;
  readonly size: number;
};

/** Creates an isolated MeshRegistry backed by a Map. */
export function createMeshRegistry(): MeshRegistry {
  const meshes = new Map<MeshId, Mesh>();
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    register(id: MeshId, mesh: Mesh): void {
      if (meshes.has(id)) {
        throw new Error(`duplicate mesh id "${id}"`);
      }
      meshes.set(id, mesh);
      notify();
    },
    unregister(ids: MeshId[]): void {
      for (const id of ids) {
        meshes.delete(id);
      }
      notify();
    },
    get(id: MeshId): Mesh | undefined {
      return meshes.get(id);
    },
    ids(): MeshId[] {
      return [...meshes.keys()];
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    get size(): number {
      return meshes.size;
    },
  };
}

/** Walks up from `object` to find its own or nearest ancestor name that is a valid MeshId. */
export function meshIdOf(object: Object3D): MeshId | null {
  let current: Object3D | null = object;
  while (current) {
    if (isMeshId(current.name)) {
      return current.name;
    }
    current = current.parent;
  }
  return null;
}

const MeshRegistryContext = createContext<MeshRegistry | null>(null);

/** React context provider exposing the shared MeshRegistry to scene and app layers. */
export function MeshRegistryProvider({
  registry,
  children,
}: {
  registry: MeshRegistry;
  children: ReactNode;
}) {
  return createElement(
    MeshRegistryContext.Provider,
    { value: registry },
    children,
  );
}

/** Returns the active MeshRegistry from context, throwing if no provider is mounted. */
export function useMeshRegistry(): MeshRegistry {
  const registry = useContext(MeshRegistryContext);
  if (!registry) {
    throw new Error('useMeshRegistry must be used within MeshRegistryProvider');
  }
  return registry;
}
