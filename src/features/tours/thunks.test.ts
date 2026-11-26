import { afterEach, describe, expect, it, vi } from 'vitest';
import rawTaxonomy from '../../../content/taxonomy.json';
import { makeStore, type CameraRef } from '../../app/store';
import { TaxonomySchema, type Manifest } from '../../data/schema';
import { hide } from '../dissection/dissectionSlice';
import { quizEnded, quizStarted } from '../quiz/quizSlice';
import { startQuiz } from '../quiz/thunks';
import { localeSet } from '../settings/uiSlice';
import { systemToggled } from '../systems/systemsSlice';
import { toursLoaded } from './tourSlice';
import { exitTour, loadTours, nextStep, prevStep, startTour } from './thunks';
import type { Tour } from './schema';
import type { TourText } from './localizeTours';

const taxonomy = TaxonomySchema.parse(rawTaxonomy);

const bounds = {
  min: [0, 0, 0] as [number, number, number],
  max: [0.1, 0.2, 0.1] as [number, number, number],
};

const manifest: Manifest = {
  version: 1,
  generatedAt: '2026-11-21T00:00:00Z',
  source: {
    name: 'Z-Anatomy',
    version: '2023-05-02',
    license: 'CC-BY-SA-4.0',
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
      id: 'muscular',
      file: 'muscular.glb',
      bytes: 100,
      sha256: 'b'.repeat(64),
      meshIds: ['biceps-brachii--l'],
    },
  ],
  meshes: {
    'femur--l': { bundle: 'skeletal', bounds, triangles: 10, sizeClass: 'large' },
    sternum: { bundle: 'skeletal', bounds, triangles: 10, sizeClass: 'medium' },
    'biceps-brachii--l': {
      bundle: 'muscular',
      bounds,
      triangles: 10,
      sizeClass: 'large',
    },
  },
};

const fixtureTour: Tour = {
  id: 'arm-bone-to-muscle',
  systems: ['skeletal', 'muscular'],
  steps: [
    {
      id: 'step-1',
      view: {
        c: [1, 0, 2, 0, 0, 0],
        s: ['skeletal'],
        h: [],
        sel: ['femur--l'],
      },
    },
    {
      id: 'step-2',
      view: {
        c: [2, 0, 2, 0, 0, 0],
        s: ['skeletal', 'muscular'],
        h: ['sternum'],
        sel: ['biceps-brachii--l'],
      },
    },
    {
      id: 'step-3',
      view: {
        c: [3, 0, 2, 0, 0, 0],
        s: ['skeletal', 'muscular'],
        h: [],
        sel: ['biceps-brachii--l'],
      },
      motion: { id: 'elbow-flexion', phase: 0.4 },
    },
    {
      id: 'step-4',
      view: {
        c: [4, 0, 2, 0, 0, 0],
        s: ['muscular'],
        h: [],
        sel: [],
      },
    },
  ],
};

const enTexts: Record<string, TourText> = {
  'arm-bone-to-muscle': {
    title: 'From bone to muscle',
    summary: 'Overview',
    fallback: false,
    steps: {
      'step-1': { title: 'Step 1', body: 'One' },
      'step-2': { title: 'Step 2', body: 'Two' },
      'step-3': { title: 'Step 3', body: 'Three' },
      'step-4': { title: 'Step 4', body: 'Four' },
    },
  },
};

