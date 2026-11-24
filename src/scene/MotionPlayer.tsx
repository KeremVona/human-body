import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { useStore } from 'react-redux';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import type { RootState } from '../app/store';
import {
  anchorPoint,
  heartbeatScale,
  hingeAngleDeg,
  hingeDirection,
} from '../features/motion/math';
import { motionPhase } from '../features/motion/motionPhase';
import { motionDirectionChanged } from '../features/motion/motionSlice';
import type { MotionDef, PulseDef } from '../features/motion/schema';
import { DEFAULT_BODY_BOUNDS, unionBounds, type Bounds } from './camera';
import { useMeshRegistry } from './meshRegistry';
import { createMotionTransforms } from './motionTransforms';
import { sectionMaterialLibrary } from './sectionPlaneStore';

function movingIdsFor(def: MotionDef): string[] {
  if (def.kind === 'hinge') return def.moving;
  return def.groups.flatMap((g) => g.meshes);
}

function pulseCenterFor(
  def: PulseDef,
  boundsMap: Record<string, { bounds: Bounds }>,
): [number, number, number] {
  if (def.center && boundsMap[def.center.mesh]) {
    return anchorPoint(def.center.anchor, boundsMap[def.center.mesh].bounds);
  }
  const allIds = def.groups.flatMap((g) => g.meshes);
  const fakeManifestMeshes: Record<string, { bounds: Bounds }> = {};
  for (const id of allIds) {
    if (boundsMap[id]) fakeManifestMeshes[id] = boundsMap[id];
  }
  const b =
    unionBounds(
      allIds,
      fakeManifestMeshes as Parameters<typeof unionBounds>[1],
    ) ?? DEFAULT_BODY_BOUNDS;
  return anchorPoint([0.5, 0.5, 0.5], b);
}

