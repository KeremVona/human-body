import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  applyHtmlLang,
  detectBootLocale,
  writeStoredLocale,
  type Locale,
} from '../../i18n/locale';
import { loadMessages, setActiveLocale } from '../../i18n/t';
import {
  loadQualitySetting,
  saveQualitySetting,
  type QualitySetting,
} from './quality';

export type UiState = {
  quality: QualitySetting;
  locale: Locale;
};

const uiSlice = createSlice({
  name: 'ui',
  initialState: (): UiState => ({
    quality: loadQualitySetting(),
    locale: detectBootLocale(),
  }),
  reducers: {
    qualitySet(state, action: PayloadAction<QualitySetting>) {
      state.quality = action.payload;
      saveQualitySetting(action.payload);
    },
    localeSet(state, action: PayloadAction<Locale>) {
      state.locale = action.payload;
      writeStoredLocale(action.payload);
      applyHtmlLang(action.payload);
      setActiveLocale(action.payload);
      void loadMessages(action.payload);
    },
  },
});

export const { qualitySet, localeSet } = uiSlice.actions;
export const uiReducer = uiSlice.reducer;
