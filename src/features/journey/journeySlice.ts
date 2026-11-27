import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { CenterlinesFile } from '../../data/centerlines';
import type { LocalizedJourneyText } from './localizeJourneys';
import type { Journey, JourneyId } from './schema';

export type JourneyNotice = 'not-found' | 'load-error' | null;
export type JourneySpeed = 0.5 | 1 | 2;

export type JourneyState = {
  loadStatus: 'idle' | 'loading' | 'ready' | 'error';
  defs: Journey[] | null;
  texts: Record<JourneyId, LocalizedJourneyText> | null;
  centerlines: CenterlinesFile | null;
  activeId: JourneyId | null;
  stageIndex: number;
  progress: number;
  playing: boolean;
  speed: JourneySpeed;
  following: boolean;
  notice: JourneyNotice;
};

const initialState: JourneyState = {
  loadStatus: 'idle',
  defs: null,
  texts: null,
  centerlines: null,
  activeId: null,
  stageIndex: 0,
  progress: 0,
  playing: false,
  speed: 1,
  following: true,
  notice: null,
};

function clamp01(u: number): number {
  if (!Number.isFinite(u)) return 0;
  return Math.min(1, Math.max(0, u));
}

const journeySlice = createSlice({
  name: 'journey',
  initialState,
  reducers: {
    journeysLoading(state) {
      state.loadStatus = 'loading';
    },
    journeysLoaded(
      state,
      action: PayloadAction<{
        defs: Journey[];
        texts: Record<JourneyId, LocalizedJourneyText>;
        centerlines: CenterlinesFile;
      }>,
    ) {
      state.defs = action.payload.defs;
      state.texts = action.payload.texts;
      state.centerlines = action.payload.centerlines;
      state.loadStatus = 'ready';
    },
    journeysFailed(state) {
      state.loadStatus = 'error';
    },
    journeyTextsLoaded(
      state,
      action: PayloadAction<Record<JourneyId, LocalizedJourneyText>>,
    ) {
      state.texts = action.payload;
    },
    journeyStarted(
      state,
      action: PayloadAction<{
        id: JourneyId;
        stageIndex: number;
        progress: number;
        playing?: boolean;
        following?: boolean;
      }>,
    ) {
      state.activeId = action.payload.id;
      state.stageIndex = action.payload.stageIndex;
      state.progress = clamp01(action.payload.progress);
      state.playing = action.payload.playing ?? true;
      state.following = action.payload.following ?? true;
      state.notice = null;
    },
    journeyStageSet(state, action: PayloadAction<number>) {
      state.stageIndex = Math.max(0, Math.trunc(action.payload));
    },
    journeyProgressSet(state, action: PayloadAction<number>) {
      state.progress = clamp01(action.payload);
    },
    journeyPlayingSet(state, action: PayloadAction<boolean>) {
      state.playing = action.payload;
    },
    journeySpeedSet(state, action: PayloadAction<JourneySpeed>) {
      state.speed = action.payload;
    },
    journeyFollowingSet(state, action: PayloadAction<boolean>) {
      state.following = action.payload;
    },
    journeyEnded(state) {
      state.activeId = null;
      state.stageIndex = 0;
      state.progress = 0;
      state.playing = false;
      state.following = true;
    },
    journeyNoticeSet(state, action: PayloadAction<JourneyNotice>) {
      state.notice = action.payload;
    },
  },
});

export const journeyReducer = journeySlice.reducer;
export const {
  journeysLoading,
  journeysLoaded,
  journeysFailed,
  journeyTextsLoaded,
  journeyStarted,
  journeyStageSet,
  journeyProgressSet,
  journeyPlayingSet,
  journeySpeedSet,
  journeyFollowingSet,
  journeyEnded,
  journeyNoticeSet,
} = journeySlice.actions;
