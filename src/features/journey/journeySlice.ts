import {
  createSelector,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';
import type { CenterlinesFile } from '../../data/centerlines';
import { isMeshId, parseMeshId, type MeshId } from '../../data/ids';
import type { IndexFile, Manifest } from '../../data/schema';
import type { LocalizedJourneyText } from './localizeJourneys';
import { getRoute, localProgress } from './route';
import type { Journey, JourneyId } from './schema';

export type JourneyNotice = 'not-found' | null;
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

const SECRETE_WINDOW_S = 1.2;

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

export type JourneyOverrides = {
  ghost: ReadonlySet<MeshId>;
  active: ReadonlySet<MeshId>;
};

const EMPTY_SET: ReadonlySet<MeshId> = new Set();
const EMPTY_OVERRIDES: JourneyOverrides = {
  ghost: EMPTY_SET,
  active: EMPTY_SET,
};

type OverrideSelectorInput = {
  journey?: JourneyState;
  assets?: { manifest: Manifest | null };
  content?: { index: IndexFile | null };
};

/** Returns sorted open secrete-event meshes joined as a stable cache key so steady frames do not churn overrides. */
function selectOpenSecreteKey(state: OverrideSelectorInput): string {
  const j = state.journey;
  if (!j?.activeId || !j.defs) return '';
  const def = j.defs.find((d) => d.id === j.activeId);
  const stage = def?.stages[j.stageIndex];
  if (!def || !stage?.events?.length) return '';

  const manifest = state.assets?.manifest ?? null;
  const centerlines = j.centerlines;
  const localP =
    centerlines && manifest
      ? localProgress(
          getRoute(def, centerlines.lines, manifest.meshes),
          j.stageIndex,
          j.progress,
        )
      : clamp01(j.progress);

  const open: MeshId[] = [];
  for (const ev of stage.events) {
    const windowEnd = ev.at + SECRETE_WINDOW_S / stage.durationS;
    if (localP >= ev.at && localP <= windowEnd) {
      open.push(ev.mesh);
    }
  }
  return open.length > 0 ? open.sort().join('|') : '';
}

/** Memoized selector returning active organs (+open secrete helpers) and ghosted tract organs. */
export const selectJourneyOverrides = createSelector(
  [
    (state: OverrideSelectorInput) => state.journey?.defs ?? null,
    (state: OverrideSelectorInput) => state.journey?.activeId ?? null,
    (state: OverrideSelectorInput) => state.journey?.stageIndex ?? 0,
    selectOpenSecreteKey,
    (state: OverrideSelectorInput) => state.assets?.manifest ?? null,
    (state: OverrideSelectorInput) => state.content?.index ?? null,
  ],
  (
    defs: Journey[] | null,
    activeId: JourneyId | null,
    stageIndex: number,
    openEventKey: string,
    manifest: Manifest | null,
    index: IndexFile | null,
  ): JourneyOverrides => {
    if (!defs || !activeId) return EMPTY_OVERRIDES;
    const def = defs.find((d) => d.id === activeId);
    const stage = def?.stages[stageIndex];
    if (!def || !stage) return EMPTY_OVERRIDES;

    const active = new Set<MeshId>(stage.organs);
    if (openEventKey.length > 0) {
      for (const meshId of openEventKey.split('|')) {
        if (isMeshId(meshId)) {
          active.add(meshId);
        }
      }
    }

    const indexMap = index
      ? new Map(index.structures.map((item) => [item.id, item.system]))
      : null;
    const systemFilter =
      indexMap && def.systems.length > 0 ? new Set(def.systems) : null;

    const ghost = new Set<MeshId>();
    for (const s of def.stages) {
      for (const meshId of s.organs) {
        if (active.has(meshId)) continue;
        if (manifest && !Object.hasOwn(manifest.meshes, meshId)) continue;
        if (systemFilter && indexMap) {
          const sys = indexMap.get(parseMeshId(meshId).structureId);
          if (sys && !systemFilter.has(sys)) continue;
        }
        ghost.add(meshId);
      }
    }

    return { active, ghost };
  },
);
