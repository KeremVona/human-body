import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type ShareNoticeReason = 'skipped' | 'newer-version' | 'malformed';

export type ShareState = {
  notice: ShareNoticeReason | null;
};

const initialState: ShareState = {
  notice: null,
};

const shareSlice = createSlice({
  name: 'share',
  initialState,
  reducers: {
    noticeShown(state, action: PayloadAction<ShareNoticeReason>) {
      state.notice = action.payload;
    },
    noticeDismissed(state) {
      state.notice = null;
    },
  },
});

export const { noticeShown, noticeDismissed } = shareSlice.actions;
export const shareReducer = shareSlice.reducer;
