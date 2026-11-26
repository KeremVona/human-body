import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { useStore } from 'react-redux';
import type { RootState } from '../app/store';
import { isMeshId, parseMeshId, type MeshId } from '../data/ids';
import { selectStructureLookup } from '../features/content/contentSlice';
import { selectMotionMoving } from '../features/motion/motionSlice';
import {
  resolveQuality,
  type ResolvedQuality,
} from '../features/settings/quality';
import { applyMeshStates } from './applyMeshStates';
import { applyBatchPlan } from './batching/applyBatchPlan';
import { useOptionalBatchRegistry } from './batching/batchRegistry';
import { batchingEnabled } from './batching/flag';
import { planBatches } from './batching/planBatches';
import { createMaterialLibrary } from './materials';
import { useMeshRegistry } from './meshRegistry';
import { selectResolvedMeshStates, type MeshState } from './resolveMeshState';
import { sectionMaterialLibrary, sectionPlaneStore } from './sectionPlaneStore';

/** Subscribes imperatively to store and registry changes to diff-apply mesh and batch appearance inside Canvas. */
export function SceneStateApplier(): null {
  const store = useStore<RootState>();
  const registry = useMeshRegistry();
  const batchRegistry = useOptionalBatchRegistry();
  const invalidate = useThree((s) => s.invalidate);

  const prevStatesRef = useRef<Map<MeshId, MeshState>>(new Map());
  const prevOpacitiesRef = useRef<Map<string, number>>(new Map());
  const prevQualityRef = useRef<ResolvedQuality | null>(null);
  const prevMovingRef = useRef<ReadonlySet<MeshId> | null>(null);
  const prevBatchCountRef = useRef(0);
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
        prevQualityRef.current = null;
      }
      const lib = createMaterialLibrary(fadeOpacity);
      lib.setClipPlane(sectionPlaneStore.get());
      libraryRef.current = { fadeOpacity, lib };
      sectionMaterialLibrary.set(lib);
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

      const resolvedQuality = resolveQuality(state.ui.quality);
      let qualityChanged = false;
      if (prevQualityRef.current !== resolvedQuality) {
        library.setQuality(resolvedQuality);
        prevQualityRef.current = resolvedQuality;
        qualityChanged = true;
      }

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

      let batchChanged = false;
      const handles =
        batchRegistry && batchingEnabled(window.location.search)
          ? batchRegistry.all()
          : [];
      if (handles.length > 0) {
        const moving = selectMotionMoving(state);
        const members = new Map<string, readonly MeshId[]>(
          handles.map((h) => [h.key, h.meshIdAt]),
        );
        const plan = planBatches({ members, states: next, moving });
        applyBatchPlan({ handles, plan, states: next, registry, library });
        if (
          prevMovingRef.current !== moving ||
          prevBatchCountRef.current !== handles.length
        ) {
          batchChanged = true;
        }
        prevMovingRef.current = moving;
        prevBatchCountRef.current = handles.length;
      } else if (prevBatchCountRef.current !== 0) {
        prevBatchCountRef.current = 0;
        prevMovingRef.current = null;
        batchChanged = true;
      }

      prevStatesRef.current = next;
      if (changed > 0 || opacityChanged || qualityChanged || batchChanged) {
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
    const unsubBatch = batchRegistry?.subscribe(scheduleApply);
    window.addEventListener('resize', scheduleApply);

    return () => {
      disposed = true;
      unsubStore();
      unsubRegistry();
      unsubBatch?.();
      window.removeEventListener('resize', scheduleApply);
      sectionMaterialLibrary.set(null);
      libraryRef.current?.lib.dispose();
      libraryRef.current = null;
      prevStatesRef.current = new Map();
      prevOpacitiesRef.current = new Map();
      prevQualityRef.current = null;
      prevMovingRef.current = null;
      prevBatchCountRef.current = 0;
    };
  }, [store, registry, batchRegistry, invalidate]);

  return null;
}
