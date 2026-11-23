import type { Manifest } from '../../data/schema';
import { makeStore } from '../../app/store';
import {
  assetsReducer,
  bundleFailed,
  bundleRetry,
  bundlesRequested,
  bundleStarted,
  retryBundle,
  selectBundlesForSystem,
} from './assetsSlice';

const clearMock = vi.hoisted(() => vi.fn());

vi.mock('../../scene/gltfCache', () => ({
  clearGltf: clearMock,
  preloadGltf: vi.fn(),
  registerGltfHandlers: vi.fn(),
}));

const sampleManifest: Manifest = {
  version: 1,
  generatedAt: '2026-11-21T00:00:00Z',
  source: { name: 'Z-Anatomy', version: '2023-05-02', license: 'CC-BY-SA-4.0' },
  bundles: [
    {
      id: 'skeletal',
      file: 'skeletal.1111aaaa.glb',
      bytes: 100,
      sha256: 'a'.repeat(64),
      meshIds: ['femur--l', 'sternum'],
    },
    {
      id: 'organs',
      file: 'organs.2222bbbb.glb',
      bytes: 200,
      sha256: 'b'.repeat(64),
      meshIds: ['stomach', 'liver'],
    },
  ],
  meshes: {
    'femur--l': {
      bundle: 'skeletal',
      bounds: { min: [0, 0, 0], max: [0.1, 0.4, 0.1] },
      triangles: 10,
      sizeClass: 'large',
    },
    sternum: {
      bundle: 'skeletal',
      bounds: { min: [0, 0, 0], max: [0.1, 0.2, 0.1] },
      triangles: 10,
      sizeClass: 'medium',
    },
    stomach: {
      bundle: 'organs',
      bounds: { min: [0, 0, 0], max: [0.1, 0.2, 0.1] },
      triangles: 10,
      sizeClass: 'medium',
    },
    liver: {
      bundle: 'organs',
      bounds: { min: [0, 0, 0], max: [0.2, 0.2, 0.1] },
      triangles: 10,
      sizeClass: 'large',
    },
  },
};

it('bundleRetry sets status back to idle and puts the id first in requested', () => {
  let state = assetsReducer(undefined, { type: '@@init' });
  state = {
    ...state,
    manifest: sampleManifest,
    boot: 'ready',
    bundles: { skeletal: 'error', organs: 'idle' },
    requested: ['organs'],
  };
  const next = assetsReducer(
    state,
    bundleRetry({ id: 'skeletal', meshIds: ['femur--l', 'sternum'] }),
  );
  expect(next.bundles.skeletal).toBe('idle');
  expect(next.requested).toEqual(['skeletal', 'organs']);
});

it('retryBundle reads manifest meshIds, clears GLTF cache via listener, and handles lifecycle', () => {
  clearMock.mockClear();
  const store = makeStore({
    assets: {
      manifest: sampleManifest,
      boot: 'ready',
      bundles: { skeletal: 'error', organs: 'idle' },
      requested: [],
    },
  });

  store.dispatch(bundlesRequested(['organs']));
  store.dispatch(retryBundle('skeletal'));
  expect(store.getState().assets.bundles.skeletal).toBe('idle');
  expect(store.getState().assets.requested).toEqual(['skeletal', 'organs']);
  expect(clearMock).toHaveBeenCalledWith('/models/skeletal.1111aaaa.glb');

  store.dispatch(bundleStarted('skeletal'));
  expect(store.getState().assets.bundles.skeletal).toBe('loading');
  expect(store.getState().assets.requested).toEqual(['organs']);

  store.dispatch(bundleFailed('skeletal'));
  expect(store.getState().assets.bundles.skeletal).toBe('error');
});

it('selectBundlesForSystem returns bundles containing meshes for that system', () => {
  const store = makeStore({
    assets: {
      manifest: sampleManifest,
      boot: 'ready',
      bundles: { skeletal: 'ready', organs: 'idle' },
      requested: [],
    },
    content: {
      taxonomy: null,
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
            names: { common: 'Femur', synonyms: [] },
            featured: false,
          },
          {
            id: 'stomach',
            system: 'digestive',
            region: 'abdomen',
            paired: false,
            kind: 'organ',
            tissue: 'organ',
            names: { common: 'Stomach', synonyms: [] },
            featured: false,
          },
        ],
      },
      structures: {},
    },
  });

  expect(selectBundlesForSystem(store.getState(), 'skeletal')).toEqual([
    'skeletal',
  ]);
  expect(selectBundlesForSystem(store.getState(), 'digestive')).toEqual([
    'organs',
  ]);
  expect(selectBundlesForSystem(store.getState(), 'muscular')).toEqual([]);
});
