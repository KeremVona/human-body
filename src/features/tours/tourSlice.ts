import {
  createSelector,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';
import type { ViewStateV1 } from '../share/viewState';
import type { TourText } from './localizeTours';
import type { Tour, TourId } from './schema';

export type TourNotice = 'not-found' | null;

export type TourState = {
  defs: Tour[] | null;
  texts: Record<TourId, TourText> | null;
  loadStatus: 'idle' | 'loading' | 'ready' | 'error';
  activeId: TourId | null;
  stepIndex: number;
  savedView: ViewStateV1 | null;
  notice: TourNotice;
};

const initialState: TourState = {
  defs: null,
  texts: null,
  loadStatus: 'idle',
  activeId: null,
  stepIndex: 0,
  savedView: null,
  notice: null,
};

const tourSlice = createSlice({
  name: 'tour',
  initialState,
  reducers: {
    toursLoading(state) {
      state.loadStatus = 'loading';
    },
    toursLoaded(
      state,
      action: PayloadAction<{
        defs: Tour[];
        texts: Record<TourId, TourText>;
      }>,
    ) {
      state.defs = action.payload.defs;
      state.texts = action.payload.texts;
      state.loadStatus = 'ready';
    },
    tourTextsLoaded(state, action: PayloadAction<Record<TourId, TourText>>) {
      state.texts = action.payload;
    },
    toursFailed(state) {
      state.loadStatus = 'error';
    },
    tourStarted(
      state,
      action: PayloadAction<{ id: TourId; savedView: ViewStateV1 }>,
    ) {
      state.activeId = action.payload.id;
      state.savedView = action.payload.savedView;
      state.stepIndex = 0;
      state.notice = null;
    },
    tourStepSet(state, action: PayloadAction<number>) {
      state.stepIndex = action.payload;
    },
    tourEnded(state) {
      state.activeId = null;
      state.stepIndex = 0;
      state.savedView = null;
    },
    tourNoticeSet(state, action: PayloadAction<TourNotice>) {
      state.notice = action.payload;
    },
    tourNoticeDismissed(state) {
      state.notice = null;
    },
  },
});

export const tourReducer = tourSlice.reducer;
export const {
  toursLoading,
  toursLoaded,
  tourTextsLoaded,
  toursFailed,
  tourStarted,
  tourStepSet,
  tourEnded,
  tourNoticeSet,
  tourNoticeDismissed,
} = tourSlice.actions;

/** Returns true when a guided tour is currently active. */
export function selectTourActive(state: { tour: TourState }): boolean {
  return state.tour.activeId !== null;
}

export type ActiveTourStepView = {
  tourId: TourId;
  index: number;
  count: number;
  tourTitle: string;
  title: string;
  body: string;
  fallback: boolean;
};

/** Selects localized display fields for the active tour step, or `null` when inactive. */
export const selectCurrentStep = createSelector(
  (state: { tour: TourState }) => state.tour.activeId,
  (state: { tour: TourState }) => state.tour.stepIndex,
  (state: { tour: TourState }) => state.tour.defs,
  (state: { tour: TourState }) => state.tour.texts,
  (activeId, stepIndex, defs, texts): ActiveTourStepView | null => {
    if (!activeId || !defs) return null;
    const tour = defs.find((t) => t.id === activeId);
    if (!tour || stepIndex < 0 || stepIndex >= tour.steps.length) return null;
    const step = tour.steps[stepIndex];
    const tourText = texts?.[activeId];
    const stepText = tourText?.steps?.[step.id];
    return {
      tourId: activeId,
      index: stepIndex,
      count: tour.steps.length,
      tourTitle: tourText?.title ?? activeId,
      title: stepText?.title ?? step.id,
      body: stepText?.body ?? '',
      fallback: tourText?.fallback ?? true,
    };
  },
);
