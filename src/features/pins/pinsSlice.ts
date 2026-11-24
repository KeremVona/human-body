import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { MeshId } from '../../data/ids';
import type { SharedPin } from '../share/viewState';

export const MAX_OWN_PINS = 200;

export type Pin = {
  id: string;
  meshId: MeshId;
  local: [number, number, number];
  label: string;
  note: string;
  createdAt: number;
  shared?: true;
};

export type PinsState = {
  items: Pin[];
  editingId: string | null;
  placing: boolean;
  storageFailed: boolean;
  storageNoticeShown: boolean;
  lastDeleted: Pin | null;
  lastDeletedIndex?: number | null;
};

const initialState: PinsState = {
  items: [],
  editingId: null,
  placing: false,
  storageFailed: false,
  storageNoticeShown: false,
  lastDeleted: null,
  lastDeletedIndex: null,
};

function sanitizeLabel(label: string): string {
  return label.trim().slice(0, 80);
}

function sanitizeNote(note: string): string {
  return note.slice(0, 500);
}

function ownPinCount(items: readonly Pin[]): number {
  let count = 0;
  for (const p of items) {
    if (!p.shared) count += 1;
  }
  return count;
}

const pinsSlice = createSlice({
  name: 'pins',
  initialState,
  reducers: {
    pinAdded(
      state,
      action: PayloadAction<{
        meshId: MeshId;
        local: [number, number, number];
        label: string;
      }>,
    ) {
      if (ownPinCount(state.items) >= MAX_OWN_PINS) {
        return;
      }
      const cleanLabel = sanitizeLabel(action.payload.label) || 'Pin';
      const id = crypto.randomUUID();
      state.items.push({
        id,
        meshId: action.payload.meshId,
        local: [...action.payload.local] as [number, number, number],
        label: cleanLabel,
        note: '',
        createdAt: Date.now(),
      });
      state.editingId = id;
    },
    pinEdited(
      state,
      action: PayloadAction<{ id: string; label: string; note: string }>,
    ) {
      const target = state.items.find((p) => p.id === action.payload.id);
      if (!target || target.shared) return;
      const cleanLabel = sanitizeLabel(action.payload.label);
      if (cleanLabel.length > 0) {
        target.label = cleanLabel;
      }
      target.note = sanitizeNote(action.payload.note);
    },
    pinDeleted(state, action: PayloadAction<string>) {
      const idx = state.items.findIndex((p) => p.id === action.payload);
      if (idx === -1) return;
      const [removed] = state.items.splice(idx, 1);
      state.lastDeleted = removed;
      state.lastDeletedIndex = idx;
      if (state.editingId === removed.id) {
        state.editingId = null;
      }
    },
    pinDeleteUndone(state) {
      if (!state.lastDeleted) return;
      const idx =
        typeof state.lastDeletedIndex === 'number'
          ? Math.max(0, Math.min(state.items.length, state.lastDeletedIndex))
          : state.items.length;
      state.items.splice(idx, 0, state.lastDeleted);
      state.lastDeleted = null;
      state.lastDeletedIndex = null;
    },
    editorOpened(state, action: PayloadAction<string>) {
      state.editingId = action.payload;
    },
    editorClosed(state) {
      state.editingId = null;
    },
    sharedPinsLoaded(state, action: PayloadAction<SharedPin[]>) {
      const own = state.items.filter((p) => !p.shared);
      const baseTime = Date.now();
      const loaded: Pin[] = action.payload.map((sp, i) => ({
        id: `shared-${crypto.randomUUID()}`,
        meshId: sp.m,
        local: [...sp.l] as [number, number, number],
        label: sanitizeLabel(sp.t) || 'Pin',
        note: sanitizeNote(sp.n ?? ''),
        createdAt: baseTime + i,
        shared: true,
      }));
      state.items = [...own, ...loaded];
    },
    sharedPinsSaved(state) {
      let remaining = MAX_OWN_PINS - ownPinCount(state.items);
      const next: Pin[] = [];
      for (const p of state.items) {
        if (!p.shared) {
          next.push(p);
        } else if (remaining > 0) {
          remaining -= 1;
          next.push({
            id: p.id,
            meshId: p.meshId,
            local: [...p.local] as [number, number, number],
            label: p.label,
            note: p.note,
            createdAt: p.createdAt,
          });
        }
      }
      state.items = next;
    },
    pinsHydrated(state, action: PayloadAction<Pin[]>) {
      const shared = state.items.filter((p) => p.shared);
      const existingOwnIds = new Set(
        state.items.filter((p) => !p.shared).map((p) => p.id),
      );
      const own = state.items.filter((p) => !p.shared);
      for (const p of action.payload) {
        if (own.length >= MAX_OWN_PINS) break;
        if (p.shared || existingOwnIds.has(p.id)) continue;
        existingOwnIds.add(p.id);
        own.push(p);
      }
      state.items = [...own, ...shared];
    },
    storageFailed(state) {
      state.storageFailed = true;
    },
    storageNoticeShown(state) {
      state.storageNoticeShown = true;
    },
  },
});

export const pinsReducer = pinsSlice.reducer;
export const {
  pinAdded,
  pinEdited,
  pinDeleted,
  pinDeleteUndone,
  editorOpened,
  editorClosed,
  sharedPinsLoaded,
  sharedPinsSaved,
  pinsHydrated,
  storageFailed,
  storageNoticeShown,
} = pinsSlice.actions;
