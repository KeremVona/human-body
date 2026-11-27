import { afterEach, describe, expect, it, vi } from 'vitest';
import rawTaxonomy from '../../../content/taxonomy.json';
import { makeStore, type CameraRef } from '../../app/store';
import { TaxonomySchema, type Manifest } from '../../data/schema';
import { hide } from '../dissection/dissectionSlice';
import { motionsLoaded, motionActivated } from '../motion/motionSlice';
import { startMotion } from '../motion/thunks';
import { quizStarted } from '../quiz/quizSlice';
import { startQuiz } from '../quiz/thunks';
import { localeSet } from '../settings/uiSlice';
import { systemToggled } from '../systems/systemsSlice';
import { toursLoaded } from '../tours/tourSlice';
import { startTour } from '../tours/thunks';
import { journeyClock } from './journeyClock';
import {
  exitJourney,
  goToStage,
  loadJourneys,
  nextStage,
  prevStage,
  scrubJourney,
  startJourney,
} from './thunks';
import type { Journey, JourneyTextsFile } from './schema';

const taxonomy = TaxonomySchema.parse(rawTaxonomy);

const bounds = {
  min: [-0.1, 0, -0.1] as [number, number, number],
  max: [0.1, 0.6, 0.1] as [number, number, number],
};

const manifest: Manifest = {
  version: 1,
  generatedAt: '2026-11-27T00:00:00Z',
  source: { name: 'Z-Anatomy', version: '2023', license: 'CC-BY-SA-4.0' },
  centerlines: {
    file: 'centerlines.12345678.json',
    bytes: 512,
    sha256: 'c'.repeat(64),
  },
  bundles: [
    {
      id: 'skeletal',
      file: 'skeletal.glb',
      bytes: 100,
      sha256: 'a'.repeat(64),
      meshIds: ['femur--l', 'sternum'],
    },
    {
      id: 'organs',
      file: 'organs.glb',
      bytes: 100,
      sha256: 'b'.repeat(64),
      meshIds: ['tongue', 'stomach'],
    },
  ],
  meshes: {
    'femur--l': { bundle: 'skeletal', bounds, triangles: 10, sizeClass: 'large' },
    sternum: { bundle: 'skeletal', bounds, triangles: 10, sizeClass: 'medium' },
    tongue: { bundle: 'organs', bounds, triangles: 10, sizeClass: 'small' },
    stomach: { bundle: 'organs', bounds, triangles: 10, sizeClass: 'medium' },
  },
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
      organs: ['tongue'],
      view: { c: [0, 0.5, 0.6, 0, 0.5, 0], s: ['digestive'], h: [], sel: [] },
      path: [{ line: 'mouth' }],
      modelled: true,
      nutrients: { carbs: 5, protein: 0, fat: 0, water: 0, absorbed: 0 },
    },
    {
      id: 'stomach',
      durationS: 14,
      food: 'chyme',
      radius: 0.011,
      motion: 'churn',
      organs: ['stomach'],
      view: { c: [0, 0.2, 0.7, 0, 0.2, 0], s: ['digestive', 'skeletal'], o: { skeletal: 0.15 }, h: [], sel: [] },
      path: [{ line: 'stomach' }],
      modelled: true,
      nutrients: { carbs: 30, protein: 15, fat: 10, water: 0, absorbed: 0 },
    },
  ],
};

const enTexts: JourneyTextsFile = {
  journeys: {
    digestion: {
      title: 'Follow a bite of food',
      summary: 'Summary',
      stages: {
        mouth: { title: 'Chewing', body: 'Mouth stage.' },
        stomach: { title: 'Stomach', body: 'Acid churn.' },
      },
      events: {},
    },
  },
};

const trTexts: JourneyTextsFile = {
  journeys: {
    digestion: {
      title: 'Bir lokmanın yolculuğu',
      summary: 'Özet',
      stages: {
        mouth: { title: 'Çiğneme', body: 'Ağız aşaması.' },
        stomach: { title: 'Mide', body: 'Asit karışımı.' },
      },
      events: {},
    },
  },
};

const centerlinesFile = {
  version: 1,
  lines: {
    mouth: [
      [0, 0.5, 0],
      [0, 0.4, 0],
    ],
    stomach: [
      [0, 0.3, 0],
      [0, 0.2, 0],
    ],
  },
};

function stubFetch(opts: { failDefs?: boolean } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.endsWith('content/journeys.json')) {
        if (opts.failDefs) {
          return Promise.resolve(new Response(null, { status: 500 }));
        }
        return Promise.resolve(
          new Response(JSON.stringify({ journeys: [fixtureJourney] }), {
            status: 200,
          }),
        );
      }
      if (url.endsWith('content/en/journeys.json')) {
        return Promise.resolve(
          new Response(JSON.stringify(enTexts), { status: 200 }),
        );
      }
      if (url.endsWith('content/tr/journeys.json')) {
        return Promise.resolve(
          new Response(JSON.stringify(trTexts), { status: 200 }),
        );
      }
      if (url.endsWith('models/centerlines.12345678.json')) {
        return Promise.resolve(
          new Response(JSON.stringify(centerlinesFile), { status: 200 }),
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    }),
  );
}

