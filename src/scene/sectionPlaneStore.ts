import type { Material, Plane } from 'three';
import type { MeshState } from './resolveMeshState';
import type { MaterialKey } from './materials';
import type { ResolvedQuality } from '../features/settings/quality';
import type { SystemId } from '../data/schema';

export type SectionMaterialLibrary = {
  get(key: MaterialKey): Material;
  setSystemOpacity(system: SystemId, opacity: number): void;
  setQuality(quality: ResolvedQuality): void;
  setClipPlane(plane: Plane | null): void;
  fallback(): Material;
  dispose(): void;
};

let activePlane: Plane | null = null;
let activeLibrary: SectionMaterialLibrary | null = null;
let suppressedViewKey: string | null = null;
const libraryListeners = new Set<
  (lib: SectionMaterialLibrary | null) => void
>();

/** Suppresses the automatic camera preset once when applying a shared section view key. */
export function suppressSectionPreset(key: string): void {
  suppressedViewKey = key;
}

/** Returns and clears the matching suppressed section-preset key, if any. */
export function consumeSuppressedSectionPreset(key: string): boolean {
  if (suppressedViewKey !== key) return false;
  suppressedViewKey = null;
  return true;
}

/** Holds the shared active THREE.Plane instance when cross-sectioning, or null when off. */
export const sectionPlaneStore = {
  get(): Plane | null {
    return activePlane;
  },
  set(next: Plane | null): void {
    activePlane = next;
  },
};

/** Shares the active SceneStateApplier MaterialLibrary instance with SectionController. */
export const sectionMaterialLibrary = {
  get(): SectionMaterialLibrary | null {
    return activeLibrary;
  },
  set(lib: SectionMaterialLibrary | null): void {
    activeLibrary = lib;
    for (const listener of libraryListeners) {
      listener(lib);
    }
  },
  subscribe(
    listener: (lib: SectionMaterialLibrary | null) => void,
  ): () => void {
    libraryListeners.add(listener);
    return () => {
      libraryListeners.delete(listener);
    };
  },
};

export type { MeshState };
