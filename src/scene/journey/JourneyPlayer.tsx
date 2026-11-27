import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { useStore } from 'react-redux';
import { Vector3 } from 'three';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import type { RootState } from '../../app/store';
import { journeyClock } from '../../features/journey/journeyClock';
import {
  journeyPlayingSet,
  journeyProgressSet,
  journeyStageSet,
} from '../../features/journey/journeySlice';
import { getRoute, localProgress, stageAt } from '../../features/journey/route';
import { applyStageView } from '../../features/journey/thunks';
import { prefersReducedMotion } from '../../features/motion/reducedMotion';
import { selectBundlesForSystem } from '../../features/assets/assetsSlice';
import { useCameraApi } from '../camera';
import { sectionMaterialLibrary } from '../sectionPlaneStore';
import { BITE_LOOKS, cloneLook, lerpLook } from './biteLook';
import { journeyLayerProbe } from '../../features/journey/journeyLayerProbe';
import {
  advanceJourneyProgress,
  buildCenterlineTable,
  createJourneyLayer,
  type CenterlineTable,
  type JourneyLayer,
} from './JourneyLayer';

const PROGRESS_THROTTLE_MS = 250;
const SECRETE_WINDOW_S = 1.2;
const DROPLET_DURATION_S = 3;

/** Canvas-internal imperative driver for journey route, bite, peristalsis, droplets, and follow. */
export function JourneyPlayer(): null {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const cameraApi = useCameraApi();

  const defs = useAppSelector((s) => s.journey.defs);
  const centerlines = useAppSelector((s) => s.journey.centerlines);
  const activeId = useAppSelector((s) => s.journey.activeId);
  const playing = useAppSelector((s) => s.journey.playing);
  const speed = useAppSelector((s) => s.journey.speed);
  const stageIndex = useAppSelector((s) => s.journey.stageIndex);
  const manifest = useAppSelector((s) => s.assets.manifest);
  const bundles = useAppSelector((s) => s.assets.bundles);
  const contentIndex = useAppSelector((s) => s.content.index);

  const journey = useMemo(
    () =>
      defs && activeId ? (defs.find((d) => d.id === activeId) ?? null) : null,
    [defs, activeId],
  );

  const stageSystems = journey?.stages[stageIndex]?.view.s;
  const requiredBundles = useMemo(() => {
    if (
      !stageSystems ||
      stageSystems.length === 0 ||
      !manifest ||
      !contentIndex
    ) {
      return [];
    }
    const state = store.getState();
    const set = new Set<string>();
    for (const sys of stageSystems) {
      for (const id of selectBundlesForSystem(state, sys)) {
        set.add(id);
      }
    }
    return [...set];
  }, [stageSystems, manifest, contentIndex, store]);
  const stageBundlesReady =
    requiredBundles.length === 0 ||
    requiredBundles.every((id) => bundles[id] === 'ready');

  const route = useMemo(() => {
    if (!journey || !centerlines || !manifest) return null;
    return getRoute(journey, centerlines.lines, manifest.meshes);
  }, [journey, centerlines, manifest]);

  const durationsS = useMemo(
    () => (journey ? journey.stages.map((s) => s.durationS) : []),
    [journey],
  );

  const viaTables = useMemo(() => {
    const map = new Map<string, CenterlineTable>();
    if (!journey || !centerlines) return map;
    for (const st of journey.stages) {
      for (const ev of st.events ?? []) {
        if (ev.via && centerlines.lines[ev.via] && !map.has(ev.via)) {
          map.set(ev.via, buildCenterlineTable(centerlines.lines[ev.via]));
        }
      }
    }
    return map;
  }, [journey, centerlines]);

  const layerRef = useRef<JourneyLayer | null>(null);
  const timeRef = useRef(0);
  const lastCommitMsRef = useRef(0);
  const lastStageRef = useRef(stageIndex);
  const stageEnterCooldownRef = useRef(0.5);
  const pulseWasOpenRef = useRef(false);
  const bitePosRef = useRef(new Vector3());
  const followTupleRef = useRef<[number, number, number]>([0, 0, 0]);
  const curRadiusRef = useRef(journey?.stages[stageIndex]?.radius ?? 0.008);
  const curLookRef = useRef(
    cloneLook(BITE_LOOKS[journey?.stages[stageIndex]?.look ?? 'bolus']),
  );
  const fromLookRef = useRef(
    cloneLook(BITE_LOOKS[journey?.stages[stageIndex]?.look ?? 'bolus']),
  );
  const lookGoalRef = useRef(journey?.stages[stageIndex]?.look ?? 'bolus');
  const lookBlendRef = useRef(1);
  const streamRef = useRef({
    active: false,
    via: '',
    remainingS: 0,
    phase: 0,
  });
  const firedEventsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (stageIndex !== lastStageRef.current) {
      lastStageRef.current = stageIndex;
      stageEnterCooldownRef.current = 0.55;
      streamRef.current.active = false;
      firedEventsRef.current.clear();
    }
  }, [stageIndex]);

  useEffect(() => {
    if (!route || !journey) return undefined;
    const layer = createJourneyLayer(route);
    layerRef.current = layer;
    journeyLayerProbe.setReader(() => layer.visibleDrawCalls());
    scene.add(layer.group);

    const st = journey.stages[store.getState().journey.stageIndex] ?? journey.stages[0];
    curRadiusRef.current = st.radius;
    fromLookRef.current.color.copy(BITE_LOOKS[st.look].color);
    fromLookRef.current.roughness = BITE_LOOKS[st.look].roughness;
    fromLookRef.current.transmission = BITE_LOOKS[st.look].transmission;
    curLookRef.current.color.copy(BITE_LOOKS[st.look].color);
    curLookRef.current.roughness = BITE_LOOKS[st.look].roughness;
    curLookRef.current.transmission = BITE_LOOKS[st.look].transmission;
    lookGoalRef.current = st.look;
    lookBlendRef.current = 1;

    const u = journeyClock.get();
    route.pointAt(u, bitePosRef.current);
    layer.updateProgress(u);
    layer.updateBite(bitePosRef.current, st.radius, curLookRef.current);
    invalidate();

    return () => {
      scene.remove(layer.group);
      layer.dispose();
      journeyLayerProbe.setReader(null);
      layerRef.current = null;
      sectionMaterialLibrary.get()?.setActivePulse(0.25);
      cameraApi.followTarget(null);
      invalidate();
    };
  }, [route, journey, scene, invalidate, store, cameraApi]);

  useEffect(() => {
    if (playing || !route) return undefined;
    return journeyClock.subscribe(() => {
      const layer = layerRef.current;
      if (!layer) return;
      const u = journeyClock.get();
      route.pointAt(u, bitePosRef.current);
      layer.updateProgress(u);
      const s = stageAt(route, u);
      const st = journey?.stages[s];
      if (st) {
        const reduced = prefersReducedMotion();
        layer.updateBite(bitePosRef.current, st.radius, BITE_LOOKS[st.look]);
        layer.updateRings(
          !reduced && st.motion === 'squeeze',
          route,
          u,
          st.radius,
          timeRef.current,
        );
      }
      invalidate();
    });
  }, [playing, route, journey, invalidate]);

  useFrame((_, delta) => {
    const layer = layerRef.current;
    if (!layer || !route || !journey) return;

    const dt = Math.min(Math.max(0, delta), 0.1);
    const reduced = prefersReducedMotion();
    let u = journeyClock.get();
    let needsFrame = false;

    if (playing && !reduced && stageBundlesReady) {
      timeRef.current += dt * speed;
      u = advanceJourneyProgress(route, durationsS, u, dt, speed);
      journeyClock.set(u);
      needsFrame = true;

      const sNext = stageAt(route, u);
      if (sNext !== lastStageRef.current) {
        lastStageRef.current = sNext;
        if (sNext !== store.getState().journey.stageIndex) {
          stageEnterCooldownRef.current = 0.55;
          firedEventsRef.current.clear();
          streamRef.current.active = false;
          dispatch(journeyStageSet(sNext));
          dispatch(journeyProgressSet(u));
          lastCommitMsRef.current = performance.now();
          void dispatch(applyStageView(sNext));
        }
      } else {
        const now = performance.now();
        if (now - lastCommitMsRef.current >= PROGRESS_THROTTLE_MS) {
          lastCommitMsRef.current = now;
          dispatch(journeyProgressSet(u));
        }
      }

      if (u >= 1) {
        dispatch(journeyProgressSet(1));
        dispatch(journeyPlayingSet(false));
      }
    }

    const s = stageAt(route, u);
    const stage = journey.stages[s];
    if (!stage) return;

    if (reduced) {
      curRadiusRef.current = stage.radius;
      const targetLook = BITE_LOOKS[stage.look];
      fromLookRef.current.color.copy(targetLook.color);
      fromLookRef.current.roughness = targetLook.roughness;
      fromLookRef.current.transmission = targetLook.transmission;
      curLookRef.current.color.copy(targetLook.color);
      curLookRef.current.roughness = targetLook.roughness;
      curLookRef.current.transmission = targetLook.transmission;
      lookGoalRef.current = stage.look;
      lookBlendRef.current = 1;
    } else {
      // Smoothly ease radius toward current stage's target radius
      const radiusDiff = stage.radius - curRadiusRef.current;
      if (Math.abs(radiusDiff) > 1e-5) {
        curRadiusRef.current += radiusDiff * Math.min(1, dt * 8);
        needsFrame = true;
      } else {
        curRadiusRef.current = stage.radius;
      }

      // Smoothly ease look toward current stage's target look
      if (lookGoalRef.current !== stage.look) {
        fromLookRef.current.color.copy(curLookRef.current.color);
        fromLookRef.current.roughness = curLookRef.current.roughness;
        fromLookRef.current.transmission = curLookRef.current.transmission;
        lookGoalRef.current = stage.look;
        lookBlendRef.current = 0;
      }
      if (lookBlendRef.current < 1) {
        lookBlendRef.current = Math.min(1, lookBlendRef.current + dt * 2.5);
        lerpLook(
          fromLookRef.current,
          BITE_LOOKS[stage.look],
          lookBlendRef.current,
          curLookRef.current,
        );
        needsFrame = true;
      }
    }

    const wobble =
      !reduced && stage.motion === 'churn'
        ? 1 + 0.08 * Math.sin(timeRef.current * 9)
        : 1;

    route.pointAt(u, bitePosRef.current);
    layer.updateProgress(u);
    layer.updateBite(
      bitePosRef.current,
      curRadiusRef.current * wobble,
      curLookRef.current,
    );

    layer.updateRings(
      !reduced && stage.motion === 'squeeze',
      route,
      u,
      curRadiusRef.current,
      timeRef.current,
    );

    // Handle secrete/highlight pulse + droplet streams along ducts
    const lp = localProgress(route, s, u);
    const events = stage.events ?? [];
    let anyOpen = false;
    for (let i = 0; i < events.length; i += 1) {
      const ev = events[i];
      const windowEnd = ev.at + SECRETE_WINDOW_S / stage.durationS;
      if (lp >= ev.at && lp <= windowEnd) {
        anyOpen = true;
      }
      if (!reduced && ev.kind === 'secrete' && ev.via) {
        if (lp >= ev.at && !firedEventsRef.current.has(i)) {
          firedEventsRef.current.add(i);
          streamRef.current.active = true;
          streamRef.current.via = ev.via;
          streamRef.current.remainingS = DROPLET_DURATION_S;
          streamRef.current.phase = 0;
        }
      }
    }

    const matLib = sectionMaterialLibrary.get();
    if (playing && !reduced && anyOpen) {
      pulseWasOpenRef.current = true;
      const pulse = 0.25 + 0.35 * (0.5 - 0.5 * Math.cos(timeRef.current * 6));
      matLib?.setActivePulse(pulse);
      needsFrame = true;
    } else if (!reduced && anyOpen) {
      if (!pulseWasOpenRef.current) {
        pulseWasOpenRef.current = true;
        matLib?.setActivePulse(0.45);
      }
    } else if (pulseWasOpenRef.current) {
      pulseWasOpenRef.current = false;
      matLib?.setActivePulse(0.25);
    }

    if (
      !reduced &&
      streamRef.current.active &&
      streamRef.current.remainingS > 0
    ) {
      if (playing) {
        streamRef.current.remainingS -= dt * speed;
        streamRef.current.phase += dt * speed;
        needsFrame = true;
      }
      const table = viaTables.get(streamRef.current.via) ?? null;
      layer.updateDroplets(table, streamRef.current.phase);
    } else {
      streamRef.current.active = false;
      layer.updateDroplets(null, 0);
    }

    if (stageBundlesReady && stageEnterCooldownRef.current > 0) {
      stageEnterCooldownRef.current -= dt;
    }
    if (
      store.getState().journey.following &&
      playing &&
      !reduced &&
      stageBundlesReady &&
      stageEnterCooldownRef.current <= 0
    ) {
      followTupleRef.current[0] = bitePosRef.current.x;
      followTupleRef.current[1] = bitePosRef.current.y;
      followTupleRef.current[2] = bitePosRef.current.z;
      cameraApi.followTarget(followTupleRef.current);
    }

    if (needsFrame) {
      invalidate();
    }
  });

  return null;
}
