import { afterEach, describe, expect, it, vi } from 'vitest';
import rawTaxonomy from '../../../content/taxonomy.json';
import { makeStore, type CameraRef } from '../../app/store';
import { TaxonomySchema, type Manifest } from '../../data/schema';
import { bundleReady, bundleRetry } from '../assets/assetsSlice';
import { quizStarted } from '../quiz/quizSlice';
import {
  systemsSet,
  systemToggled,
  uiGroupToggled,
} from '../systems/systemsSlice';
import type { MotionsFile } from './schema';
import { loadMotions, startMotion, stopMotion } from './thunks';

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
      meshIds: ['humerus--l', 'radius--l'],
    },
    {
      id: 'muscular',
      file: 'muscular.glb',
      bytes: 100,
      sha256: 'b'.repeat(64),
      meshIds: [
        'long-head-of-biceps-brachii--l',
        'long-head-of-triceps-brachii--l',
      ],
    },
    {
      id: 'cardiovascular',
      file: 'cardiovascular.glb',
      bytes: 100,
      sha256: 'c'.repeat(64),
      meshIds: ['left-ventricle'],
    },
  ],
  meshes: {
    'humerus--l': {
      bundle: 'skeletal',
      bounds,
      triangles: 10,
      sizeClass: 'large',
    },
    'radius--l': {
      bundle: 'skeletal',
      bounds,
      triangles: 10,
      sizeClass: 'large',
    },
    'long-head-of-biceps-brachii--l': {
      bundle: 'muscular',
      bounds,
      triangles: 10,
      sizeClass: 'medium',
    },
    'long-head-of-triceps-brachii--l': {
      bundle: 'muscular',
      bounds,
      triangles: 10,
      sizeClass: 'medium',
    },
    'left-ventricle': {
      bundle: 'cardiovascular',
      bounds,
      triangles: 10,
      sizeClass: 'medium',
    },
  },
};

const motionsFixture: MotionsFile = {
  motions: [
    {
      id: 'elbow-flexion',
      kind: 'hinge',
      label: 'Elbow flexion and extension',
      view: 'left',
      systems: ['skeletal', 'muscular'],
      moving: ['radius--l'],
      ghost: ['long-head-of-biceps-brachii--l'],
      agonists: {
        flex: ['long-head-of-biceps-brachii--l'],
        extend: ['long-head-of-triceps-brachii--l'],
      },
      pivot: { mesh: 'humerus--l', anchor: [0.5, 0.03, 0.5] },
      axis: [-1, 0, 0],
      range: [0, 145],
      periodS: 4,
    },
    {
      id: 'heartbeat',
      kind: 'pulse',
      label: 'Heartbeat',
      view: 'anterior',
      systems: ['cardiovascular'],
      bpm: 72,
      amplitude: 0.08,
      groups: [{ meshes: ['left-ventricle'], phase: 0.15 }],
    },
  ],
};

function stubMotionsFetch(payload: unknown = motionsFixture) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })),
  );
}

