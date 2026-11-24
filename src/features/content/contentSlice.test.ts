import { vi } from 'vitest';
import taxonomy from '../../../content/taxonomy.json';
import type { IndexFile, Manifest, StructureFile } from '../../data/schema';

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
      meshIds: ['femur--l'],
    },
  ],
  meshes: {
    'femur--l': {
      bundle: 'skeletal',
      bounds: { min: [0, 0, 0], max: [0.1, 0.4, 0.1] },
      triangles: 12,
      sizeClass: 'large',
    },
  },
};

const sampleIndex: IndexFile = {
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
  ],
};

function okJson(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('bootstrap stores all three files and sets boot to ready', async () => {
  vi.resetModules();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('models/manifest.json')) return okJson(sampleManifest);
      if (url.endsWith('content/taxonomy.json')) return okJson(taxonomy);
      if (url.endsWith('content/en/index.json')) return okJson(sampleIndex);
      return new Response(null, { status: 404 });
    }),
  );

  const { makeStore } = await import('../../app/store');
  const { bootstrap, selectStructureLookup } = await import('./contentSlice');

  const store = makeStore();
  await store.dispatch(bootstrap());

  const state = store.getState();
  expect(state.assets.boot).toBe('ready');
  expect(state.assets.manifest).toEqual(sampleManifest);
  expect(state.assets.bundles).toEqual({ skeletal: 'idle' });
  expect(state.content.taxonomy).toEqual(taxonomy);
  expect(state.content.index).toEqual(sampleIndex);
  expect(selectStructureLookup(state).get('femur')?.names.common).toBe('Femur');
});

it('bootstrap skips duplicate concurrent and post-ready dispatches', async () => {
  vi.resetModules();
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('models/manifest.json')) return okJson(sampleManifest);
    if (url.endsWith('content/taxonomy.json')) return okJson(taxonomy);
    if (url.endsWith('content/en/index.json')) return okJson(sampleIndex);
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);

  const { makeStore } = await import('../../app/store');
  const { bundleStarted } = await import('../assets/assetsSlice');
  const { bootstrap } = await import('./contentSlice');

  const store = makeStore();
  const first = store.dispatch(bootstrap());
  const second = store.dispatch(bootstrap());
  await Promise.all([first, second]);

  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(store.getState().assets.boot).toBe('ready');

  store.dispatch(bundleStarted('skeletal'));
  await store.dispatch(bootstrap());
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(store.getState().assets.bundles.skeletal).toBe('loading');
});

it('any schema failure during bootstrap sets boot to error', async () => {
  vi.resetModules();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('models/manifest.json')) return okJson(sampleManifest);
      if (url.endsWith('content/taxonomy.json'))
        return okJson({ broken: true });
      if (url.endsWith('content/en/index.json')) return okJson(sampleIndex);
      return new Response(null, { status: 404 });
    }),
  );

  const { makeStore } = await import('../../app/store');
  const { bootstrap } = await import('./contentSlice');

  const store = makeStore();
  await store.dispatch(bootstrap());
  expect(store.getState().assets.boot).toBe('error');
});

it('loadStructures treats 404 as empty and rejects mismatched system files', async () => {
  vi.resetModules();
  const wrongSystemFile: StructureFile = {
    system: 'muscular',
    entries: [
      {
        id: 'femur',
        overview: 'Wrong system.',
        sources: [
          {
            title: 'OpenStax',
            url: 'https://openstax.org/books/anatomy-and-physiology-2e',
            license: 'CC-BY-4.0',
          },
        ],
      },
    ],
  };

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('content/en/structures/muscular.json')) {
        return okJson(wrongSystemFile);
      }
      return new Response(null, { status: 404 });
    }),
  );
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  const { makeStore } = await import('../../app/store');
  const { loadStructures } = await import('./contentSlice');

  const store = makeStore();
  await store.dispatch(loadStructures('skeletal'));
  expect(store.getState().content.structures.skeletal).toEqual({
    status: 'ready',
    entries: {},
  });

  // Loading a muscular file under system "respiratory" should fail system check and store empty
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => okJson(wrongSystemFile)),
  );
  await store.dispatch(loadStructures('respiratory'));
  expect(errorSpy).toHaveBeenCalled();
  expect(store.getState().content.structures.respiratory).toEqual({
    status: 'ready',
    entries: {},
  });
});

