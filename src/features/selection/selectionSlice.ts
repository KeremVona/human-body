import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { MeshId } from '../../data/ids';
import { bundleRetry } from '../assets/assetsSlice';
import { hide } from '../dissection/dissectionSlice';

export type SelectionState = {
  selectedIds: MeshId[];
  hoveredId: MeshId | null;
};

const initialState: SelectionState = {
  selectedIds: [],
  hoveredId: null,
};

function removeMeshIds(state: SelectionState, ids: readonly MeshId[]): void {
  const removed = new Set(ids);
  state.selectedIds = state.selectedIds.filter((id) => !removed.has(id));
  if (state.hoveredId && removed.has(state.hoveredId)) {
    state.hoveredId = null;
  }
}

const selectionSlice = createSlice({
  name: 'selection',
  initialState,
  reducers: {
    selected(state, action: PayloadAction<MeshId[]>) {
      state.selectedIds = [...new Set(action.payload)];
    },
    selectionCleared(state) {
      state.selectedIds = [];
    },
    hovered(state, action: PayloadAction<MeshId | null>) {
      state.hoveredId = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(hide, (state, action) => {
      removeMeshIds(state, action.payload);
    });
    builder.addCase(bundleRetry, (state, action) => {
      removeMeshIds(state, action.payload.meshIds);
    });
  },
});

export const selectionReducer = selectionSlice.reducer;
export const { selected, selectionCleared, hovered } = selectionSlice.actions;