/** Canvas-internal imperative driver advancing motion phase and mutating moving mesh transforms. */
export function MotionPlayer(): null {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const defs = useAppSelector((s) => s.motion.defs);
  const activeId = useAppSelector((s) => s.motion.activeId);
  const activationSeq = useAppSelector((s) => s.motion.activationSeq);
  const playing = useAppSelector((s) => s.motion.playing);
  const speed = useAppSelector((s) => s.motion.speed);
  const scrubPhase = useAppSelector((s) => s.motion.scrubPhase);
  const manifest = useAppSelector((s) => s.assets.manifest);
  const registry = useMeshRegistry();
  const invalidate = useThree((s) => s.invalidate);

  const def = useMemo(
    () =>
      defs && activeId ? (defs.find((d) => d.id === activeId) ?? null) : null,
    [defs, activeId],
  );

  const motionAnchor = useMemo<[number, number, number]>(() => {
    if (!def) return [0, 0, 0];
    if (def.kind === 'hinge') {
      const pivotEntry = manifest?.meshes[def.pivot.mesh];
      return anchorPoint(
        def.pivot.anchor,
        pivotEntry?.bounds ?? DEFAULT_BODY_BOUNDS,
      );
    }
    return manifest
      ? pulseCenterFor(def, manifest.meshes)
      : anchorPoint([0.5, 0.5, 0.5], DEFAULT_BODY_BOUNDS);
  }, [def, manifest]);

  const transformsRef = useRef<ReturnType<
    typeof createMotionTransforms
  > | null>(null);
  const pulseBufferRef = useRef<{ ids: readonly string[]; scale: number }[]>(
    [],
  );
  const phaseRef = useRef(scrubPhase);
  const lastDirRef = useRef<'flex' | 'extend' | null>(null);

  useEffect(() => {
    if (!transformsRef.current) {
      transformsRef.current = createMotionTransforms(registry);
    }
    const transforms = transformsRef.current;

    if (!def) {
      pulseBufferRef.current = [];
      transforms.restore();
      motionPhase.set(0);
      lastDirRef.current = null;
      sectionMaterialLibrary.get()?.setActivePulse(0.25);
      invalidate();
      return;
    }

    pulseBufferRef.current =
      def.kind === 'pulse'
        ? def.groups.map((g) => ({ ids: g.meshes, scale: 1 }))
        : [];

    const ids = movingIdsFor(def);
    const applyAtPhase = (p: number) => {
      if (def.kind === 'hinge') {
        const angle = hingeAngleDeg(p, def.range);
        transforms.applyHinge(def, motionAnchor, angle);
      } else {
        const buf = pulseBufferRef.current;
        for (let i = 0; i < def.groups.length; i++) {
          buf[i].scale = heartbeatScale(p - def.groups[i].phase, def.amplitude);
        }
        transforms.applyPulse(buf, motionAnchor);
      }
      motionPhase.set(p);
    };

    let disposed = false;
    let queued = false;
    const rebindMeshes = () => {
      if (disposed) return;
      transforms.restore();
      transforms.begin(ids);
      applyAtPhase(phaseRef.current);
      invalidate();
    };

    const scheduleRebind = () => {
      if (disposed || queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        rebindMeshes();
      });
    };

    const initialPhase = store.getState().motion.scrubPhase;
    phaseRef.current = initialPhase;
    lastDirRef.current =
      def.kind === 'hinge' ? hingeDirection(initialPhase) : null;
    rebindMeshes();

    const unsubRegistry = registry.subscribe(scheduleRebind);
    return () => {
      disposed = true;
      unsubRegistry();
      transforms.restore();
      motionPhase.set(0);
      lastDirRef.current = null;
      sectionMaterialLibrary.get()?.setActivePulse(0.25);
      invalidate();
    };
  }, [def, activationSeq, motionAnchor, registry, store, invalidate]);

  useEffect(() => {
    if (!def || playing) return;
    const transforms = transformsRef.current;
    if (!transforms) return;

    phaseRef.current = scrubPhase;
    if (def.kind === 'hinge') {
      transforms.applyHinge(
        def,
        motionAnchor,
        hingeAngleDeg(scrubPhase, def.range),
      );
      sectionMaterialLibrary.get()?.setActivePulse(0.45);
    } else {
      const buf = pulseBufferRef.current;
      for (let i = 0; i < def.groups.length; i++) {
        buf[i].scale = heartbeatScale(
          scrubPhase - def.groups[i].phase,
          def.amplitude,
        );
      }
      transforms.applyPulse(buf, motionAnchor);
    }
    motionPhase.set(scrubPhase);
    invalidate();
  }, [def, playing, scrubPhase, motionAnchor, invalidate]);

  useFrame((_, delta) => {
    if (!def || !playing) return;
    const transforms = transformsRef.current;
    if (!transforms) return;

    const period = def.kind === 'hinge' ? def.periodS : 60 / def.bpm;
    const clampedDelta = Math.min(delta, 0.1);
    const nextPhase = (phaseRef.current + (clampedDelta * speed) / period) % 1;
    phaseRef.current = nextPhase;

    if (def.kind === 'hinge') {
      transforms.applyHinge(
        def,
        motionAnchor,
        hingeAngleDeg(nextPhase, def.range),
      );
      const nextDir = hingeDirection(nextPhase);
      if (nextDir !== lastDirRef.current) {
        lastDirRef.current = nextDir;
        dispatch(motionDirectionChanged(nextDir));
      }
      sectionMaterialLibrary
        .get()
        ?.setActivePulse(
          0.25 + 0.35 * (0.5 - 0.5 * Math.cos(4 * Math.PI * nextPhase)),
        );
    } else {
      const buf = pulseBufferRef.current;
      for (let i = 0; i < def.groups.length; i++) {
        buf[i].scale = heartbeatScale(
          nextPhase - def.groups[i].phase,
          def.amplitude,
        );
      }
      transforms.applyPulse(buf, motionAnchor);
    }

    motionPhase.set(nextPhase);
    invalidate();
  });

  return null;
}
