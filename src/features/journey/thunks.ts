import type { ThunkAction, UnknownAction } from '@reduxjs/toolkit';
import type { AppThunk } from '../../app/store';
import { CenterlinesFileSchema } from '../../data/centerlines';
import type { MeshId } from '../../data/ids';
import type { Locale } from '../../i18n/locale';
import { stopMotion } from '../motion/thunks';
import { prefersReducedMotion } from '../motion/reducedMotion';
import { applyViewState, captureViewState } from '../share/thunks';
import type { ViewStateV1 } from '../share/viewState';
import { exitTour } from '../tours/thunks';
import { localizeJourneyTexts } from './localizeJourneys';
import { journeyClock } from './journeyClock';
import {
  journeyEnded,
  journeyFollowingSet,
  journeyNoticeSet,
  journeyPlayingSet,
  journeyProgressSet,
  journeysFailed,
  journeysLoaded,
  journeysLoading,
  journeyStageSet,
  journeyStarted,
  journeyTextsLoaded,
  type JourneyState,
} from './journeySlice';
import { getRoute, stageAt } from './route';
import {
  JourneysFileSchema,
  JourneyTextsFileSchema,
  type Journey,
  type JourneyId,
  type JourneyTextsFile,
} from './schema';

export type OrganJourneyTarget = {
  journeyId: JourneyId;
  stageIndex: number;
};

const inFlightLoads = new WeakMap<object, Promise<void>>();
const cachedEnTexts = new WeakMap<object, JourneyTextsFile>();
const savedViews = new WeakMap<object, ViewStateV1>();
const tokens = new WeakMap<object, number>();
const organLookupCache = new WeakMap<
  Journey[],
  Map<MeshId, OrganJourneyTarget[]>
>();
const fallbackKey = {};

function keyFor(extra: unknown): object {
  return typeof extra === 'object' && extra !== null ? extra : fallbackKey;
}

function nextToken(key: object): number {
  const next = (tokens.get(key) ?? 0) + 1;
  tokens.set(key, next);
  return next;
}

