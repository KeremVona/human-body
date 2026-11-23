import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  loadQualitySetting,
  saveQualitySetting,
  type QualitySetting,
} from './quality';

export type UiState = {
  quality: QualitySetting;
};

const uiSlice = createSlice({
  name: 'ui',
  initialState: (): UiState => ({
    quality: loadQualitySetting(),
  }),
  reducers: {
    qualitySet(state, action: PayloadAction<QualitySetting>) {
      state.quality = action.payload;
      saveQualitySetting(action.payload);
    },
  },
});

export const { qualitySet } = uiSlice.actions;
export const uiReducer = uiSlice.reducer;
