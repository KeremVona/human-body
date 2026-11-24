import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { SectionAxis } from './sectionPlane';

export type SectionState = {
  enabled: boolean;
  axis: SectionAxis;
  t: number;
  flip: boolean;
};

const initialState: SectionState = {
  enabled: false,
  axis: 'axial',
  t: 0.5,
  flip: false,
};

function clampStepT(raw: number): number {
  if (!Number.isFinite(raw)) return 0.5;
  const clamped = Math.min(1, Math.max(0, raw));
  const rounded = Math.round(clamped * 200) / 200;
  return Object.is(rounded, -0) ? 0 : rounded;
}

const sectionSlice = createSlice({
  name: 'section',
  initialState,
  reducers: {
    sectionToggled(state) {
      state.enabled = !state.enabled;
    },
    sectionSet(state, action: PayloadAction<Partial<SectionState>>) {
      const next = action.payload;
      if (next.enabled !== undefined) state.enabled = next.enabled;
      if (next.axis !== undefined) state.axis = next.axis;
      if (next.t !== undefined) state.t = clampStepT(next.t);
      if (next.flip !== undefined) state.flip = next.flip;
    },
    sectionAxisSet(state, action: PayloadAction<SectionAxis>) {
      state.axis = action.payload;
    },
    sectionPositionSet(state, action: PayloadAction<number>) {
      state.t = clampStepT(action.payload);
    },
    sectionFlipped(state) {
      state.flip = !state.flip;
    },
  },
});

export const sectionReducer = sectionSlice.reducer;
export const {
  sectionToggled,
  sectionSet,
  sectionAxisSet,
  sectionPositionSet,
  sectionFlipped,
} = sectionSlice.actions;