async function fetchJourneyTexts(
  locale: string,
): Promise<JourneyTextsFile | null> {
  try {
    const res = await fetch(
      `${import.meta.env.BASE_URL}content/${locale}/journeys.json`,
    );
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const parsed = JourneyTextsFileSchema.safeParse(json);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Builds and caches a lookup from mesh id to its first `[journeyId, stageIndex]` entry per journey. */
export function getOrganJourneyLookup(
  defs: Journey[] | null,
): Map<MeshId, OrganJourneyTarget[]> {
  if (!defs) return new Map();
  let cached = organLookupCache.get(defs);
  if (cached) return cached;

  cached = new Map();
  for (const journey of defs) {
    const seenInJourney = new Set<MeshId>();
    for (let s = 0; s < journey.stages.length; s += 1) {
      for (const meshId of journey.stages[s].organs) {
        if (seenInJourney.has(meshId)) continue;
        seenInJourney.add(meshId);
        let list = cached.get(meshId);
        if (!list) {
          list = [];
          cached.set(meshId, list);
        }
        list.push({ journeyId: journey.id, stageIndex: s });
      }
    }
  }
  organLookupCache.set(defs, cached);
  return cached;
}

/** Returns whether a saved pre-journey view exists for `extra` (test/exit inspection). */
export function hasSavedJourneyView(extra: unknown = undefined): boolean {
  return savedViews.has(keyFor(extra));
}

/** Fetches `content/journeys.json`, `en`/active locale copy, and `manifest.centerlines` once per store. */
export function loadJourneys(): AppThunk<Promise<void>> {
  return (dispatch, getState, extra) => {
    const state = getState();
    const j = state.journey;
    if (
      j.loadStatus === 'ready' &&
      j.defs !== null &&
      j.texts !== null &&
      j.centerlines !== null
    ) {
      return Promise.resolve();
    }

    const key = keyFor(extra);
    const existing = inFlightLoads.get(key);
    if (existing) return existing;

    const centerlineFile = state.assets.manifest?.centerlines?.file;
    if (!centerlineFile) {
      dispatch(journeysFailed());
      return Promise.resolve();
    }

    const initialLocale = state.ui?.locale ?? 'en';
    dispatch(journeysLoading());

    const promise = (async () => {
      try {
        const [defsRes, enTexts, initialLocTexts, clRes] = await Promise.all([
          fetch(`${import.meta.env.BASE_URL}content/journeys.json`),
          fetchJourneyTexts('en'),
          initialLocale !== 'en'
            ? fetchJourneyTexts(initialLocale)
            : Promise.resolve(null),
          fetch(`${import.meta.env.BASE_URL}models/${centerlineFile}`),
        ]);

        if (!defsRes.ok || !enTexts || !clRes.ok) {
          dispatch(journeysFailed());
          return;
        }

        const [defsJson, clJson] = await Promise.all([
          defsRes.json() as Promise<unknown>,
          clRes.json() as Promise<unknown>,
        ]);
        const defsParsed = JourneysFileSchema.parse(defsJson);
        const centerlines = CenterlinesFileSchema.parse(clJson);
        cachedEnTexts.set(key, enTexts);

        const latestLocale = getState().ui?.locale ?? initialLocale;
        const locTexts =
          latestLocale === initialLocale
            ? initialLocTexts
            : latestLocale !== 'en'
              ? await fetchJourneyTexts(latestLocale)
              : null;

        const texts =
          latestLocale === 'en'
            ? localizeJourneyTexts(enTexts, enTexts)
            : localizeJourneyTexts(enTexts, locTexts);

        dispatch(
          journeysLoaded({
            defs: defsParsed.journeys,
            texts,
            centerlines,
          }),
        );
      } catch {
        dispatch(journeysFailed());
      } finally {
        inFlightLoads.delete(key);
      }
    })();

    inFlightLoads.set(key, promise);
    return promise;
  };
}

/** Reloads localized journey strings when the active language changes without interrupting playback. */
export function reloadJourneyTexts(
  locale: Locale,
): ThunkAction<
  Promise<void>,
  { journey?: JourneyState; ui?: { locale: Locale } },
  unknown,
  UnknownAction
> {
  return async (dispatch, getState, extra) => {
    const state = getState();
    if (!state.journey || state.journey.defs === null) return;

    const key = keyFor(extra);
    const enTexts = cachedEnTexts.get(key) ?? (await fetchJourneyTexts('en'));
    if (!enTexts) return;
    cachedEnTexts.set(key, enTexts);

    const locTexts =
      locale === 'en' ? enTexts : await fetchJourneyTexts(locale);
    if ((getState().ui?.locale ?? locale) !== locale) return;
    dispatch(journeyTextsLoaded(localizeJourneyTexts(enTexts, locTexts)));
  };
}

/** Starts journey `id` at `stage` (0-based), capturing the prior view and enforcing exclusivity. */
export function startJourney(
  id: JourneyId,
  stage = 0,
): AppThunk<Promise<'started' | 'refused' | 'not-found'>> {
  return async (dispatch, getState, extra) => {
    if (getState().quiz.status !== 'off') {
      return 'refused';
    }

    const key = keyFor(extra);
    const token = nextToken(key);

    await dispatch(loadJourneys());
    if (tokens.get(key) !== token) return 'refused';

    const state = getState();
    if (state.quiz.status !== 'off') {
      return 'refused';
    }

    if (state.journey.loadStatus === 'error') {
      dispatch(journeyNoticeSet('load-error'));
      return 'refused';
    }

    const defs = state.journey.defs;
    const centerlines = state.journey.centerlines;
    const manifest = state.assets.manifest;
    const journey = defs?.find((j) => j.id === id);

    if (
      !journey ||
      !centerlines ||
      !manifest ||
      !Number.isInteger(stage) ||
      stage < 0 ||
      stage >= journey.stages.length
    ) {
      dispatch(journeyNoticeSet('not-found'));
      return 'not-found';
    }

    if (state.tour?.activeId) {
      await dispatch(exitTour());
      if (tokens.get(key) !== token) return 'refused';
    }
    dispatch(stopMotion());

    const route = getRoute(journey, centerlines.lines, manifest.meshes);
    const reduced = prefersReducedMotion();
    const startU = reduced
      ? (route.stageStart[stage] + route.stageEnd[stage]) / 2
      : route.stageStart[stage];

    if (!savedViews.has(key)) {
      savedViews.set(key, dispatch(captureViewState({ includePins: false })));
    }

    journeyClock.set(startU);
    dispatch(
      journeyStarted({
        id: journey.id,
        stageIndex: stage,
        progress: startU,
        playing: !reduced,
        following: !reduced,
      }),
    );

    const shouldContinue = () =>
      tokens.get(key) === token && getState().journey.activeId === journey.id;

    await dispatch(
      applyViewState(journey.stages[stage].view, {
        animate: !reduced,
        keepHistory: true,
        keepPins: true,
        shouldContinue,
      }),
    );
    return 'started';
  };
}

/** Applies only the camera and visibility view of stage `index` without resetting playback clock. */
export function applyStageView(index: number): AppThunk<Promise<void>> {
  return async (dispatch, getState, extra) => {
    const key = keyFor(extra);
    const token = nextToken(key);
    const state = getState();
    const { activeId, defs } = state.journey;
    if (!activeId || !defs) return;
    const journey = defs.find((j) => j.id === activeId);
    if (!journey) return;
    const clamped = Math.max(
      0,
      Math.min(journey.stages.length - 1, Math.trunc(index)),
    );
    const reduced = prefersReducedMotion();
    await dispatch(
      applyViewState(journey.stages[clamped].view, {
        animate: !reduced,
        keepHistory: true,
        keepPins: true,
        shouldContinue: () =>
          tokens.get(key) === token && getState().journey.activeId === activeId,
      }),
    );
  };
}

/** Jumps to clamped stage `index`, syncing clock/progress and applying the stage view. */
export function goToStage(index: number): AppThunk<Promise<void>> {
  return async (dispatch, getState, extra) => {
    const key = keyFor(extra);
    const token = nextToken(key);
    const state = getState();
    const { activeId, defs, centerlines } = state.journey;
    const manifest = state.assets.manifest;
    if (!activeId || !defs || !centerlines || !manifest) return;

    const journey = defs.find((j) => j.id === activeId);
    if (!journey || journey.stages.length === 0) return;

    const clamped = Math.max(
      0,
      Math.min(journey.stages.length - 1, Math.trunc(index)),
    );
    const route = getRoute(journey, centerlines.lines, manifest.meshes);
    const reduced = prefersReducedMotion();
    const targetU = reduced
      ? (route.stageStart[clamped] + route.stageEnd[clamped]) / 2
      : route.stageStart[clamped];

    journeyClock.set(targetU);
    dispatch(journeyStageSet(clamped));
    dispatch(journeyProgressSet(targetU));
    if (!reduced) {
      dispatch(journeyFollowingSet(true));
    }

    await dispatch(
      applyViewState(journey.stages[clamped].view, {
        animate: !reduced,
        keepHistory: true,
        keepPins: true,
        shouldContinue: () =>
          tokens.get(key) === token && getState().journey.activeId === activeId,
      }),
    );
  };
}

/** Advances to the next stage or exits on the last stage ("Finish"). */
export function nextStage(): AppThunk<Promise<void>> {
  return async (dispatch, getState) => {
    const { activeId, stageIndex, defs } = getState().journey;
    if (!activeId || !defs) return;
    const journey = defs.find((j) => j.id === activeId);
    if (!journey) return;

    if (stageIndex + 1 >= journey.stages.length) {
      await dispatch(exitJourney());
      return;
    }
    await dispatch(goToStage(stageIndex + 1));
  };
}

/** Steps back to the previous stage when not at stage 0. */
export function prevStage(): AppThunk<Promise<void>> {
  return async (dispatch, getState) => {
    const { activeId, stageIndex } = getState().journey;
    if (!activeId || stageIndex <= 0) return;
    await dispatch(goToStage(stageIndex - 1));
  };
}

/** Pauses, scrubs clock and progress to `u`, and applies a new stage view only if the stage changed. */
export function scrubJourney(u: number): AppThunk<Promise<void>> {
  return async (dispatch, getState, extra) => {
    const state = getState();
    const { activeId, defs, centerlines, stageIndex } = state.journey;
    const manifest = state.assets.manifest;
    if (!activeId || !defs || !centerlines || !manifest) return;

    const journey = defs.find((j) => j.id === activeId);
    if (!journey) return;

    const clamped = Number.isFinite(u) ? Math.min(1, Math.max(0, u)) : 0;
    dispatch(journeyPlayingSet(false));
    journeyClock.set(clamped);
    dispatch(journeyProgressSet(clamped));

    const route = getRoute(journey, centerlines.lines, manifest.meshes);
    const nextStageIndex = stageAt(route, clamped);
    if (nextStageIndex === stageIndex) return;

    const key = keyFor(extra);
    const token = nextToken(key);
    dispatch(journeyStageSet(nextStageIndex));

    const reduced = prefersReducedMotion();
    await dispatch(
      applyViewState(journey.stages[nextStageIndex].view, {
        animate: !reduced,
        keepHistory: true,
        keepPins: true,
        shouldContinue: () =>
          tokens.get(key) === token && getState().journey.activeId === activeId,
      }),
    );
  };
}

/** Exits the active journey, stops camera following, and restores the saved pre-journey view. */
export function exitJourney(): AppThunk<Promise<void>> {
  return async (dispatch, getState, extra) => {
    const key = keyFor(extra);
    const token = nextToken(key);

    extra.camera?.current?.followTarget?.(null);
    const savedView = savedViews.get(key);
    savedViews.delete(key);

    journeyClock.set(0);
    dispatch(journeyEnded());

    if (savedView) {
      const reduced = prefersReducedMotion();
      await dispatch(
        applyViewState(savedView, {
          animate: !reduced,
          keepHistory: true,
          keepPins: true,
          shouldContinue: () =>
            tokens.get(key) === token && getState().journey.activeId === null,
        }),
      );
    }
  };
}
