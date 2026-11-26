import { afterEach, describe, expect, it, vi } from 'vitest';
import rawTaxonomy from '../../../content/taxonomy.json';
import { makeStore, type CameraRef } from '../../app/store';
import { TaxonomySchema, type Manifest } from '../../data/schema';
import { hide } from '../dissection/dissectionSlice';
import { pinAdded } from '../pins/pinsSlice';
import { selected } from '../selection/selectionSlice';
import { opacitySet, systemToggled } from '../systems/systemsSlice';
import { sectionSet } from '../section/sectionSlice';
import { bootShare } from './bootShare';
import { encodeViewState } from './codec';
import { applyViewState, captureViewState } from './thunks';

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
    'femur--l': {
      bundle: 'skeletal',
      bounds,
      triangles: 10,
      sizeClass: 'large',
    },
    sternum: {
      bundle: 'skeletal',
      bounds,
      triangles: 10,
      sizeClass: 'medium',
    },
    'biceps-brachii--l': {
      bundle: 'muscular',
      bounds,
      triangles: 10,
      sizeClass: 'large',
    },
  },
};

function setupStore(
  pose = {
    position: [0, 0, 3] as [number, number, number],
    target: [0, 0, 0] as [number, number, number],
  },
) {
  const camera: CameraRef = {
    current: {
      focusMeshes: vi.fn(async () => {}),
      goToPreset: vi.fn(async () => {}),
      resetView: vi.fn(async () => {}),
      zoom: vi.fn(),
      getPose: vi.fn(() => pose),
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
        index: { locale: 'en', structures: [] },
        structures: {},
      },
    },
    { camera },
  );

  return { store, camera: camera.current! };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('share thunks & bootShare', () => {
  it('captureViewState reads store and camera', () => {
    const { store } = setupStore();
    store.dispatch(systemToggled('muscular'));
    store.dispatch(opacitySet({ systems: ['muscular'], opacity: 0.5 }));
    store.dispatch(hide(['sternum']));
    store.dispatch(selected(['femur--l']));

    const view = store.dispatch(captureViewState({ includePins: false }));
    expect(view).toEqual({
      c: [0, 0, 3, 0, 0, 0],
      s: ['muscular', 'skeletal'],
      o: { muscular: 0.5 },
      h: ['sternum'],
      sel: ['femur--l'],
    });
  });

  it('applyViewState restores everything and clears undo', async () => {
    const { store, camera } = setupStore();
    store.dispatch(hide(['femur--l']));
    expect(store.getState().dissection.past.length).toBeGreaterThan(0);

    await store.dispatch(
      applyViewState({
        c: [0, 0, 3, 0, 0, 0],
        s: ['muscular', 'skeletal'],
        o: { muscular: 0.5 },
        h: ['sternum'],
        sel: ['femur--l'],
      }),
    );

    const next = store.getState();
    expect(next.systems.muscular.enabled).toBe(true);
    expect(next.systems.skeletal.enabled).toBe(true);
    expect(next.systems.muscular.opacity).toBe(0.5);
    expect(next.dissection.hidden).toEqual(['sternum']);
    expect(next.dissection.past).toEqual([]);
    expect(next.selection.selectedIds).toEqual(['femur--l']);
    expect(camera.setPose).toHaveBeenCalledTimes(1);
    expect(camera.setPose).toHaveBeenCalledWith(
      { position: [0, 0, 3], target: [0, 0, 0] },
      false,
    );
  });

  it('applyViewState skips unknown ids and shows skipped notice via bootShare', async () => {
    const { store } = setupStore();
    const staleHash = await encodeViewState({
      c: [0, 0, 3, 0, 0, 0],
      s: ['skeletal'],
      h: ['sternum', 'gone--l'],
      sel: ['femur--l'],
    });

    await bootShare(store, { hash: staleHash });
    expect(store.getState().share.notice).toBe('skipped');
    expect(store.getState().dissection.hidden).toEqual(['sternum']);
    expect(store.getState().selection.selectedIds).toEqual(['femur--l']);
  });

  it('bootShare ignores non-view hashes without loading codec', async () => {
    const { store } = setupStore();
    const loadCodec = vi.fn();

    await bootShare(store, { hash: '#debug', loadCodec });
    expect(loadCodec).not.toHaveBeenCalled();
    expect(store.getState().share.notice).toBeNull();
  });

  it('malformed hash shows the notice and changes nothing', async () => {
    const { store } = setupStore();

    await bootShare(store, { hash: '#v1.zzz' });
    expect(store.getState().share.notice).toBe('malformed');
    expect(store.getState().systems.skeletal.enabled).toBe(true);
    expect(store.getState().systems.muscular.enabled).toBe(false);
  });

  it('captures own pins only when asked', () => {
    const { store } = setupStore();
    store.dispatch(
      pinAdded({
        meshId: 'femur--l',
        local: [0.1, 0.2, 0.3],
        label: 'Femur spot',
      }),
    );

    const withoutPins = store.dispatch(
      captureViewState({ includePins: false }),
    );
    expect(withoutPins.p).toBeUndefined();

    const withPins = store.dispatch(captureViewState({ includePins: true }));
    expect(withPins.p).toEqual([
      { m: 'femur--l', l: [0.1, 0.2, 0.3], t: 'Femur spot' },
    ]);
  });

  it('applies shared pins read-only', async () => {
    const { store } = setupStore();
    await store.dispatch(
      applyViewState({
        c: [0, 0, 3, 0, 0, 0],
        s: ['skeletal'],
        h: [],
        sel: [],
        p: [{ m: 'femur--l', l: [0, 1, 0], t: 'Shared bone', n: 'Read only' }],
      }),
    );

    expect(store.getState().pins.items).toHaveLength(1);
    expect(store.getState().pins.items[0]).toMatchObject({
      meshId: 'femur--l',
      local: [0, 1, 0],
      label: 'Shared bone',
      note: 'Read only',
      shared: true,
    });
  });

  it('applies remaining state when a requested bundle fails during applyViewState', async () => {
    const { store } = setupStore();
    store.dispatch({ type: 'assets/bundleFailed', payload: 'muscular' });

    await store.dispatch(
      applyViewState({
        c: [0, 0, 3, 0, 0, 0],
        s: ['skeletal', 'muscular'],
        h: ['femur--l'],
        sel: ['sternum'],
      }),
    );

    expect(store.getState().dissection.hidden).toEqual(['femur--l']);
    expect(store.getState().selection.selectedIds).toEqual(['sternum']);
  });

  it('captures the cross-section in x when enabled and omits it when off', () => {
    const { store } = setupStore();
    expect(
      store.dispatch(captureViewState({ includePins: false })).x,
    ).toBeUndefined();

    store.dispatch(
      sectionSet({ enabled: true, axis: 'sagittal', t: 0.3, flip: true }),
    );
    expect(store.dispatch(captureViewState({ includePins: false })).x).toEqual([
      1, 0.3, 1,
    ]);
  });

  it('applies the cross-section from x and disables it when x is absent', async () => {
    const { store } = setupStore();

    await store.dispatch(
      applyViewState({
        c: [0, 0, 3, 0, 0, 0],
        s: ['skeletal'],
        h: [],
        sel: [],
        x: [2, 0.7, 0],
      }),
    );
    expect(store.getState().section).toEqual({
      enabled: true,
      axis: 'coronal',
      t: 0.7,
      flip: false,
    });

    await store.dispatch(
      applyViewState({
        c: [0, 0, 3, 0, 0, 0],
        s: ['skeletal'],
        h: [],
        sel: [],
      }),
    );
    expect(store.getState().section.enabled).toBe(false);
  });

  it('codec stores only non-default opacities and gives old links default skin opacity', async () => {
    const { store } = setupStore();

    expect(store.getState().systems.integumentary.opacity).toBe(0.35);
    expect(
      store.dispatch(captureViewState({ includePins: false })).o,
    ).toBeUndefined();

    store.dispatch(opacitySet({ systems: ['integumentary'], opacity: 0.6 }));
    expect(store.dispatch(captureViewState({ includePins: false })).o).toEqual({
      integumentary: 0.6,
    });

    await store.dispatch(
      applyViewState({
        c: [0, 0, 3, 0, 0, 0],
        s: ['skeletal', 'integumentary'],
        h: [],
        sel: [],
      }),
    );
    expect(store.getState().systems.integumentary.opacity).toBe(0.35);
  });

  it('keepHistory preserves dissection undo stack while restoring target sets', async () => {
    const { store } = setupStore();
    store.dispatch(hide(['femur--l']));
    store.dispatch(hide(['sternum']));
    store.dispatch(hide(['biceps-brachii--l']));
    expect(store.getState().dissection.past).toHaveLength(3);

    await store.dispatch(
      applyViewState(
        {
          c: [0, 0, 3, 0, 0, 0],
          s: ['skeletal'],
          h: ['sternum'],
          i: ['femur--l'],
          sel: [],
        },
        { keepHistory: true },
      ),
    );

    expect(store.getState().dissection.past).toHaveLength(3);
    expect(store.getState().dissection.hidden).toEqual(['sternum']);
    expect(store.getState().dissection.isolated).toEqual(['femur--l']);
    expect(store.getState().dissection.faded).toBeNull();
  });

  it('keepPins leaves existing shared pins untouched', async () => {
    const { store } = setupStore();
    await store.dispatch(
      applyViewState({
        c: [0, 0, 3, 0, 0, 0],
        s: ['skeletal'],
        h: [],
        sel: [],
        p: [{ m: 'femur--l', l: [0, 1, 0], t: 'Keep me' }],
      }),
    );
    expect(store.getState().pins.items).toHaveLength(1);

    await store.dispatch(
      applyViewState(
        {
          c: [0, 0, 2, 0, 0, 0],
          s: ['skeletal'],
          h: [],
          sel: [],
        },
        { keepPins: true },
      ),
    );
    expect(store.getState().pins.items).toHaveLength(1);
    expect(store.getState().pins.items[0].label).toBe('Keep me');
  });

  it('animate forwards animate option to camera setPose', async () => {
    const { store, camera } = setupStore();
    await store.dispatch(
      applyViewState(
        {
          c: [1, 2, 3, 0, 0, 0],
          s: ['skeletal'],
          h: [],
          sel: [],
        },
        { animate: true },
      ),
    );
    expect(camera.setPose).toHaveBeenCalledWith(
      { position: [1, 2, 3], target: [0, 0, 0] },
      true,
    );
  });

  it('bootShare starts a tour at the requested 1-based step without importing tours for non-tour hashes', async () => {
    const { store } = setupStore();
    const loadToursSpy = vi.fn();

    await bootShare(store, { hash: '#debug', loadTours: loadToursSpy });
    expect(loadToursSpy).not.toHaveBeenCalled();

    const { tourStarted: ts } = await import('../tours/tourSlice');
    expect(typeof ts).toBe('function');

    await bootShare(store, {
      hash: '#tour/sample-tour/2',
      loadTours: async () => {
        loadToursSpy();
        const { toursLoaded } = await import('../tours/tourSlice');
        return {
          loadTours: () => async (dispatch) => {
            dispatch(
              toursLoaded({
                defs: [
                  {
                    id: 'sample-tour',
                    steps: [
                      {
                        id: 'step-1',
                        view: {
                          c: [0, 0, 3, 0, 0, 0],
                          s: ['skeletal'],
                          h: [],
                          sel: [],
                        },
                      },
                      {
                        id: 'step-2',
                        view: {
                          c: [1, 1, 2, 0, 0, 0],
                          s: ['skeletal', 'muscular'],
                          h: ['sternum'],
                          sel: ['biceps-brachii--l'],
                        },
                      },
                      {
                        id: 'step-3',
                        view: {
                          c: [0, 0, 3, 0, 0, 0],
                          s: ['skeletal'],
                          h: [],
                          sel: [],
                        },
                      },
                      {
                        id: 'step-4',
                        view: {
                          c: [0, 0, 3, 0, 0, 0],
                          s: ['skeletal'],
                          h: [],
                          sel: [],
                        },
                      },
                    ],
                  },
                ],
                texts: {
                  'sample-tour': {
                    title: 'Sample Tour',
                    summary: 'Summary',
                    fallback: false,
                    steps: {
                      'step-1': { title: 'One', body: 'One' },
                      'step-2': { title: 'Two', body: 'Two' },
                      'step-3': { title: 'Three', body: 'Three' },
                      'step-4': { title: 'Four', body: 'Four' },
                    },
                  },
                },
              }),
            );
          },
          startTour: (await import('../tours/thunks')).startTour,
        };
      },
    });

    expect(loadToursSpy).toHaveBeenCalledTimes(1);
    expect(store.getState().tour.activeId).toBe('sample-tour');
    expect(store.getState().tour.stepIndex).toBe(1);
    expect(store.getState().selection.selectedIds).toEqual([
      'biceps-brachii--l',
    ]);
  });

  it('bootShare sets tour not-found notice and leaves defaults unchanged for out-of-range step', async () => {
    const { store } = setupStore();

    await bootShare(store, {
      hash: '#tour/sample-tour/9',
      loadTours: async () => {
        const { toursLoaded } = await import('../tours/tourSlice');
        return {
          loadTours: () => async (dispatch) => {
            dispatch(
              toursLoaded({
                defs: [
                  {
                    id: 'sample-tour',
                    steps: [
                      {
                        id: 'step-1',
                        view: {
                          c: [0, 0, 3, 0, 0, 0],
                          s: ['skeletal'],
                          h: [],
                          sel: [],
                        },
                      },
                      {
                        id: 'step-2',
                        view: {
                          c: [0, 0, 3, 0, 0, 0],
                          s: ['skeletal'],
                          h: [],
                          sel: [],
                        },
                      },
                      {
                        id: 'step-3',
                        view: {
                          c: [0, 0, 3, 0, 0, 0],
                          s: ['skeletal'],
                          h: [],
                          sel: [],
                        },
                      },
                      {
                        id: 'step-4',
                        view: {
                          c: [0, 0, 3, 0, 0, 0],
                          s: ['skeletal'],
                          h: [],
                          sel: [],
                        },
                      },
                    ],
                  },
                ],
                texts: {},
              }),
            );
          },
          startTour: (await import('../tours/thunks')).startTour,
        };
      },
    });

    expect(store.getState().tour.notice).toBe('not-found');
    expect(store.getState().tour.activeId).toBeNull();
    expect(store.getState().systems.skeletal.enabled).toBe(true);
    expect(store.getState().systems.muscular.enabled).toBe(false);
  });
});
