import { describe, expect, it } from 'vitest';
import type { IndexFile, Manifest } from '../../data/schema';
import { selectSceneOverrides } from '../../scene/resolveMeshState';
import type { MotionState } from '../motion/motionSlice';
import {
  journeyEnded,
  journeyFollowingSet,
  journeyNoticeSet,
  journeyPlayingSet,
  journeyProgressSet,
  journeyReducer,
  journeysFailed,
  journeysLoaded,
  journeysLoading,
  journeySpeedSet,
  journeyStageSet,
  journeyStarted,
  journeyTextsLoaded,
} from './journeySlice';
import { selectJourneyOverrides } from './selectors';
import type { Journey } from './schema';

const bounds = {
  min: [-0.1, 0, -0.1] as [number, number, number],
  max: [0.1, 0.5, 0.1] as [number, number, number],
};

const fixtureJourney: Journey = {
  id: 'digestion',
  systems: ['digestive'],
  stages: [
    {
      id: 'mouth',
      durationS: 10,
      food: 'bolus',
      radius: 0.008,
      motion: 'none',
      organs: ['tongue', 'upper-medial-incisor--l'],
      view: { c: [0, 0.4, 0.5, 0, 0.4, 0], s: ['digestive', 'skeletal'], h: [], sel: [] },
      path: [
        { mesh: 'tongue', anchor: [0.5, 0.5, 0.5] },
        { mesh: 'tongue', anchor: [0.5, 0.5, 0.3] },
      ],
      modelled: true,
      events: [{ at: 0.2, kind: 'secrete', mesh: 'parotid-gland--l', id: 'saliva' }],
      nutrients: { carbs: 5, protein: 0, fat: 0, water: 0, absorbed: 0 },
    },
    {
      id: 'stomach',
      durationS: 10,
      food: 'chyme',
      radius: 0.011,
      motion: 'churn',
      organs: ['stomach'],
      view: { c: [0, 0.2, 0.6, 0, 0.2, 0], s: ['digestive'], h: [], sel: [] },
      path: [{ line: 'stomach' }],
      modelled: true,
      nutrients: { carbs: 30, protein: 15, fat: 10, water: 0, absorbed: 0 },
    },
  ],
};

const centerlines = {
  version: 1 as const,
  lines: {
    stomach: [
      [0, 0.3, 0] as [number, number, number],
      [0, 0.2, 0] as [number, number, number],
      [0, 0.1, 0] as [number, number, number],
    ],
  },
};

const manifest: Manifest = {
  version: 1,
  generatedAt: '2026-11-27T00:00:00Z',
  source: { name: 'Z-Anatomy', version: '2023', license: 'CC-BY-SA-4.0' },
  bundles: [],
  meshes: {
    tongue: { bundle: 'organs', bounds, triangles: 10, sizeClass: 'small' },
    'upper-medial-incisor--l': { bundle: 'skeletal', bounds, triangles: 10, sizeClass: 'tiny' },
    'parotid-gland--l': { bundle: 'organs', bounds, triangles: 10, sizeClass: 'tiny' },
    stomach: { bundle: 'organs', bounds, triangles: 10, sizeClass: 'medium' },
  },
};

const contentIndex: IndexFile = {
  locale: 'en',
  structures: [
    { id: 'tongue', paired: false, system: 'digestive', region: 'head', kind: 'organ', tissue: 'muscle', featured: false, names: { common: 'Tongue', synonyms: [] } },
    { id: 'upper-medial-incisor', paired: true, system: 'skeletal', region: 'head', kind: 'bone', tissue: 'bone', featured: false, names: { common: 'Incisor', synonyms: [] } },
    { id: 'parotid-gland', paired: true, system: 'digestive', region: 'head', kind: 'organ', tissue: 'other', featured: false, names: { common: 'Parotid', synonyms: [] } },
    { id: 'stomach', paired: false, system: 'digestive', region: 'abdomen', kind: 'organ', tissue: 'other', featured: false, names: { common: 'Stomach', synonyms: [] } },
  ],
};

