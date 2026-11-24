import type { AppThunk } from '../../app/store';
import {
  bundlesRequested,
  selectBundlesForSystem,
} from '../assets/assetsSlice';
import { waitForBundles } from '../search/revealAndFocus';
import { systemToggled } from '../systems/systemsSlice';
import { motionPhase } from './motionPhase';
import {
  motionActivated,
  motionsFailed,
  motionsLoaded,
  motionsLoading,
  motionStopped,
} from './motionSlice';
import { prefersReducedMotion } from './reducedMotion';
import { MotionsFileSchema, type MotionDef } from './schema';

const inFlightLoads = new WeakMap<object, Promise<void>>();
const startTokens = new WeakMap<object, number>();
const fallbackLoadKey = {};

function nextTokenFor(key: object): number {
  const next = (startTokens.get(key) ?? 0) + 1;
  startTokens.set(key, next);
  return next;
}

function referencedMeshIds(def: MotionDef): Set<string> {
  if (def.kind === 'hinge') {
    return new Set([
      ...def.moving,
      ...def.ghost,
      ...def.agonists.flex,
      ...def.agonists.extend,
      def.pivot.mesh,
    ]);
  }
  return new Set([
    ...(def.center ? [def.center.mesh] : []),
    ...def.groups.flatMap((g) => g.meshes),
  ]);
}

/** Fetches and validates `content/motions.json` once per store instance. */
export function loadMotions(): AppThunk<Promise<void>> {
  return (dispatch, getState, extra) => {
    const state = getState().motion;
    if (state.loadStatus === 'ready' && state.defs !== null) {
      return Promise.resolve();
    }

    const cacheKey = extra ?? fallbackLoadKey;
    const existing = inFlightLoads.get(cacheKey);
    if (existing) return existing;

    dispatch(motionsLoading());
    const promise = (async () => {
      try {
        const res = await fetch(
          `${import.meta.env.BASE_URL}content/motions.json`,
        );
        if (!res.ok) {
          dispatch(motionsFailed());
          return;
        }
        const json: unknown = await res.json();
        const parsed = MotionsFileSchema.parse(json);
        dispatch(motionsLoaded(parsed.motions));
      } catch {
        dispatch(motionsFailed());
      } finally {
        inFlightLoads.delete(cacheKey);
      }
    })();

    inFlightLoads.set(cacheKey, promise);
    return promise;
  };
}

/** Loads motion data, enables required systems, waits for bundles, moves camera, and activates the demo. */
export function startMotion(id: string): AppThunk<Promise<void>> {
  return async (dispatch, getState, extra) => {
    const cacheKey = extra ?? fallbackLoadKey;
    const token = nextTokenFor(cacheKey);

    if (getState().quiz.status !== 'off') return;

    await dispatch(loadMotions());
    if (startTokens.get(cacheKey) !== token) return;
    const stateAfterLoad = getState();
    if (stateAfterLoad.quiz.status !== 'off') return;

    const def = stateAfterLoad.motion.defs?.find((d) => d.id === id);
    if (!def) return;

    for (const sys of def.systems) {
      if (!getState().systems[sys].enabled) {
        dispatch(systemToggled(sys));
      }
    }

    const neededMeshes = referencedMeshIds(def);
    const manifestBundles = getState().assets.manifest?.bundles ?? [];
    const meshBundleIds = manifestBundles
      .filter((b) => b.meshIds.some((m) => neededMeshes.has(m)))
      .map((b) => b.id);
    const systemBundleIds = def.systems.flatMap((sys) =>
      selectBundlesForSystem(getState(), sys),
    );
    const bundleIds = Array.from(
      new Set([...systemBundleIds, ...meshBundleIds]),
    );

    const pending = bundleIds.filter(
      (bundleId) => getState().assets.bundles[bundleId] !== 'ready',
    );
    if (pending.length > 0) {
      dispatch(bundlesRequested(pending));
    }

    try {
      await waitForBundles(
        { getState, subscribe: extra?.subscribe },
        bundleIds,
      );
    } catch {
      return;
    }

    if (startTokens.get(cacheKey) !== token) return;
    if (getState().quiz.status !== 'off') return;

    await extra?.camera?.current?.goToPreset(def.view);

    if (startTokens.get(cacheKey) !== token) return;
    const stateAfterReady = getState();
    if (stateAfterReady.quiz.status !== 'off') return;
    if (def.systems.some((sys) => !stateAfterReady.systems[sys].enabled))
      return;

    const reduced = prefersReducedMotion();
    const initialPhase = reduced ? 0.25 : 0;
    motionPhase.set(initialPhase);
    dispatch(
      motionActivated({
        id: def.id,
        playing: !reduced,
        phase: initialPhase,
      }),
    );
  };
}

/** Stops the currently active motion demo and invalidates pending starts. */
export function stopMotion(): AppThunk<void> {
  return (dispatch, _getState, extra) => {
    nextTokenFor(extra ?? fallbackLoadKey);
    motionPhase.set(0);
    dispatch(motionStopped());
  };
}
