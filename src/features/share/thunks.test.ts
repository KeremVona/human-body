import { afterEach, describe, expect, it, vi } from 'vitest';
import rawTaxonomy from '../../../content/taxonomy.json';
import { makeStore, type CameraRef } from '../../app/store';
import { TaxonomySchema, type Manifest } from '../../data/schema';
import { hide } from '../dissection/dissectionSlice';
import { pinAdded } from '../pins/pinsSlice';
import { selected } from '../selection/selectionSlice';
import { opacitySet, systemToggled } from '../systems/systemsSlice';
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
});
