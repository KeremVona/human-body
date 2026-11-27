import {
  createSelector,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';
import type { MeshId } from '../../data/ids';
import { hingeDirection } from './math';
import type { MotionDef } from './schema';

export type MotionState = {
  defs: MotionDef[] | null;
  loadStatus: 'idle' | 'loading' | 'ready' | 'error';
  activeId: string | null;
  playing: boolean;
  speed: 0.5 | 1;
  direction: 'flex' | 'extend' | null;
  scrubPhase: number;
  activationSeq: number;
};

const initialState: MotionState = {
  defs: null,
  loadStatus: 'idle',
  activeId: null,
  playing: false,
  speed: 1,
  direction: null,
  scrubPhase: 0,
  activationSeq: 0,
};

function clampPhase(phase: number): number {
  if (!Number.isFinite(phase)) return 0;
  return Math.min(1, Math.max(0, phase));
}

function directionFor(
  defs: MotionDef[] | null,
  activeId: string | null,
  phase: number,
): 'flex' | 'extend' | null {
  const def = defs?.find((d) => d.id === activeId);
  if (!def || def.kind !== 'hinge') return null;
  return phase === 1 ? 'extend' : hingeDirection(phase);
}

const motionSlice = createSlice({
  name: 'motion',
  initialState,
  reducers: {
    motionsLoading(state) {
      state.loadStatus = 'loading';
    },
    motionsLoaded(state, action: PayloadAction<MotionDef[]>) {
      state.defs = action.payload;
      state.loadStatus = 'ready';
    },
    motionsFailed(state) {
      state.loadStatus = 'error';
    },
    motionActivated(
      state,
      action: PayloadAction<{ id: string; playing: boolean; phase?: number }>,
    ) {
      const { id, playing, phase = 0 } = action.payload;
      const p = clampPhase(phase);
      state.activeId = id;
      state.playing = playing;
      state.scrubPhase = p;
      state.direction = directionFor(state.defs, id, p);
      state.activationSeq += 1;
    },
    motionPlayed(state) {
      if (state.activeId) {
        state.playing = true;
      }
    },
    motionPaused(state, action: PayloadAction<number | undefined>) {
      state.playing = false;
      if (action.payload !== undefined) {
        const p = clampPhase(action.payload);
        state.scrubPhase = p;
        state.direction = directionFor(state.defs, state.activeId, p);
      }
    },
    motionScrubbed(state, action: PayloadAction<number>) {
      const p = clampPhase(action.payload);
      state.scrubPhase = p;
      state.direction = directionFor(state.defs, state.activeId, p);
    },
    motionSpeedSet(state, action: PayloadAction<0.5 | 1>) {
      state.speed = action.payload;
    },
    motionDirectionChanged(
      state,
      action: PayloadAction<'flex' | 'extend' | null>,
    ) {
      state.direction = action.payload;
    },
    motionStopped(state) {
      state.activeId = null;
      state.playing = false;
      state.direction = null;
      state.scrubPhase = 0;
    },
  },
});

export const motionReducer = motionSlice.reducer;
export const {
  motionsLoading,
  motionsLoaded,
  motionsFailed,
  motionActivated,
  motionPlayed,
  motionPaused,
  motionScrubbed,
  motionSpeedSet,
  motionDirectionChanged,
  motionStopped,
} = motionSlice.actions;

export type MotionOverrides = {
  ghost: ReadonlySet<MeshId>;
  active: ReadonlySet<MeshId>;
};

const EMPTY_SET: ReadonlySet<MeshId> = new Set();
const EMPTY_OVERRIDES: MotionOverrides = {
  ghost: EMPTY_SET,
  active: EMPTY_SET,
};

/** Memoized selector resolving motion-only ghosting and agonist highlights without mutating dissection. */
export const selectMotionOverrides = createSelector(
  [
    (state: { motion?: MotionState }) => state.motion?.defs ?? null,
    (state: { motion?: MotionState }) => state.motion?.activeId ?? null,
    (state: { motion?: MotionState }) => state.motion?.playing ?? false,
    (state: { motion?: MotionState }) => state.motion?.direction ?? null,
    (state: { motion?: MotionState }) => state.motion?.scrubPhase ?? 0,
  ],
  (defs, activeId, playing, direction, scrubPhase): MotionOverrides => {
    if (!defs || !activeId) return EMPTY_OVERRIDES;
    const def = defs.find((d) => d.id === activeId);
    if (!def || def.kind !== 'hinge') return EMPTY_OVERRIDES;

    const effectiveDir = playing
      ? (direction ?? 'flex')
      : scrubPhase < 0.5
        ? 'flex'
        : 'extend';

    return {
      ghost: new Set(def.ghost),
      active: new Set(def.agonists[effectiveDir]),
    };
  },
);

/** Memoized selector returning the set of meshes animated by the active motion demo. */
export const selectMotionMoving = createSelector(
  [
    (state: { motion?: MotionState }) => state.motion?.defs ?? null,
    (state: { motion?: MotionState }) => state.motion?.activeId ?? null,
  ],
  (defs, activeId): ReadonlySet<MeshId> => {
    if (!defs || !activeId) return EMPTY_SET;
    const def = defs.find((d) => d.id === activeId);
    if (!def) return EMPTY_SET;
    if (def.kind === 'hinge') {
      return new Set(def.moving);
    }
    if (def.kind === 'pulse') {
      return new Set(def.groups.flatMap((g) => g.meshes));
    }
    if (def.kind === 'breath') {
      return new Set([
        ...def.expand.flatMap((g) => g.meshes),
        ...(def.shift ?? []).flatMap((s) => s.meshes),
      ]);
    }
    return EMPTY_SET;
  },
);
