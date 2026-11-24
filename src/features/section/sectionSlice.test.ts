import { describe, expect, it } from 'vitest';
import {
  sectionAxisSet,
  sectionFlipped,
  sectionPositionSet,
  sectionReducer,
  sectionSet,
  sectionToggled,
} from './sectionSlice';

describe('sectionSlice', () => {
  it('starts with axial disabled at t = 0.5 and flip = false', () => {
    expect(sectionReducer(undefined, { type: 'init' })).toEqual({
      enabled: false,
      axis: 'axial',
      t: 0.5,
      flip: false,
    });
  });

  it('clamps and rounds section position to 0.005 steps', () => {
    const s1 = sectionReducer(undefined, sectionPositionSet(0.1234));
    expect(s1.t).toBe(0.125);

    const s2 = sectionReducer(undefined, sectionPositionSet(1.7));
    expect(s2.t).toBe(1);

    const s3 = sectionReducer(undefined, sectionPositionSet(-1));
    expect(s3.t).toBe(0);
  });

  it('toggles enabled, sets axis, flips kept side, and applies partial sectionSet', () => {
    let state = sectionReducer(undefined, sectionToggled());
    expect(state.enabled).toBe(true);

    state = sectionReducer(state, sectionAxisSet('sagittal'));
    expect(state.axis).toBe('sagittal');

    state = sectionReducer(state, sectionFlipped());
    expect(state.flip).toBe(true);

    state = sectionReducer(
      state,
      sectionSet({ enabled: false, axis: 'coronal', t: 0.333, flip: false }),
    );
    expect(state).toEqual({
      enabled: false,
      axis: 'coronal',
      t: 0.335,
      flip: false,
    });
  });
});
