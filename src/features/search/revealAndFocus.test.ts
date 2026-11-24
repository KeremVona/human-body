import { afterEach, describe, expect, it, vi } from 'vitest';
import rawTaxonomy from '../../../content/taxonomy.json';
import { makeStore, type CameraRef } from '../../app/store';
import {
  TaxonomySchema,
  type IndexFile,
  type Manifest,
} from '../../data/schema';
import { bundleFailed, bundleReady } from '../assets/assetsSlice';
import { hide, isolate } from '../dissection/dissectionSlice';
import { selected } from '../selection/selectionSlice';
import { revealAndFocus } from './revealAndFocus';

const taxonomy = TaxonomySchema.parse(rawTaxonomy);

const bounds = {
  min: [0, 0, 0] as [number, number, number],
  max: [0.1, 0.2, 0.1] as [number, number, number],
};

const manifest: Manifest = {
  version: 1,
  generatedAt: '2026-11-21T00:00:00Z',
  source: { name: 'Z-Anatomy', version: '2023-05-02', license: 'CC-BY-SA-4.0' },
  bundles: [
    {
      id: 'skeletal',
      file: 'skeletal.1111aaaa.glb',
      bytes: 10,
      sha256: 'a'.repeat(64),
      meshIds: ['femur--l', 'femur--r'],
    },
    {
      id: 'muscular',
      file: 'muscular.2222bbbb.glb',
      bytes: 10,
      sha256: 'b'.repeat(64),
      meshIds: ['biceps-brachii--l', 'biceps-brachii--r'],
    },
  ],
  meshes: {
    'femur--l': {
      bundle: 'skeletal',
      bounds,
      triangles: 10,
      sizeClass: 'large',
    },
    'femur--r': {
      bundle: 'skeletal',
      bounds,
      triangles: 10,
      sizeClass: 'large',
    },
    'biceps-brachii--l': {
      bundle: 'muscular',
      bounds,
      triangles: 10,
      sizeClass: 'medium',
    },
    'biceps-brachii--r': {
      bundle: 'muscular',
      bounds,
      triangles: 10,
      sizeClass: 'medium',
    },
  },
};

const index: IndexFile = {
  locale: 'en',
  structures: [
    {
      id: 'femur',
      system: 'skeletal',
      region: 'lower-limb',
      paired: true,
      kind: 'bone',
      tissue: 'bone',
      names: { common: 'Femur', synonyms: [] },
      featured: true,
    },
    {
      id: 'biceps-brachii',
      system: 'muscular',
      region: 'upper-limb',
      paired: true,
      kind: 'muscle',
      tissue: 'muscle',
      names: { common: 'Biceps brachii', synonyms: [] },
      featured: true,
    },
  ],
};

function setupStore(
  muscularStatus: 'idle' | 'ready' | 'error' = 'idle',
  cameraRef?: CameraRef,
) {
  const camera = cameraRef ?? {
    current: {
      focusMeshes: vi.fn(async () => {}),
      goToPreset: vi.fn(async () => {}),
      resetView: vi.fn(async () => {}),
      zoom: vi.fn(),
      getPose: vi.fn(() => null),
      setPose: vi.fn(async () => {}),
      lookAtPoint: vi.fn(async () => {}),
    },
  };

  const store = makeStore(
    {
      assets: {
        manifest,
        boot: 'ready',
        bundles: { skeletal: 'ready', muscular: muscularStatus },
        requested: [],
      },
      content: { taxonomy, index, structures: {} },
    },
    { camera },
  );

  return { store, camera };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('revealAndFocus', () => {
  it('reveals a hidden paired structure in a disabled system', async () => {
    const { store, camera } = setupStore('idle');
    store.dispatch(hide(['biceps-brachii--l']));
    store.dispatch(isolate(['femur--l']));

    const pending = store.dispatch(revealAndFocus('biceps-brachii'));
    expect(store.getState().systems.muscular.enabled).toBe(true);
    expect(store.getState().assets.requested).toContain('muscular');

    store.dispatch(bundleReady('muscular'));
    await pending;

    expect(store.getState().dissection.hidden).toEqual([]);
    expect(store.getState().dissection.isolated).toBeNull();
    expect(store.getState().selection.selectedIds).toEqual([
      'biceps-brachii--l',
      'biceps-brachii--r',
    ]);
    expect(camera.current!.focusMeshes).toHaveBeenCalledWith([
      'biceps-brachii--l',
      'biceps-brachii--r',
    ]);
  });

  it('selects one side when asked', async () => {
    const { store, camera } = setupStore('ready');
    await store.dispatch(revealAndFocus('biceps-brachii', 'left'));

    expect(store.getState().selection.selectedIds).toEqual([
      'biceps-brachii--l',
    ]);
    expect(camera.current!.focusMeshes).toHaveBeenCalledWith([
      'biceps-brachii--l',
    ]);
  });

  it('revealAndFocus rejects when the bundle fails', async () => {
    const { store, camera } = setupStore('idle');
    store.dispatch(selected(['femur--l']));

    const pending = store.dispatch(revealAndFocus('biceps-brachii'));
    store.dispatch(bundleFailed('muscular'));

    await expect(pending).rejects.toThrow('bundle failed: muscular');
    expect(store.getState().selection.selectedIds).toEqual(['femur--l']);
    expect(camera.current!.focusMeshes).not.toHaveBeenCalled();
  });

  it('times out after 30 s', async () => {
    vi.useFakeTimers();
    const { store, camera } = setupStore('idle');

    const pending = store.dispatch(revealAndFocus('biceps-brachii'));
    const expectation = expect(pending).rejects.toThrow(
      'bundle timeout: muscular',
    );
    await vi.advanceTimersByTimeAsync(30_000);
    await expectation;
    expect(camera.current!.focusMeshes).not.toHaveBeenCalled();
  });
});
