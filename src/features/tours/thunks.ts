import type { ThunkAction, UnknownAction } from '@reduxjs/toolkit';
import type { AppThunk } from '../../app/store';
import type { Locale } from '../../i18n/locale';
import { motionPaused } from '../motion/motionSlice';
import { startMotion, stopMotion } from '../motion/thunks';
import { applyViewState, captureViewState } from '../share/thunks';
import { localizeTourTexts } from './localizeTours';
import {
  ToursFileSchema,
  TourTextsFileSchema,
  type TourId,
  type TourTextsFile,
} from './schema';
import {
  tourEnded,
  tourNoticeSet,
  toursFailed,
  toursLoaded,
  toursLoading,
  tourStarted,
  tourStepSet,
  tourTextsLoaded,
  type TourState,
} from './tourSlice';

export type TourMotionApi = {
  startMotion: (
    id: string,
    opts?: { skipCamera?: boolean; phase?: number },
  ) => AppThunk<Promise<void>>;
  stopMotion: () => AppThunk<void>;
};

const defaultMotionApi: TourMotionApi = {
  startMotion,
  stopMotion,
};

const inFlightLoads = new WeakMap<object, Promise<void>>();
const cachedEnTexts = new WeakMap<object, TourTextsFile>();
const stepTokens = new WeakMap<object, number>();
const fallbackKey = {};

function nextToken(key: object): number {
  const next = (stepTokens.get(key) ?? 0) + 1;
  stepTokens.set(key, next);
  return next;
}

