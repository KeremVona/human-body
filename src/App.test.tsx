import { act, render, screen } from '@testing-library/react';
import App from './App';
import { makeStore } from './app/store';
import { isolate } from './features/dissection/dissectionSlice';
import taxonomy from '../content/taxonomy.json';
import type { IndexFile, Manifest, Taxonomy } from './data/schema';

vi.mock('./scene/AtlasCanvas', () => ({ AtlasCanvas: () => null }));
vi.mock('./data/manifest', () => ({
  loadManifest: () => new Promise(() => {}),
  bundleUrl: (file: string) => `/models/${file}`,
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

it('renders the full-bleed viewer shell while booting', () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>(() => {})),
  );
  render(<App />);
  const main = screen.getByRole('main', { name: 'Anatomy viewer' });
  expect(main).toHaveClass('h-dvh', 'w-full');
});

it('shows an error alert if bootstrap fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 500 })),
  );
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    "Couldn't start the atlas. Please reload.",
  );
});

it('stacks FirstRunHint and ExitChips inside a single non-overlapping column', async () => {
  localStorage.clear();
  const sampleManifest: Manifest = {
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

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('content/taxonomy.json')) {
        return new Response(JSON.stringify(taxonomy), { status: 200 });
      }
      if (url.endsWith('content/en/index.json')) {
        return new Response(JSON.stringify(sampleIndex), { status: 200 });
      }
      return new Response(null, { status: 404 });
    }),
  );

  const store = makeStore({
    assets: {
      manifest: sampleManifest,
      boot: 'ready',
      bundles: { skeletal: 'ready' },
      requested: ['skeletal'],
    },
    content: {
      taxonomy: taxonomy as Taxonomy,
      index: sampleIndex,
      structures: {},
    },
  });
  store.dispatch(isolate(['femur--l']));

  await act(async () => {
    render(<App store={store} />);
  });

  expect(store.getState().assets.boot).toBe('ready');
  const gotItBtn = await screen.findByRole('button', { name: 'Got it' });
  const exitBtn = await screen.findByRole('button', { name: 'Exit isolate' });

  const hintBox = gotItBtn.closest('div');
  const chipsRow = exitBtn.closest('div');
  expect(hintBox).not.toHaveClass('fixed');
  expect(chipsRow).not.toHaveClass('fixed');
  expect(hintBox?.parentElement).toBe(chipsRow?.parentElement);
  expect(hintBox?.parentElement).toHaveClass('fixed', 'flex-col');
});
