import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { useStore } from 'react-redux';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import type { RootState } from '../app/store';
import {
  anchorPoint,
  breathEnvelope,
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
  if (def.kind === 'breath') {
    return [
      ...def.expand.flatMap((g) => g.meshes),
      ...(def.shift ?? []).flatMap((s) => s.meshes),
    ];
  }
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
    if (def.kind === 'pulse') {
      return manifest
        ? pulseCenterFor(def, manifest.meshes)
        : anchorPoint([0.5, 0.5, 0.5], DEFAULT_BODY_BOUNDS);
    }
    return [0, 0, 0];
  }, [def, manifest]);

  const breathCenters = useMemo<readonly [number, number, number][]>(() => {
    if (!def || def.kind !== 'breath') return [];
    return def.expand.map((g) => {
      const bounds =
        manifest?.meshes[g.center.mesh]?.bounds ?? DEFAULT_BODY_BOUNDS;
      return anchorPoint(g.center.anchor, bounds);
    });
  }, [def, manifest]);

  const transformsRef = useRef<ReturnType<
    typeof createMotionTransforms
  > | null>(null);
  const pulseBufferRef = useRef<{ ids: readonly string[]; scale: number }[]>(
    [],
  );
  const breathGroupsBufRef = useRef<
    {
      ids: readonly string[];
      center: readonly [number, number, number];
      scale: number;
    }[]
  >([]);
  const breathShiftsBufRef = useRef<
    { ids: readonly string[]; offset: [number, number, number] }[]
  >([]);
  const phaseRef = useRef(scrubPhase);
  const lastDirRef = useRef<'flex' | 'extend' | null>(null);

  useEffect(() => {
    if (!transformsRef.current) {
      transformsRef.current = createMotionTransforms(registry);
    }
    const transforms = transformsRef.current;

    if (!def) {
      pulseBufferRef.current = [];
      breathGroupsBufRef.current = [];
      breathShiftsBufRef.current = [];
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
    breathGroupsBufRef.current =
      def.kind === 'breath'
        ? def.expand.map((g, i) => ({
            ids: g.meshes,
            center: breathCenters[i] ?? [0, 0, 0],
            scale: 1,
          }))
        : [];
    breathShiftsBufRef.current =
      def.kind === 'breath'
        ? (def.shift ?? []).map((s) => ({
            ids: s.meshes,
            offset: [0, 0, 0] as [number, number, number],
          }))
        : [];

    const ids = movingIdsFor(def);
    const applyAtPhase = (p: number) => {
      if (def.kind === 'hinge') {
        const angle = hingeAngleDeg(p, def.range);
        transforms.applyHinge(def, motionAnchor, angle);
      } else if (def.kind === 'pulse') {
        const buf = pulseBufferRef.current;
        for (let i = 0; i < def.groups.length; i++) {
          buf[i].scale = heartbeatScale(p - def.groups[i].phase, def.amplitude);
        }
        transforms.applyPulse(buf, motionAnchor);
      } else {
        const e = breathEnvelope(p, def.inhaleShare);
        const gBuf = breathGroupsBufRef.current;
        for (let i = 0; i < def.expand.length; i++) {
          gBuf[i].scale = 1 + def.expand[i].amount * e;
        }
        const sBuf = breathShiftsBufRef.current;
        const shifts = def.shift ?? [];
        for (let i = 0; i < shifts.length; i++) {
          const off = shifts[i].offset;
          sBuf[i].offset[0] = off[0] * e;
          sBuf[i].offset[1] = off[1] * e;
          sBuf[i].offset[2] = off[2] * e;
        }
        transforms.applyBreath(gBuf, sBuf);
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
  }, [def, activationSeq, motionAnchor, breathCenters, registry, store, invalidate]);

  useEffect(() => {
    if (!def || playing) return;
    const transforms = transformsRef.current;
    if (!transforms) return;

    const applyPausedPhase = (phase: number) => {
      phaseRef.current = phase;
      if (def.kind === 'hinge') {
        transforms.applyHinge(
          def,
          motionAnchor,
          hingeAngleDeg(phase, def.range),
        );
        sectionMaterialLibrary.get()?.setActivePulse(0.45);
      } else if (def.kind === 'pulse') {
        const buf = pulseBufferRef.current;
        for (let i = 0; i < def.groups.length; i++) {
          buf[i].scale = heartbeatScale(
            phase - def.groups[i].phase,
            def.amplitude,
          );
        }
        transforms.applyPulse(buf, motionAnchor);
      } else {
        const e = breathEnvelope(phase, def.inhaleShare);
        const gBuf = breathGroupsBufRef.current;
        for (let i = 0; i < def.expand.length; i++) {
          gBuf[i].scale = 1 + def.expand[i].amount * e;
        }
        const sBuf = breathShiftsBufRef.current;
        const shifts = def.shift ?? [];
        for (let i = 0; i < shifts.length; i++) {
          const off = shifts[i].offset;
          sBuf[i].offset[0] = off[0] * e;
          sBuf[i].offset[1] = off[1] * e;
          sBuf[i].offset[2] = off[2] * e;
        }
        transforms.applyBreath(gBuf, sBuf);
      }
    };

    applyPausedPhase(scrubPhase);
    motionPhase.set(scrubPhase);
    invalidate();

    return motionPhase.subscribe(() => {
      applyPausedPhase(motionPhase.get());
      invalidate();
    });
  }, [def, playing, scrubPhase, motionAnchor, invalidate]);

  useFrame((_, delta) => {
    if (!def || !playing) return;
    const transforms = transformsRef.current;
    if (!transforms) return;

    const period =
      def.kind === 'hinge'
        ? def.periodS
        : def.kind === 'pulse'
          ? 60 / def.bpm
          : 60 / def.breathsPerMin;
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
    } else if (def.kind === 'pulse') {
      const buf = pulseBufferRef.current;
      for (let i = 0; i < def.groups.length; i++) {
        buf[i].scale = heartbeatScale(
          nextPhase - def.groups[i].phase,
          def.amplitude,
        );
      }
      transforms.applyPulse(buf, motionAnchor);
    } else {
      const e = breathEnvelope(nextPhase, def.inhaleShare);
      const gBuf = breathGroupsBufRef.current;
      for (let i = 0; i < def.expand.length; i++) {
        gBuf[i].scale = 1 + def.expand[i].amount * e;
      }
      const sBuf = breathShiftsBufRef.current;
      const shifts = def.shift ?? [];
      for (let i = 0; i < shifts.length; i++) {
        const off = shifts[i].offset;
        sBuf[i].offset[0] = off[0] * e;
        sBuf[i].offset[1] = off[1] * e;
        sBuf[i].offset[2] = off[2] * e;
      }
      transforms.applyBreath(gBuf, sBuf);
    }

    motionPhase.set(nextPhase);
    invalidate();
  });

  return null;
}
