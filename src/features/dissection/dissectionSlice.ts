import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { MeshId } from '../../data/ids';

export type DissectionSnapshot = {
  hidden: MeshId[];
  isolated: MeshId[] | null;
  faded: MeshId[] | null;
};

export type DissectionState = DissectionSnapshot & {
  fadeOpacity: number;
  past: DissectionSnapshot[];
};

const HISTORY_LIMIT = 50;

const initialState: DissectionState = {
  hidden: [],
  isolated: null,
  faded: null,
  fadeOpacity: 0.15,
  past: [],
};

function compareAscii(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function normalizeIds(ids: readonly MeshId[]): MeshId[] {
  return [...new Set(ids)].sort(compareAscii);
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function nullableArraysEqual(
  a: readonly string[] | null,
  b: readonly string[] | null,
): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return arraysEqual(a, b);
}

function snapshotsEqual(a: DissectionSnapshot, b: DissectionSnapshot): boolean {
  return (
    arraysEqual(a.hidden, b.hidden) &&
    nullableArraysEqual(a.isolated, b.isolated) &&
    nullableArraysEqual(a.faded, b.faded)
  );
}

function snapshotOf(s: DissectionSnapshot): DissectionSnapshot {
  return {
    hidden: [...s.hidden],
    isolated: s.isolated ? [...s.isolated] : null,
    faded: s.faded ? [...s.faded] : null,
  };
}

function withHistory(
  state: DissectionState,
  mutate: (prev: DissectionSnapshot) => DissectionSnapshot,
): DissectionState {
  const prev = snapshotOf(state);
  const next = mutate(prev);
  if (snapshotsEqual(prev, next)) {
    return state;
  }
  const past = [...state.past.map(snapshotOf), prev].slice(-HISTORY_LIMIT);
  return {
    ...next,
    fadeOpacity: state.fadeOpacity,
    past,
  };
}

const dissectionSlice = createSlice({
  name: 'dissection',
  initialState,
  reducers: {
    hide(state, action: PayloadAction<MeshId[]>) {
      return withHistory(state, (prev) => ({
        ...prev,
        hidden: normalizeIds([...prev.hidden, ...action.payload]),
      }));
    },
    isolate(state, action: PayloadAction<MeshId[]>) {
      return withHistory(state, (prev) => ({
        ...prev,
        isolated: normalizeIds(action.payload),
        faded: null,
      }));
    },
    fadeOthers(state, action: PayloadAction<MeshId[]>) {
      return withHistory(state, (prev) => ({
        ...prev,
        isolated: null,
        faded: normalizeIds(action.payload),
      }));
    },
    showAll(state) {
      return withHistory(state, () => ({
        hidden: [],
        isolated: null,
        faded: null,
      }));
    },
    exitIsolate(state) {
      return withHistory(state, (prev) => ({
        ...prev,
        isolated: null,
      }));
    },
    exitFade(state) {
      return withHistory(state, (prev) => ({
        ...prev,
        faded: null,
      }));
    },
    reveal(state, action: PayloadAction<MeshId[]>) {
      const targets = new Set(action.payload);
      return withHistory(state, (prev) => {
        const hidden = prev.hidden.filter((id) => !targets.has(id));
        const isolated =
          prev.isolated &&
          action.payload.some((id) => !prev.isolated!.includes(id))
            ? null
            : prev.isolated;
        const faded =
          prev.faded && action.payload.some((id) => !prev.faded!.includes(id))
            ? null
            : prev.faded;
        return { hidden, isolated, faded };
      });
    },
    unhide(state, action: PayloadAction<MeshId[]>) {
      const targets = new Set(action.payload);
      return withHistory(state, (prev) => ({
        ...prev,
        hidden: prev.hidden.filter((id) => !targets.has(id)),
      }));
    },
    undo(state) {
      if (state.past.length === 0) {
        return state;
      }
      const prev = snapshotOf(state.past[state.past.length - 1]);
      return {
        ...prev,
        fadeOpacity: state.fadeOpacity,
        past: state.past.slice(0, -1).map(snapshotOf),
      };
    },
  },
});

export const dissectionReducer = dissectionSlice.reducer;
export const {
  hide,
  isolate,
  fadeOthers,
  showAll,
  exitIsolate,
  exitFade,
  reveal,
  unhide,
  undo,
} = dissectionSlice.actions;

/** True when at least one undo snapshot is recorded. */
export function selectCanUndo(state: { dissection: DissectionState }): boolean {
  return state.dissection.past.length > 0;
}

/** True when any hidden, isolated, or faded dissection state is active. */
export function selectHasDissection(state: {
  dissection: DissectionState;
}): boolean {
  const { hidden, isolated, faded } = state.dissection;
  return hidden.length > 0 || isolated !== null || faded !== null;
}