it('falls back gracefully to English without boot error when non-en locale files are 404 or invalid', async () => {
  vi.resetModules();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('models/manifest.json')) return okJson(sampleManifest);
      if (url.endsWith('content/taxonomy.json')) return okJson(taxonomy);
      if (url.endsWith('content/en/index.json')) return okJson(sampleIndex);
      if (url.endsWith('content/tr/index.json')) {
        return okJson({ invalid: true });
      }
      return new Response(null, { status: 404 });
    }),
  );

  const { makeStore } = await import('../../app/store');
  const { localeSet } = await import('../settings/uiSlice');
  const { bootstrap, loadStructures } = await import('./contentSlice');

  const store = makeStore();
  store.dispatch(localeSet('tr'));
  await store.dispatch(bootstrap());

  expect(store.getState().assets.boot).toBe('ready');
  expect(store.getState().content.index?.structures[0]?.names.common).toBe(
    'Femur',
  );
  expect(store.getState().content.fallback?.index).toContain('femur');

  await store.dispatch(loadStructures('skeletal'));
  expect(store.getState().content.structures.skeletal?.status).toBe('ready');
});

it('reloads index and ready system structures when locale switches', async () => {
  vi.resetModules();
  const trIndex: IndexFile = {
    locale: 'tr',
    structures: [
      {
        ...sampleIndex.structures[0]!,
        names: { common: 'Uyluk kemiği', synonyms: [] },
      },
    ],
  };
  const enSkeletal: StructureFile = {
    system: 'skeletal',
    entries: [
      {
        id: 'femur',
        overview: 'Thigh bone.',
        sources: [
          {
            title: 'OpenStax',
            url: 'https://openstax.org/books/anatomy-and-physiology-2e',
            license: 'CC-BY-4.0',
          },
        ],
      },
    ],
  };
  const trSkeletal: StructureFile = {
    system: 'skeletal',
    entries: [
      {
        id: 'femur',
        overview: 'Uyluk kemiği özeti.',
        sources: [
          {
            title: 'OpenStax',
            url: 'https://openstax.org/books/anatomy-and-physiology-2e',
            license: 'CC-BY-4.0',
          },
        ],
      },
    ],
  };

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('models/manifest.json')) return okJson(sampleManifest);
      if (url.endsWith('content/taxonomy.json')) return okJson(taxonomy);
      if (url.endsWith('content/en/index.json')) return okJson(sampleIndex);
      if (url.endsWith('content/tr/index.json')) return okJson(trIndex);
      if (url.endsWith('content/en/structures/skeletal.json')) {
        return okJson(enSkeletal);
      }
      if (url.endsWith('content/tr/structures/skeletal.json')) {
        return okJson(trSkeletal);
      }
      return new Response(null, { status: 404 });
    }),
  );

  const { makeStore } = await import('../../app/store');
  const { localeSet } = await import('../settings/uiSlice');
  const { bootstrap, loadStructures } = await import('./contentSlice');

  const store = makeStore();
  await store.dispatch(bootstrap());
  await store.dispatch(loadStructures('skeletal'));
  expect(store.getState().content.index?.structures[0]?.names.common).toBe(
    'Femur',
  );

  store.dispatch(localeSet('tr'));
  await vi.waitFor(() => {
    expect(store.getState().content.index?.structures[0]?.names.common).toBe(
      'Uyluk kemiği',
    );
    expect(
      store.getState().content.structures.skeletal?.entries.femur?.overview,
    ).toBe('Uyluk kemiği özeti.');
  });
  store.dispatch(localeSet('en'));
});