function setupStore(
  bundles: Record<string, 'idle' | 'loading' | 'ready' | 'error'> = {
    skeletal: 'ready',
    muscular: 'idle',
  },
) {
  const camera: CameraRef = {
    current: {
      focusMeshes: vi.fn(async () => {}),
      goToPreset: vi.fn(async () => {}),
      resetView: vi.fn(async () => {}),
      zoom: vi.fn(),
      getPose: vi.fn(() => null),
      setPose: vi.fn(async () => {}),
      lookAtPoint: vi.fn(async () => {}),
      followTarget: vi.fn(),
    },
  };
  const store = makeStore(
    {
      assets: {
        manifest,
        boot: 'ready',
        bundles,
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
  return { store, camera };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('motion thunks and safety listeners', () => {
  it('startMotion enables systems, waits for bundles, goes to preset, and activates playing', async () => {
    stubMotionsFetch();
    const { store, camera } = setupStore({
      skeletal: 'ready',
      muscular: 'idle',
    });

    let resolved = false;
    const promise = store.dispatch(startMotion('elbow-flexion')).then(() => {
      resolved = true;
    });

    await vi.waitFor(() => {
      expect(store.getState().systems.muscular.enabled).toBe(true);
    });
    expect(resolved).toBe(false);

    store.dispatch(bundleReady('muscular'));
    await promise;

    expect(resolved).toBe(true);
    expect(camera.current?.goToPreset).toHaveBeenCalledWith('left');
    expect(store.getState().motion.activeId).toBe('elbow-flexion');
    expect(store.getState().motion.playing).toBe(true);
  });

  it('starts paused at phase 0.25 under prefers-reduced-motion', async () => {
    stubMotionsFetch();
    vi.stubGlobal(
      'matchMedia',
      vi.fn((q: string) => ({
        matches: q.includes('prefers-reduced-motion'),
        media: q,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    const { store } = setupStore({ skeletal: 'ready', muscular: 'ready' });

    await store.dispatch(startMotion('elbow-flexion'));
    expect(store.getState().motion.activeId).toBe('elbow-flexion');
    expect(store.getState().motion.playing).toBe(false);
    expect(store.getState().motion.scrubPhase).toBe(0.25);
  });

  it('refuses startMotion during an active quiz', async () => {
    stubMotionsFetch();
    const { store } = setupStore({ skeletal: 'ready', muscular: 'ready' });
    store.dispatch(
      quizStarted({
        questions: ['humerus--l'],
        savedDissection: { hidden: [], isolated: null, faded: null },
        best: 0,
      }),
    );

    await store.dispatch(startMotion('elbow-flexion'));
    expect(store.getState().motion.activeId).toBeNull();
  });

  it('stops motion when quiz starts, a required system disables, or a moving bundle retries', async () => {
    stubMotionsFetch();
    const { store } = setupStore({ skeletal: 'ready', muscular: 'ready' });

    await store.dispatch(startMotion('elbow-flexion'));
    expect(store.getState().motion.activeId).toBe('elbow-flexion');

    store.dispatch(
      quizStarted({
        questions: ['humerus--l'],
        savedDissection: { hidden: [], isolated: null, faded: null },
        best: 0,
      }),
    );
    expect(store.getState().motion.activeId).toBeNull();

    // Restart outside quiz, then disable muscular system
    const { store: store2 } = setupStore({
      skeletal: 'ready',
      muscular: 'ready',
    });
    await store2.dispatch(startMotion('elbow-flexion'));
    expect(store2.getState().motion.activeId).toBe('elbow-flexion');
    store2.dispatch(systemToggled('muscular'));
    expect(store2.getState().motion.activeId).toBeNull();

    // Restart, then retry skeletal bundle containing moving radius--l
    const { store: store3 } = setupStore({
      skeletal: 'ready',
      muscular: 'ready',
    });
    await store3.dispatch(startMotion('elbow-flexion'));
    expect(store3.getState().motion.activeId).toBe('elbow-flexion');
    store3.dispatch(bundleRetry({ id: 'skeletal', meshIds: ['radius--l'] }));
    expect(store3.getState().motion.activeId).toBeNull();

    store3.dispatch(stopMotion());
    expect(store3.getState().motion.activeId).toBeNull();
  });

  it('sets loadStatus to error without throwing on malformed motions file', async () => {
    stubMotionsFetch({ motions: [{ kind: 'hinge' }] });
    const { store } = setupStore({ skeletal: 'ready', muscular: 'ready' });

    await expect(
      store.dispatch(startMotion('elbow-flexion')),
    ).resolves.toBeUndefined();
    expect(store.getState().motion.loadStatus).toBe('error');
    expect(store.getState().motion.activeId).toBeNull();
  });

  it('ignores stale startMotion completion when another demo starts or stops concurrently', async () => {
    stubMotionsFetch();
    const { store, camera } = setupStore({
      skeletal: 'ready',
      muscular: 'idle',
      cardiovascular: 'ready',
    });

    const firstStart = store.dispatch(startMotion('elbow-flexion'));
    await vi.waitFor(() => {
      expect(store.getState().systems.muscular.enabled).toBe(true);
    });

    await store.dispatch(startMotion('heartbeat'));
    expect(store.getState().motion.activeId).toBe('heartbeat');
    expect(camera.current?.goToPreset).toHaveBeenCalledTimes(1);
    expect(camera.current?.goToPreset).toHaveBeenCalledWith('anterior');

    store.dispatch(bundleReady('muscular'));
    await firstStart;
    expect(store.getState().motion.activeId).toBe('heartbeat');
    expect(camera.current?.goToPreset).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent loadMotions, handles HTTP errors + retry, and stops via systemsSet/uiGroupToggled', async () => {
    const fetchSpy = vi.fn(
      async () => new Response(JSON.stringify(motionsFixture), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const { store } = setupStore({
      skeletal: 'ready',
      muscular: 'ready',
      cardiovascular: 'ready',
    });

    await Promise.all([
      store.dispatch(loadMotions()),
      store.dispatch(loadMotions()),
    ]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await store.dispatch(startMotion('elbow-flexion'));
    expect(store.getState().motion.activeId).toBe('elbow-flexion');
    store.dispatch(systemsSet(['skeletal']));
    expect(store.getState().motion.activeId).toBeNull();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    );
    const { store: storeErr } = setupStore({
      skeletal: 'ready',
      muscular: 'ready',
      cardiovascular: 'ready',
    });
    await storeErr.dispatch(loadMotions());
    expect(storeErr.getState().motion.loadStatus).toBe('error');

    stubMotionsFetch();
    await storeErr.dispatch(loadMotions());
    expect(storeErr.getState().motion.loadStatus).toBe('ready');

    await storeErr.dispatch(startMotion('elbow-flexion'));
    expect(storeErr.getState().motion.activeId).toBe('elbow-flexion');
    storeErr.dispatch(uiGroupToggled('major-organs'));
    expect(storeErr.getState().motion.activeId).toBe('elbow-flexion');
  });
});
