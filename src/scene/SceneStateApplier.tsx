import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { useStore } from 'react-redux';
import type { RootState } from '../app/store';
import { isMeshId, parseMeshId, type MeshId } from '../data/ids';
import { selectStructureLookup } from '../features/content/contentSlice';
import { applyMeshStates } from './applyMeshStates';
import { createMaterialLibrary } from './materials';
import { useMeshRegistry } from './meshRegistry';
import { selectResolvedMeshStates, type MeshState } from './resolveMeshState';

/** Subscribes imperatively to store and registry changes to diff-apply mesh appearance inside Canvas. */
export function SceneStateApplier(): null {
  const store = useStore<RootState>();
  const registry = useMeshRegistry();
  const invalidate = useThree((s) => s.invalidate);

  const prevStatesRef = useRef<Map<MeshId, MeshState>>(new Map());
  const prevOpacitiesRef = useRef<Map<string, number>>(new Map());
  const libraryRef = useRef<{
    fadeOpacity: number;
    lib: ReturnType<typeof createMaterialLibrary>;
  } | null>(null);

  useEffect(() => {
    let disposed = false;
    let scheduled = false;

    const getLibrary = (fadeOpacity: number) => {
      if (
        libraryRef.current &&
        libraryRef.current.fadeOpacity === fadeOpacity
      ) {
        return libraryRef.current.lib;
      }
      if (libraryRef.current) {
        libraryRef.current.lib.dispose();
        prevStatesRef.current = new Map();
        prevOpacitiesRef.current = new Map();
      }
      const lib = createMaterialLibrary(fadeOpacity);
      libraryRef.current = { fadeOpacity, lib };
      return lib;
    };

    const applyNow = () => {
      scheduled = false;
      if (disposed) return;

      const state = store.getState();
      const meshIds = registry.ids();
      const next = selectResolvedMeshStates(state, meshIds);
      const structureLookup = selectStructureLookup(state);
      const library = getLibrary(state.dissection.fadeOpacity);

      let opacityChanged = false;
      for (const [sysId, sysState] of Object.entries(state.systems)) {
        const prevOpacity = prevOpacitiesRef.current.get(sysId);
        if (prevOpacity !== sysState.opacity) {
          library.setSystemOpacity(
            sysId as keyof typeof state.systems,
            sysState.opacity,
          );
          prevOpacitiesRef.current.set(sysId, sysState.opacity);
          opacityChanged = true;
        }
      }

      const changed = applyMeshStates({
        registry,
        prev: prevStatesRef.current,
        next,
        lookup: (id) =>
          isMeshId(id)
            ? structureLookup.get(parseMeshId(id).structureId)
            : undefined,
        library,
      });

      prevStatesRef.current = next;
      if (changed > 0 || opacityChanged) {
        invalidate();
      }
    };

    const scheduleApply = () => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(applyNow);
    };

    applyNow();
    const unsubStore = store.subscribe(scheduleApply);
    const unsubRegistry = registry.subscribe(scheduleApply);

    return () => {
      disposed = true;
      unsubStore();
      unsubRegistry();
      libraryRef.current?.lib.dispose();
      libraryRef.current = null;
      prevStatesRef.current = new Map();
    };
  }, [store, registry, invalidate]);

  return null;
}
