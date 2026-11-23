import type { UnknownAction } from '@reduxjs/toolkit';
import {
  dissectionReducer,
  exitFade,
  exitIsolate,
  fadeOthers,
  hide,
  isolate,
  reveal,
  selectCanUndo,
  selectHasDissection,
  showAll,
  undo,
  unhide,
  type DissectionState,
} from './dissectionSlice';

const r = (s: DissectionState | undefined, ...as: UnknownAction[]) =>
  as.reduce((st, a) => dissectionReducer(st, a), s as DissectionState);
const s0 = dissectionReducer(undefined, { type: '@@init' });

it('starts empty', () => {
  expect(s0).toEqual({
    hidden: [],
    isolated: null,
    faded: null,
    fadeOpacity: 0.15,
    past: [],
  });
});

it('hide keeps ids sorted and unique and records history', () => {
  const s = r(s0, hide(['tibia--l', 'femur--l', 'femur--l']));
  expect(s.hidden).toEqual(['femur--l', 'tibia--l']);
  expect(s.past).toHaveLength(1);
});

it('isolate clears faded; fadeOthers clears isolated', () => {
  expect(r(s0, fadeOthers(['a']), isolate(['femur--l']))).toMatchObject({
    isolated: ['femur--l'],
    faded: null,
  });
  expect(r(s0, isolate(['a']), fadeOthers(['femur--l']))).toMatchObject({
    isolated: null,
    faded: ['femur--l'],
  });
});

it('showAll clears everything and is undoable', () => {
  const s = r(s0, hide(['a']), isolate(['b']), showAll());
  expect(s).toMatchObject({ hidden: [], isolated: null, faded: null });
  expect(r(s, undo())).toMatchObject({ hidden: ['a'], isolated: ['b'] });
});

it('undo walks back one step at a time and is a no-op when empty', () => {
  const s = r(s0, hide(['a']), hide(['b']));
  expect(r(s, undo()).hidden).toEqual(['a']);
  expect(r(s, undo(), undo()).hidden).toEqual([]);
  expect(r(s0, undo())).toBe(s0);
});

it('caps history at 50', () => {
  const ids = Array.from(
    { length: 60 },
    (_, i) => `m${String(i).padStart(2, '0')}`,
  );
  let s = s0;
  for (const id of ids) s = r(s, hide([id]));
  expect(s.past).toHaveLength(50);
  for (let i = 0; i < 50; i++) s = r(s, undo());
  expect(s.hidden).toEqual(ids.slice(0, 10));
});

it('no-op actions keep the same state and history', () => {
  const s = r(s0, hide(['a']));
  expect(r(s0, hide([]))).toBe(s0);
  expect(r(s, hide(['a']))).toBe(s);
  expect(r(s0, showAll())).toBe(s0);
  expect(r(s0, exitIsolate())).toBe(s0);
  expect(r(s0, exitFade())).toBe(s0);
});

it('reveal unhides and exits isolate/fade that would hide the target', () => {
  expect(r(s0, hide(['a']), isolate(['b']), reveal(['a']))).toMatchObject({
    hidden: [],
    isolated: null,
  });
  expect(r(s0, isolate(['a', 'b']), reveal(['a'])).isolated).toEqual([
    'a',
    'b',
  ]);
  expect(r(s0, fadeOthers(['b']), reveal(['a'])).faded).toBeNull();
});

it('selectors reflect undo availability and active dissection state', () => {
  expect(selectCanUndo({ dissection: s0 })).toBe(false);
  expect(selectHasDissection({ dissection: s0 })).toBe(false);

  const hidden = r(s0, hide(['femur--l']));
  expect(selectCanUndo({ dissection: hidden })).toBe(true);
  expect(selectHasDissection({ dissection: hidden })).toBe(true);

  const cleared = r(hidden, showAll());
  expect(selectCanUndo({ dissection: cleared })).toBe(true);
  expect(selectHasDissection({ dissection: cleared })).toBe(false);
});

it('unhide removes only requested hidden ids and ignores no-ops', () => {
  const hidden = r(s0, hide(['a', 'b']));
  const next = r(hidden, unhide(['a']));
  expect(next.hidden).toEqual(['b']);
  expect(next.past).toHaveLength(hidden.past.length + 1);
  expect(r(hidden, unhide(['zz']))).toBe(hidden);
});
