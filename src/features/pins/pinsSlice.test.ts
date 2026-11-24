import { addListener } from '@reduxjs/toolkit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeStore } from '../../app/store';
import {
  editorClosed,
  pinAdded,
  pinDeleted,
  pinDeleteUndone,
  pinEdited,
  pinsReducer,
  sharedPinsLoaded,
  sharedPinsSaved,
  storageFailed,
} from './pinsSlice';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('pinsSlice & persistence listener', () => {
  it('adds, edits, deletes and undoes at the same index', () => {
    let state = pinsReducer(undefined, { type: '@@init' });
    state = pinsReducer(
      state,
      pinAdded({ meshId: 'femur--l', local: [0, 0, 0], label: 'First' }),
    );
    state = pinsReducer(
      state,
      pinAdded({ meshId: 'sternum', local: [1, 1, 1], label: 'Second' }),
    );
    expect(state.items).toHaveLength(2);
    const firstId = state.items[0].id;
    expect(state.editingId).toBe(state.items[1].id);

    state = pinsReducer(
      state,
      pinEdited({ id: firstId, label: '  My pin  ', note: 'Details' }),
    );
    expect(state.items[0].label).toBe('My pin');
    expect(state.items[0].note).toBe('Details');

    state = pinsReducer(
      state,
      pinEdited({ id: firstId, label: '   ', note: 'Details' }),
    );
    expect(state.items[0].label).toBe('My pin');

    state = pinsReducer(state, editorClosed());
    expect(state.editingId).toBeNull();

    state = pinsReducer(state, pinDeleted(firstId));
    expect(state.items).toHaveLength(1);
    expect(state.lastDeleted?.id).toBe(firstId);

    state = pinsReducer(state, pinDeleteUndone());
    expect(state.items).toHaveLength(2);
    expect(state.items[0].id).toBe(firstId);
    expect(state.lastDeleted).toBeNull();
  });

  it('enforces limits (80 label, 500 note, max 200 own pins)', () => {
    let state = pinsReducer(undefined, { type: '@@init' });
    state = pinsReducer(
      state,
      pinAdded({ meshId: 'femur--l', local: [0, 0, 0], label: 'a'.repeat(81) }),
    );
    expect(state.items[0].label).toHaveLength(80);

    state = pinsReducer(
      state,
      pinEdited({
        id: state.items[0].id,
        label: 'valid',
        note: 'b'.repeat(501),
      }),
    );
    expect(state.items[0].note).toHaveLength(500);

    for (let i = 1; i < 205; i++) {
      state = pinsReducer(
        state,
        pinAdded({ meshId: 'femur--l', local: [0, i, 0], label: `Pin ${i}` }),
      );
    }
    expect(state.items).toHaveLength(200);
  });

  it('shared pins are read-only until saved', () => {
    let state = pinsReducer(undefined, { type: '@@init' });
    state = pinsReducer(
      state,
      sharedPinsLoaded([
        { m: 'femur--l', l: [0, 1, 0], t: 'Shared A', n: 'Note A' },
        { m: 'sternum', l: [0, 2, 0], t: 'Shared B' },
      ]),
    );
    expect(state.items).toHaveLength(2);
    expect(state.items.every((p) => p.shared === true)).toBe(true);

    const id = state.items[0].id;
    state = pinsReducer(state, pinEdited({ id, label: 'Hacked', note: 'X' }));
    expect(state.items[0].label).toBe('Shared A');

    state = pinsReducer(state, sharedPinsSaved());
    expect(state.items).toHaveLength(2);
    expect(state.items.every((p) => p.shared === undefined)).toBe(true);
  });

  it('pins survive a throwing storage and flags storageFailed once across multiple adds', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const store = makeStore();
    let noticeCount = 0;
    store.dispatch(
      addListener({
        actionCreator: storageFailed,
        effect: () => {
          noticeCount += 1;
        },
      }),
    );

    for (let i = 0; i < 4; i++) {
      store.dispatch(
        pinAdded({ meshId: 'femur--l', local: [0, i, 0], label: `Pin ${i}` }),
      );
    }

    expect(store.getState().pins.items).toHaveLength(4);
    expect(store.getState().pins.storageFailed).toBe(true);
    expect(noticeCount).toBe(1);
  });
});