function setupStore() {
  const camera: CameraRef = {
    current: {
      focusMeshes: vi.fn(async () => {}),
      goToPreset: vi.fn(async () => {}),
      resetView: vi.fn(async () => {}),
      zoom: vi.fn(),
      getPose: vi.fn(() => ({
        position: [0, 0, 3] as [number, number, number],
        target: [0, 0, 0] as [number, number, number],
      })),
      setPose: vi.fn(async () => {}),
      lookAtPoint: vi.fn(async () => {}),
    },
  };

  const store = makeStore(
    {
      assets: {
        manifest,
        boot: 'ready',
        bundles: { skeletal: 'ready', muscular: 'ready' },
        requested: [],
      },
      content: {
        taxonomy,
        index: {
          locale: 'en',
          structures: [
            {
              id: 'femur',
              system: 'skeletal',
              region: 'lower-limb',
              paired: true,
              kind: 'bone',
              tissue: 'bone',
              names: { common: 'Femur', latin: 'Os femoris', synonyms: [] },
              featured: true,
            },
          ],
        },
        structures: {},
      },
    },
    { camera },
  );

  store.dispatch(toursLoaded({ defs: [fixtureTour], texts: enTexts }));
  return { store, camera: camera.current! };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('tour thunks', () => {
  it('start captures pre-tour view and applies step 1 with animation', async () => {
    const { store, camera } = setupStore();
    store.dispatch(systemToggled('integumentary'));
    const res = await store.dispatch(startTour('arm-bone-to-muscle'));

    expect(res).toBe('started');
    expect(store.getState().tour.activeId).toBe('arm-bone-to-muscle');
    expect(store.getState().tour.stepIndex).toBe(0);
    expect(store.getState().tour.savedView).toEqual({
      c: [0, 0, 3, 0, 0, 0],
      s: ['integumentary', 'skeletal'],
      h: [],
      sel: [],
    });
    expect(store.getState().systems.skeletal.enabled).toBe(true);
    expect(store.getState().systems.integumentary.enabled).toBe(false);
    expect(store.getState().selection.selectedIds).toEqual(['femur--l']);
    expect(camera.setPose).toHaveBeenCalledWith(
      { position: [1, 0, 2], target: [0, 0, 0] },
      true,
    );
  });

  it('nextStep and prevStep walk steps and handle motion paused at phase vs stopMotion', async () => {
    const { store } = setupStore();
    const motionSpies = {
      startMotion: vi.fn(() => async () => {}),
      stopMotion: vi.fn(() => () => {}),
    };

    await store.dispatch(startTour('arm-bone-to-muscle', 0, motionSpies));
    await store.dispatch(nextStep(motionSpies));
    expect(store.getState().tour.stepIndex).toBe(1);
    expect(store.getState().selection.selectedIds).toEqual(['biceps-brachii--l']);

    await store.dispatch(nextStep(motionSpies));
    expect(store.getState().tour.stepIndex).toBe(2);
    expect(motionSpies.startMotion).toHaveBeenCalledWith('elbow-flexion', {
      skipCamera: true,
    });
    expect(store.getState().motion.playing).toBe(false);
    expect(store.getState().motion.scrubPhase).toBe(0.4);

    await store.dispatch(nextStep(motionSpies));
    expect(store.getState().tour.stepIndex).toBe(3);
    expect(motionSpies.stopMotion).toHaveBeenCalled();

    await store.dispatch(prevStep(motionSpies));
    expect(store.getState().tour.stepIndex).toBe(2);
  });

  it('exit restores pre-tour view and preserves undo history', async () => {
    const { store, camera } = setupStore();
    store.dispatch(hide(['sternum']));
    store.dispatch(hide(['femur--l']));
    expect(store.getState().dissection.past).toHaveLength(2);

    await store.dispatch(startTour('arm-bone-to-muscle'));
    store.dispatch(hide(['biceps-brachii--l']));

    await store.dispatch(exitTour());

    expect(store.getState().tour.activeId).toBeNull();
    expect(store.getState().dissection.hidden).toEqual(['femur--l', 'sternum']);
    expect(store.getState().dissection.past.length).toBeGreaterThanOrEqual(2);
    expect(camera.setPose).toHaveBeenLastCalledWith(
      { position: [0, 0, 3], target: [0, 0, 0] },
      true,
    );
  });

  it('finish on the last step exits the tour and restores view', async () => {
    const { store } = setupStore();
    store.dispatch(systemToggled('integumentary'));
    await store.dispatch(startTour('arm-bone-to-muscle', 3));
    expect(store.getState().tour.stepIndex).toBe(3);

    await store.dispatch(nextStep());
    expect(store.getState().tour.activeId).toBeNull();
    expect(store.getState().systems.integumentary.enabled).toBe(true);
  });

  it('refuses to start a tour while quiz is active and refuses quiz while tour is active', async () => {
    const { store } = setupStore();
    store.dispatch(
      quizStarted({
        questions: ['femur--l'],
        savedDissection: { hidden: [], isolated: null, faded: null },
        best: 0,
      }),
    );
    expect(await store.dispatch(startTour('arm-bone-to-muscle'))).toBe(
      'refused',
    );
    expect(store.getState().tour.activeId).toBeNull();

    store.dispatch(quizEnded());
    expect(await store.dispatch(startTour('arm-bone-to-muscle'))).toBe(
      'started',
    );
    expect(store.dispatch(startQuiz(1))).toBe('refused');
    expect(store.getState().quiz.status).toBe('off');
  });

  it('sets not-found notice and leaves view untouched for bad id or out-of-range step', async () => {
    const { store } = setupStore();
    store.dispatch(systemToggled('integumentary'));
    expect(await store.dispatch(startTour('nope'))).toBe('not-found');
    expect(store.getState().tour.notice).toBe('not-found');
    expect(store.getState().tour.activeId).toBeNull();

    expect(await store.dispatch(startTour('arm-bone-to-muscle', 9))).toBe(
      'not-found',
    );
    expect(store.getState().tour.notice).toBe('not-found');
    expect(store.getState().systems.integumentary.enabled).toBe(true);
  });

  it('reloads tour texts on locale change without losing active tour or step', async () => {
    const { store } = setupStore();
    await store.dispatch(startTour('arm-bone-to-muscle', 2));

    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('content/tours.json')) {
        return new Response(JSON.stringify({ tours: [fixtureTour] }), {
          status: 200,
        });
      }
      if (url.endsWith('content/en/tours.json')) {
        return new Response(
          JSON.stringify({
            tours: {
              'arm-bone-to-muscle': {
                title: 'From bone to muscle',
                summary: 'Overview',
                steps: enTexts['arm-bone-to-muscle'].steps,
              },
            },
          }),
          { status: 200 },
        );
      }
      if (url.endsWith('content/tr/tours.json')) {
        return new Response(
          JSON.stringify({
            tours: {
              'arm-bone-to-muscle': {
                title: 'Kemikten kasa',
                summary: 'Özet',
                steps: { 'step-3': { title: 'Adım 3', body: 'Üç' } },
              },
            },
          }),
          { status: 200 },
        );
      }
      return new Response('not found', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await store.dispatch(localeSet('tr'));
    await new Promise((r) => setTimeout(r, 20));

    expect(store.getState().tour.activeId).toBe('arm-bone-to-muscle');
    expect(store.getState().tour.stepIndex).toBe(2);
    expect(
      store.getState().tour.texts?.['arm-bone-to-muscle'].steps['step-3'].title,
    ).toBe('Adım 3');
  });

  it('loadTours falls back to English when locale tours JSON 404s', async () => {
    const { store } = setupStore();
    store.dispatch(toursLoaded({ defs: [], texts: {} }));
    const emptyStore = makeStore(
      { ui: { quality: 'auto', locale: 'tr' } },
      { camera: { current: null } },
    );

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('content/tours.json')) {
          return new Response(JSON.stringify({ tours: [fixtureTour] }), {
            status: 200,
          });
        }
        if (url.endsWith('content/en/tours.json')) {
          return new Response(
            JSON.stringify({
              tours: {
                'arm-bone-to-muscle': {
                  title: 'From bone to muscle',
                  summary: 'Overview',
                  steps: enTexts['arm-bone-to-muscle'].steps,
                },
              },
            }),
            { status: 200 },
          );
        }
        return new Response('missing', { status: 404 });
      }),
    );

    await emptyStore.dispatch(loadTours());
    expect(emptyStore.getState().tour.loadStatus).toBe('ready');
    expect(emptyStore.getState().tour.texts?.['arm-bone-to-muscle'].fallback).toBe(
      true,
    );
    expect(store.getState().tour.defs).toEqual([]);
  });
});