function makeTestStore() {
  const setPose = vi.fn((_p: unknown, _animate: unknown) => Promise.resolve());
  const followTarget = vi.fn();
  let currentPose = {
    position: [1, 2, 3] as [number, number, number],
    target: [0, 1, 0] as [number, number, number],
  };
  const camera: CameraRef = {
    current: {
      goToPreset: vi.fn(() => Promise.resolve()),
      setPose: vi.fn((p, animate) => {
        currentPose = p;
        return setPose(p, animate);
      }),
      focusBox: vi.fn(() => Promise.resolve()),
      getPose: () => currentPose,
      followTarget,
    } as unknown as NonNullable<CameraRef['current']>,
  };

  const store = makeStore(
    {
      assets: {
        manifest,
        boot: 'ready',
        bundles: { skeletal: 'ready', organs: 'ready' },
        requested: [],
      },
      content: {
        locale: 'en',
        taxonomy,
        index: {
          locale: 'en',
          structures: [
            { id: 'femur', paired: true, system: 'skeletal', region: 'lower-limb', kind: 'bone', tissue: 'bone', featured: true, names: { common: 'Femur', synonyms: [] } },
            { id: 'sternum', paired: false, system: 'skeletal', region: 'thorax', kind: 'bone', tissue: 'bone', featured: true, names: { common: 'Sternum', synonyms: [] } },
            { id: 'tongue', paired: false, system: 'digestive', region: 'head', kind: 'organ', tissue: 'muscle', featured: true, names: { common: 'Tongue', synonyms: [] } },
            { id: 'stomach', paired: false, system: 'digestive', region: 'abdomen', kind: 'organ', tissue: 'other', featured: true, names: { common: 'Stomach', synonyms: [] } },
          ],
        },
        enIndex: null,
        structures: {},
        fallback: { index: [], structures: {} },
      },
    },
    { camera },
  );
  return { store, setPose, followTarget };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('journey thunks and exclusivity', () => {
  it('loads journeys once and reloads texts when locale changes', async () => {
    stubFetch();
    const { store } = makeTestStore();
    await store.dispatch(loadJourneys());
    expect(store.getState().journey.loadStatus).toBe('ready');
    expect(store.getState().journey.texts?.digestion.title).toBe(
      'Follow a bite of food',
    );

    store.dispatch(localeSet('tr'));
    await new Promise((r) => setTimeout(r, 20));
    expect(store.getState().journey.texts?.digestion.title).toBe(
      'Bir lokmanın yolculuğu',
    );
  });

  it('startJourney captures pre-journey view and exitJourney restores it and stops following', async () => {
    stubFetch();
    const { store, setPose, followTarget } = makeTestStore();
    store.dispatch(hide(['femur--l']));

    const res = await store.dispatch(startJourney('digestion', 0));
    expect(res).toBe('started');
    expect(store.getState().journey.activeId).toBe('digestion');
    expect(store.getState().dissection.hidden).toEqual([]);
    expect(journeyClock.get()).toBe(0);

    await store.dispatch(exitJourney());
    expect(followTarget).toHaveBeenCalledWith(null);
    expect(store.getState().journey.activeId).toBeNull();
    expect(store.getState().dissection.hidden).toEqual(['femur--l']);
    expect(setPose).toHaveBeenLastCalledWith(
      { position: [1, 2, 3], target: [0, 1, 0] },
      true,
    );
  });

  it('refuses during quiz and exits active tour + stops motion on start', async () => {
    stubFetch();
    const { store } = makeTestStore();

    store.dispatch(
      quizStarted({
        questions: ['femur'],
        savedDissection: { hidden: [], isolated: null, faded: null },
        best: 0,
      }),
    );
    expect(await store.dispatch(startJourney('digestion'))).toBe('refused');

    const { store: s2 } = makeTestStore();
    s2.dispatch(
      toursLoaded({
        defs: [
          {
            id: 'arm',
            systems: ['skeletal'],
            steps: [
              {
                id: 's1',
                view: { c: [1, 0, 2, 0, 0, 0], s: ['skeletal'], h: [], sel: [] },
              },
            ],
          },
        ],
        texts: {},
      }),
    );
    await s2.dispatch(startTour('arm', 0));
    s2.dispatch(motionsLoaded([]));
    s2.dispatch(motionActivated({ id: 'm1', playing: true }));

    expect(await s2.dispatch(startJourney('digestion'))).toBe('started');
    expect(s2.getState().tour.activeId).toBeNull();
    expect(s2.getState().motion.activeId).toBeNull();

    // While journey is active, tours, motion and quiz start are refused
    expect(await s2.dispatch(startTour('arm'))).toBe('refused');
    expect(s2.dispatch(startQuiz(1))).toBe('refused');
    await s2.dispatch(startMotion('elbow-flexion'));
    expect(s2.getState().motion.activeId).toBeNull();
  });

  it('goToStage clamps, nextStage on last stage exits, and scrubJourney updates view only across boundaries', async () => {
    stubFetch();
    const { store, setPose } = makeTestStore();
    store.dispatch(systemToggled('digestive'));
    await store.dispatch(startJourney('digestion', 0));

    const callsAfterStart = setPose.mock.calls.length;
    await store.dispatch(scrubJourney(0.15));
    expect(store.getState().journey.stageIndex).toBe(0);
    expect(store.getState().journey.playing).toBe(false);
    expect(setPose.mock.calls.length).toBe(callsAfterStart);

    // Cross into stage 1
    await store.dispatch(scrubJourney(0.85));
    expect(store.getState().journey.stageIndex).toBe(1);
    expect(setPose.mock.calls.length).toBe(callsAfterStart + 1);

    // Clamp high stage index -> stage 1, then prevStage -> stage 0
    await store.dispatch(goToStage(99));
    expect(store.getState().journey.stageIndex).toBe(1);
    await store.dispatch(prevStage());
    expect(store.getState().journey.stageIndex).toBe(0);

    // Advance twice -> finishes journey
    await store.dispatch(nextStage());
    expect(store.getState().journey.stageIndex).toBe(1);
    await store.dispatch(nextStage());
    expect(store.getState().journey.activeId).toBeNull();
  });
});
