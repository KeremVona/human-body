import { describe, expect, it } from 'vitest';
import {
  selectCurrentStep,
  selectTourActive,
  tourEnded,
  tourNoticeDismissed,
  tourNoticeSet,
  tourReducer,
  toursFailed,
  toursLoading,
  toursLoaded,
  tourStarted,
  tourStepSet,
} from './tourSlice';
import type { Tour } from './schema';
import type { TourText } from './localizeTours';

const fixtureDefs: Tour[] = [
  {
    id: 'arm-bone-to-muscle',
    steps: [
      {
        id: 'step-1',
        view: { c: [0, 0, 2, 0, 0, 0], s: ['skeletal'], h: [], sel: [] },
      },
      {
        id: 'step-2',
        view: { c: [0, 0, 2, 0, 0, 0], s: ['skeletal'], h: [], sel: [] },
      },
      {
        id: 'step-3',
        view: { c: [0, 0, 2, 0, 0, 0], s: ['skeletal'], h: [], sel: [] },
      },
      {
        id: 'step-4',
        view: { c: [0, 0, 2, 0, 0, 0], s: ['skeletal'], h: [], sel: [] },
      },
    ],
  },
];

const fixtureTexts: Record<string, TourText> = {
  'arm-bone-to-muscle': {
    title: 'From bone to muscle',
    summary: 'Overview',
    fallback: true,
    steps: {
      'step-1': { title: 'Step 1', body: 'Body 1' },
      'step-2': { title: 'Step 2', body: 'Body 2' },
      'step-3': { title: 'Step 3', body: 'Body 3' },
      'step-4': { title: 'Step 4', body: 'Body 4' },
    },
  },
};

describe('tourSlice', () => {
  it('tracks loading, playback lifecycle, notices, and selectors', () => {
    let state = tourReducer(undefined, { type: 'init' });
    expect(state.loadStatus).toBe('idle');
    expect(selectTourActive({ tour: state })).toBe(false);
    expect(selectCurrentStep({ tour: state })).toBeNull();

    state = tourReducer(state, toursLoading());
    expect(state.loadStatus).toBe('loading');

    state = tourReducer(
      state,
      toursLoaded({ defs: fixtureDefs, texts: fixtureTexts }),
    );
    expect(state.loadStatus).toBe('ready');

    const savedView = {
      c: [0, 0, 3, 0, 0, 0] as [number, number, number, number, number, number],
      s: ['skeletal'] as const,
      h: [],
      sel: [],
    };
    state = tourReducer(
      state,
      tourStarted({ id: 'arm-bone-to-muscle', savedView: { ...savedView, s: [...savedView.s] } }),
    );
    expect(selectTourActive({ tour: state })).toBe(true);
    expect(selectCurrentStep({ tour: state })).toEqual({
      tourId: 'arm-bone-to-muscle',
      index: 0,
      count: 4,
      tourTitle: 'From bone to muscle',
      title: 'Step 1',
      body: 'Body 1',
      fallback: true,
    });

    state = tourReducer(state, tourStepSet(2));
    expect(selectCurrentStep({ tour: state })?.title).toBe('Step 3');

    state = tourReducer(state, tourNoticeSet('not-found'));
    expect(state.notice).toBe('not-found');
    state = tourReducer(state, tourNoticeDismissed());
    expect(state.notice).toBeNull();

    state = tourReducer(state, tourEnded());
    expect(selectTourActive({ tour: state })).toBe(false);
    expect(state.savedView).toBeNull();
    expect(state.stepIndex).toBe(0);

    state = tourReducer(state, toursFailed());
    expect(state.loadStatus).toBe('error');
  });
});