async function fetchTourTexts(locale: string): Promise<TourTextsFile | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}content/${locale}/tours.json`);
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const parsed = TourTextsFileSchema.safeParse(json);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Fetches `content/tours.json`, English tour copy, and the active locale overlay once per store. */
export function loadTours(): AppThunk<Promise<void>> {
  return (dispatch, getState, extra) => {
    const state = getState();
    if (
      state.tour.loadStatus === 'ready' &&
      state.tour.defs !== null &&
      state.tour.texts !== null
    ) {
      return Promise.resolve();
    }

    const key = extra ?? fallbackKey;
    const existing = inFlightLoads.get(key);
    if (existing) return existing;

    const initialLocale = state.ui?.locale ?? 'en';
    dispatch(toursLoading());

    const promise = (async () => {
      try {
        const [defsRes, enTexts, initialLocTexts] = await Promise.all([
          fetch(`${import.meta.env.BASE_URL}content/tours.json`),
          fetchTourTexts('en'),
          initialLocale !== 'en'
            ? fetchTourTexts(initialLocale)
            : Promise.resolve(null),
        ]);
        if (!defsRes.ok || !enTexts) {
          dispatch(toursFailed());
          return;
        }
        const defsJson: unknown = await defsRes.json();
        const defsParsed = ToursFileSchema.parse(defsJson);
        cachedEnTexts.set(key, enTexts);

        const latestLocale = getState().ui?.locale ?? initialLocale;
        const locTexts =
          latestLocale === initialLocale
            ? initialLocTexts
            : latestLocale !== 'en'
              ? await fetchTourTexts(latestLocale)
              : null;

        const localized =
          latestLocale === 'en'
            ? localizeTourTexts(enTexts, enTexts)
            : localizeTourTexts(enTexts, locTexts);
        dispatch(toursLoaded({ defs: defsParsed.tours, texts: localized }));
      } catch {
        dispatch(toursFailed());
      } finally {
        inFlightLoads.delete(key);
      }
    })();

    inFlightLoads.set(key, promise);
    return promise;
  };
}

/** Reloads localized tour strings when the active language changes without interrupting playback. */
export function reloadTourTexts(
  locale: Locale,
): ThunkAction<
  Promise<void>,
  { tour?: TourState; ui?: { locale: Locale } },
  unknown,
  UnknownAction
> {
  return async (dispatch, getState, extra) => {
    const state = getState();
    if (!state.tour || state.tour.defs === null) return;

    const key = typeof extra === 'object' && extra !== null ? extra : fallbackKey;
    const enTexts = cachedEnTexts.get(key) ?? (await fetchTourTexts('en'));
    if (!enTexts) return;
    cachedEnTexts.set(key, enTexts);

    const locTexts = locale === 'en' ? enTexts : await fetchTourTexts(locale);
    if ((getState().ui?.locale ?? locale) !== locale) return;
    dispatch(tourTextsLoaded(localizeTourTexts(enTexts, locTexts)));
  };
}

/** Applies a single tour step's view and optional motion state. */
export function goToStep(
  index: number,
  motionApi: TourMotionApi = defaultMotionApi,
): AppThunk<Promise<void>> {
  return async (dispatch, getState, extra) => {
    const key = extra ?? fallbackKey;
    const token = nextToken(key);
    const state = getState();
    const { activeId, defs } = state.tour;
    if (!activeId || !defs) return;
    const tour = defs.find((t) => t.id === activeId);
    if (!tour || tour.steps.length === 0) return;

    const clamped = Math.max(0, Math.min(tour.steps.length - 1, index));
    const step = tour.steps[clamped];
    dispatch(tourStepSet(clamped));

    const shouldContinue = (): boolean =>
      stepTokens.get(key) === token && getState().tour.activeId === activeId;

    await dispatch(
      applyViewState(step.view, {
        animate: true,
        keepHistory: true,
        keepPins: true,
        shouldContinue,
      }),
    );

    if (!shouldContinue()) {
      return;
    }

    if (step.motion) {
      await dispatch(
        motionApi.startMotion(step.motion.id, {
          skipCamera: true,
          ...(step.motion.phase !== undefined
            ? { phase: step.motion.phase }
            : {}),
        }),
      );
      if (!shouldContinue()) {
        return;
      }
      if (step.motion.play !== true) {
        const phase = step.motion.phase ?? 0.25;
        dispatch(motionPaused(phase));
      }
    } else {
      dispatch(motionApi.stopMotion());
    }
  };
}

/** Starts a guided tour at `stepIndex`, capturing the current view for restoration on exit. */
export function startTour(
  id: TourId,
  stepIndex = 0,
  motionApi: TourMotionApi = defaultMotionApi,
): AppThunk<Promise<'started' | 'refused' | 'not-found'>> {
  return async (dispatch, getState) => {
    const state = getState();
    if (state.quiz.status !== 'off' || state.journey?.activeId != null) {
      return 'refused';
    }

    const tour = state.tour.defs?.find((t) => t.id === id);
    if (
      !tour ||
      !Number.isInteger(stepIndex) ||
      stepIndex < 0 ||
      stepIndex >= tour.steps.length
    ) {
      dispatch(tourNoticeSet('not-found'));
      return 'not-found';
    }

    const savedView =
      state.tour.savedView ?? dispatch(captureViewState({ includePins: false }));
    dispatch(tourStarted({ id, savedView }));
    await dispatch(goToStep(stepIndex, motionApi));
    return 'started';
  };
}

/** Exits the active tour, stops any running motion demo, and restores the pre-tour view. */
export function exitTour(
  motionApi: TourMotionApi = defaultMotionApi,
): AppThunk<Promise<void>> {
  return async (dispatch, getState, extra) => {
    const key = extra ?? fallbackKey;
    const token = nextToken(key);
    dispatch(motionApi.stopMotion());
    const savedView = getState().tour.savedView;
    dispatch(tourEnded());
    if (savedView) {
      await dispatch(
        applyViewState(savedView, {
          animate: true,
          keepHistory: true,
          keepPins: true,
          shouldContinue: () =>
            stepTokens.get(key) === token &&
            getState().tour.activeId === null,
        }),
      );
    }
  };
}

/** Advances to the next step or exits the tour when already on the final step. */
export function nextStep(
  motionApi: TourMotionApi = defaultMotionApi,
): AppThunk<Promise<void>> {
  return async (dispatch, getState) => {
    const { activeId, stepIndex, defs } = getState().tour;
    if (!activeId || !defs) return;
    const tour = defs.find((t) => t.id === activeId);
    if (!tour) return;

    if (stepIndex + 1 >= tour.steps.length) {
      await dispatch(exitTour(motionApi));
      return;
    }
    await dispatch(goToStep(stepIndex + 1, motionApi));
  };
}

/** Steps back to the previous step when not at the beginning of the tour. */
export function prevStep(
  motionApi: TourMotionApi = defaultMotionApi,
): AppThunk<Promise<void>> {
  return async (dispatch, getState) => {
    const { activeId, stepIndex } = getState().tour;
    if (!activeId || stepIndex <= 0) return;
    await dispatch(goToStep(stepIndex - 1, motionApi));
  };
}