describe('journeySlice reducers and overrides', () => {
  it('handles lifecycle transitions cleanly', () => {
    let s = journeyReducer(undefined, journeysLoading());
    expect(s.loadStatus).toBe('loading');

    s = journeyReducer(s, journeysFailed());
    expect(s.loadStatus).toBe('error');

    const texts = {
      digestion: {
        title: 'Title',
        summary: 'Summary',
        stages: {
          mouth: { title: 'Mouth', body: 'Chew' },
          stomach: { title: 'Stomach', body: 'Acid' },
        },
        events: { saliva: 'Saliva' },
        fallback: false,
      },
    };

    s = journeyReducer(
      s,
      journeysLoaded({ defs: [fixtureJourney], texts, centerlines }),
    );
    expect(s.loadStatus).toBe('ready');

    s = journeyReducer(s, journeyTextsLoaded({ ...texts }));
    s = journeyReducer(
      s,
      journeyStarted({ id: 'digestion', stageIndex: 0, progress: 0.05 }),
    );
    expect(s.activeId).toBe('digestion');
    expect(s.playing).toBe(true);
    expect(s.following).toBe(true);

    s = journeyReducer(s, journeyStageSet(1));
    s = journeyReducer(s, journeyProgressSet(1.5));
    expect(s.stageIndex).toBe(1);
    expect(s.progress).toBe(1);

    s = journeyReducer(s, journeyPlayingSet(false));
    s = journeyReducer(s, journeySpeedSet(2));
    s = journeyReducer(s, journeyFollowingSet(false));
    s = journeyReducer(s, journeyNoticeSet('not-found'));
    expect(s.playing).toBe(false);
    expect(s.speed).toBe(2);
    expect(s.following).toBe(false);
    expect(s.notice).toBe('not-found');

    s = journeyReducer(s, journeyEnded());
    expect(s.activeId).toBeNull();
    expect(s.stageIndex).toBe(0);
    expect(s.progress).toBe(0);
    expect(s.following).toBe(true);
  });

  it('selectJourneyOverrides includes secrete helpers only during open window, filters ghost to journey systems, and memoizes', () => {
    let s = journeyReducer(
      undefined,
      journeysLoaded({
        defs: [fixtureJourney],
        texts: {},
        centerlines,
      }),
    );
    // Mouth spans roughly [0, 0.33] along route
    s = journeyReducer(s, journeyStarted({ id: 'digestion', stageIndex: 0, progress: 0 }));

    const baseInput = {
      journey: s,
      assets: { manifest },
      content: { index: contentIndex },
    };

    const ov0 = selectJourneyOverrides(baseInput);
    expect([...ov0.active].sort()).toEqual(['tongue', 'upper-medial-incisor--l']);
    expect([...ov0.ghost]).toEqual(['stomach']);

    // Steady progress inside mouth BEFORE event window (localP < 0.2) returns identical reference
    const ov1 = selectJourneyOverrides({
      ...baseInput,
      journey: journeyReducer(s, journeyProgressSet(0.01)),
    });
    expect(ov1).toBe(ov0);

    // Move to stomach stage: tongue enters ghost, non-digestive upper-medial-incisor--l does NOT
    const stomachState = journeyReducer(
      journeyReducer(s, journeyStageSet(1)),
      journeyProgressSet(0.6),
    );
    const ovStomach = selectJourneyOverrides({
      ...baseInput,
      journey: stomachState,
    });
    expect([...ovStomach.active]).toEqual(['stomach']);
    expect([...ovStomach.ghost]).toEqual(['tongue']);

    // Back to mouth during open secrete window (localP ~ 0.23 -> window [0.2, 0.32]):
    const windowState = journeyReducer(
      s,
      journeyProgressSet(0.075),
    );
    const ovOpen = selectJourneyOverrides({
      ...baseInput,
      journey: windowState,
    });
    expect(ovOpen.active.has('parotid-gland--l')).toBe(true);
  });

  it('selectSceneOverrides unions active and ghost sets from motion and journey', () => {
    const journey = journeyReducer(
      journeyReducer(
        undefined,
        journeysLoaded({ defs: [fixtureJourney], texts: {}, centerlines }),
      ),
      journeyStarted({ id: 'digestion', stageIndex: 1, progress: 0.6 }),
    );
    const motion: MotionState = {
      defs: [
        {
          id: 'flex',
          kind: 'hinge',
          label: 'Flex',
          systems: ['muscular'],
          view: 'anterior',
          periodS: 2,
          pivot: { mesh: 'stomach', anchor: [0.5, 0.5, 0.5] },
          axis: [1, 0, 0],
          range: [0, 90],
          moving: ['tongue'],
          ghost: ['parotid-gland--l'],
          agonists: { flex: ['tongue'], extend: [] },
        },
      ],
      loadStatus: 'ready',
      activeId: 'flex',
      playing: true,
      speed: 1,
      direction: 'flex',
      scrubPhase: 0.1,
      activationSeq: 1,
    };

    const union = selectSceneOverrides({
      motion,
      journey,
      assets: { manifest },
      content: { index: contentIndex },
    });
    expect([...union.active].sort()).toEqual(['stomach', 'tongue']);
    expect([...union.ghost]).toContain('parotid-gland--l');
  });
});
