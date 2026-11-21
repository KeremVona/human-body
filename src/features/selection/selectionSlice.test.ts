import { bundleRetry } from '../assets/assetsSlice';
import { hide } from '../dissection/dissectionSlice';
import {
  hovered,
  selected,
  selectionCleared,
  selectionReducer,
} from './selectionSlice';

it('selected replaces selection, selectionCleared empties it, and hovered updates hover', () => {
  let state = selectionReducer(undefined, { type: '@@init' });
  expect(state).toEqual({ selectedIds: [], hoveredId: null });

  state = selectionReducer(state, selected(['femur--l', 'femur--r']));
  expect(state.selectedIds).toEqual(['femur--l', 'femur--r']);

  state = selectionReducer(state, selected(['sternum']));
  expect(state.selectedIds).toEqual(['sternum']);

  state = selectionReducer(state, hovered('femur--l'));
  expect(state.hoveredId).toBe('femur--l');

  state = selectionReducer(state, hovered(null));
  expect(state.hoveredId).toBeNull();

  state = selectionReducer(state, selectionCleared());
  expect(state.selectedIds).toEqual([]);
});

it('hide removes hidden ids from the selection', () => {
  let state = selectionReducer(undefined, { type: '@@init' });
  state = selectionReducer(state, selected(['femur--l', 'femur--r']));
  state = selectionReducer(state, hide(['femur--l']));
  expect(state.selectedIds).toEqual(['femur--r']);
});

it('bundleRetry clears selection of meshes from that bundle', () => {
  const initial = {
    selectedIds: ['femur--l', 'biceps-brachii--l'],
    hoveredId: 'femur--l',
  };
  const next = selectionReducer(
    initial,
    bundleRetry({ id: 'skeletal', meshIds: ['femur--l', 'sternum'] }),
  );
  expect(next.selectedIds).toEqual(['biceps-brachii--l']);
  expect(next.hoveredId).toBeNull();
});
