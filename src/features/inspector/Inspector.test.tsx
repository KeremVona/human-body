import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeStore } from '../../app/store';
import type { IndexEntry, Manifest, Taxonomy } from '../../data/schema';
import { CameraApiProvider, type CameraApi } from '../../scene/camera';
import { bootstrap, loadStructures } from '../content/contentSlice';
import { selected } from '../selection/selectionSlice';
import { Inspector } from './Inspector';

const taxonomy: Taxonomy = {
  systems: [
    { id: 'skeletal', label: 'Skeletal', color: '#E8DCC4', order: 1 },
    { id: 'muscular', label: 'Muscular', color: '#C0504D', order: 2 },
  ],
  regions: [
    { id: 'upper-limb', label: 'Upper limb' },
    { id: 'lower-limb', label: 'Lower limb' },
  ],
  uiGroups: [],
};

const structures: IndexEntry[] = [
  {
    id: 'biceps-brachii',
    system: 'muscular',
    region: 'upper-limb',
    paired: true,
    kind: 'muscle',
    tissue: 'muscle',
    names: {
      common: 'Biceps brachii',
      latin: 'Musculus biceps brachii',
      synonyms: [],
    },
    featured: true,
  },
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
];

const manifest: Manifest = {
  version: 1,
  generatedAt: '2026-11-21T00:00:00Z',
  source: { name: 'Z-Anatomy', version: '1', license: 'CC-BY-SA-4.0' },
  bundles: [],
  meshes: {},
};

const mockCameraApi: CameraApi = {
  focusMeshes: vi.fn(async () => {}),
  goToPreset: vi.fn(async () => {}),
  resetView: vi.fn(async () => {}),
  zoom: vi.fn(),
  getPose: vi.fn(() => null),
  setPose: vi.fn(async () => {}),
  lookAtPoint: vi.fn(async () => {}),
  followTarget: vi.fn(),
};

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

function renderInspector(store: ReturnType<typeof makeStore>) {
  return render(
    <Provider store={store}>
      <CameraApiProvider value={mockCameraApi}>
        <Inspector />
      </CameraApiProvider>
    </Provider>,
  );
}

function baseStore() {
  const store = makeStore();
  store.dispatch(
    bootstrap.fulfilled(
      { manifest, taxonomy, index: { locale: 'en', structures } },
      'req-1',
      undefined,
    ),
  );
  return store;
}

describe('Inspector', () => {
  it('shows muscle details and source link for a full muscle entry', () => {
    const store = baseStore();
    store.dispatch(
      loadStructures.fulfilled(
        {
          'biceps-brachii': {
            id: 'biceps-brachii',
            overview: 'Two-headed anterior arm flexor.',
            function: 'Flexes the elbow and supinates the forearm.',
            details: {
              kind: 'muscle',
              origin: 'Supraglenoid tubercle & coracoid process',
              insertion: 'Radial tuberosity',
              innervation: 'Musculocutaneous nerve',
              bloodSupply: 'Brachial artery',
              action: 'Elbow flexion and forearm supination',
            },
            sources: [
              {
                title: 'Wikipedia — Biceps brachii',
                url: 'https://en.wikipedia.org/wiki/Biceps',
                license: 'CC BY-SA 4.0',
              },
            ],
          },
        },
        'req-2',
        'muscular',
      ),
    );
    store.dispatch(selected(['biceps-brachii--l']));

    renderInspector(store);

    expect(screen.getByText('Origin')).toBeInTheDocument();
    expect(
      screen.getByText('Supraglenoid tubercle & coracoid process'),
    ).toBeInTheDocument();
    expect(screen.getByText('Insertion')).toBeInTheDocument();
    expect(screen.getByText('Radial tuberosity')).toBeInTheDocument();
    expect(screen.getByText('Innervation')).toBeInTheDocument();
    expect(screen.getByText('Musculocutaneous nerve')).toBeInTheDocument();
    expect(screen.getByText('Blood supply')).toBeInTheDocument();
    expect(screen.getByText('Brachial artery')).toBeInTheDocument();
    expect(screen.getByText('Primary action')).toBeInTheDocument();
    expect(
      screen.getByText('Elbow flexion and forearm supination'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Wikipedia — Biceps brachii/i }),
    ).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Biceps');
  });

  it('shows fallback copy for a stub entry', () => {
    const store = baseStore();
    store.dispatch(loadStructures.fulfilled({}, 'req-2', 'skeletal'));
    store.dispatch(selected(['femur--l']));

    renderInspector(store);

    expect(screen.getByText('Description coming soon.')).toBeInTheDocument();
  });

  it('switches paired side to Right and hides selection', async () => {
    const user = userEvent.setup();
    const store = baseStore();
    store.dispatch(loadStructures.fulfilled({}, 'req-2', 'skeletal'));
    store.dispatch(selected(['femur--l']));

    renderInspector(store);

    await user.click(screen.getByRole('button', { name: 'Right' }));
    expect(store.getState().selection.selectedIds).toEqual(['femur--r']);

    await user.click(screen.getByRole('button', { name: 'Hide' }));
    expect(store.getState().dissection.hidden).toEqual(['femur--r']);
    expect(
      screen.queryByRole('complementary', { name: 'Structure details' }),
    ).not.toBeInTheDocument();
  });

  it('sets data-layout to sheet below 768px and drawer at 1280px', () => {
    const store = baseStore();
    store.dispatch(loadStructures.fulfilled({}, 'req-2', 'skeletal'));
    store.dispatch(selected(['femur--l']));

    vi.stubGlobal('innerWidth', 500);
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query.includes('max-width: 767px'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const { unmount } = renderInspector(store);
    expect(
      screen.getByRole('complementary', { name: 'Structure details' }),
    ).toHaveAttribute('data-layout', 'sheet');
    unmount();

    vi.stubGlobal('innerWidth', 1280);
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    renderInspector(store);
    expect(
      screen.getByRole('complementary', { name: 'Structure details' }),
    ).toHaveAttribute('data-layout', 'drawer');
  });

  it('shows the muted not-translated note when non-en locale fell back to English', async () => {
    const { localeSet } = await import('../settings/uiSlice');
    const store = makeStore();
    store.dispatch(localeSet('tr'));
    store.dispatch(
      bootstrap.fulfilled(
        {
          manifest,
          taxonomy,
          index: { locale: 'tr', structures },
          locale: 'tr',
          fallbackIndexIds: ['femur'],
        },
        'req-1',
        undefined,
      ),
    );
    store.dispatch(loadStructures.fulfilled({}, 'req-2', 'skeletal'));
    store.dispatch(selected(['femur--l']));

    renderInspector(store);
    expect(await screen.findByText('Henüz çevrilmedi')).toBeInTheDocument();

    store.dispatch(localeSet('en'));
  });

  it('hides bottom sheet on mobile viewports during a guided tour while keeping desktop drawer visible', async () => {
    const { tourStarted } = await import('../tours/tourSlice');
    const store = makeStore();
    store.dispatch(
      bootstrap.fulfilled(
        { manifest, taxonomy, index: { locale: 'en', structures } },
        'req-1',
        undefined,
      ),
    );
    store.dispatch(loadStructures.fulfilled({}, 'req-2', 'skeletal'));
    store.dispatch(selected(['femur--l']));
    store.dispatch(
      tourStarted({
        id: 'arm-bone-to-muscle',
        savedView: { c: [0, 0, 3, 0, 0, 0], s: ['skeletal'], h: [], sel: [] },
      }),
    );

    vi.stubGlobal('innerWidth', 375);
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query.includes('767px'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const { unmount } = renderInspector(store);
    expect(
      screen.queryByRole('complementary', { name: 'Structure details' }),
    ).not.toBeInTheDocument();
    unmount();

    vi.stubGlobal('innerWidth', 1280);
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    renderInspector(store);
    expect(
      screen.getByRole('complementary', { name: 'Structure details' }),
    ).toHaveAttribute('data-layout', 'drawer');
  });

  it('shows one journey link per journey matching the selected mesh', async () => {
    const { journeysLoaded } = await import('../journey/journeySlice');
    const store = makeStore();
    store.dispatch(
      bootstrap.fulfilled(
        { manifest, taxonomy, index: { locale: 'en', structures } },
        'req-1',
        undefined,
      ),
    );
    store.dispatch(loadStructures.fulfilled({}, 'req-2', 'skeletal'));
    store.dispatch(
      journeysLoaded({
        defs: [
          {
            id: 'digestion',
            systems: ['digestive'],
            meters: [{ id: 'carbs', unit: '%', max: 100, decimals: 0 }],
            stages: [
              {
                id: 'mouth',
                durationS: 10,
                look: 'bolus',
                radius: 0.008,
                motion: 'none',
                organs: ['femur--l'],
                view: { c: [0, 0, 2, 0, 0, 0], s: ['skeletal'], h: [], sel: [] },
                path: [{ line: 'a' }],
                modelled: true,
                meters: { carbs: 5 },
              },
              {
                id: 'stomach',
                durationS: 10,
                look: 'chyme',
                radius: 0.01,
                motion: 'churn',
                organs: [],
                view: { c: [0, 0, 2, 0, 0, 0], s: ['skeletal'], h: [], sel: [] },
                path: [{ line: 'b' }],
                modelled: true,
                meters: { carbs: 10 },
              },
            ],
          },
          {
            id: 'blood',
            systems: ['cardiovascular'],
            meters: [{ id: 'oxygen', unit: '%', max: 100, decimals: 0 }],
            stages: [
              {
                id: 'hand',
                durationS: 6,
                look: 'blood-deoxy',
                radius: 0.004,
                motion: 'none',
                organs: [],
                view: { c: [0, 0, 2, 0, 0, 0], s: ['skeletal'], h: [], sel: [] },
                path: [{ line: 'a' }],
                modelled: true,
                meters: { oxygen: 75 },
              },
              {
                id: 'arm',
                durationS: 8,
                look: 'blood-oxy',
                radius: 0.004,
                motion: 'none',
                organs: ['femur--l'],
                view: { c: [0, 0, 2, 0, 0, 0], s: ['skeletal'], h: [], sel: [] },
                path: [{ line: 'b' }],
                modelled: true,
                meters: { oxygen: 98 },
              },
            ],
          },
        ],
        texts: {
          digestion: {
            title: 'Follow a bite of food',
            summary: 'Mouth to exit.',
            inspectorLink: 'Watch food pass through here',
            meters: {},
            stages: {},
            events: {},
            fallback: false,
          },
          blood: {
            title: 'Follow a drop of blood',
            summary: 'One loop.',
            inspectorLink: 'Watch blood flow through here',
            meters: {},
            stages: {},
            events: {},
            fallback: false,
          },
        },
        centerlines: {
          version: 1,
          lines: {
            a: [
              [0, 0, 0],
              [0, 0.1, 0],
            ],
            b: [
              [0, 0.1, 0],
              [0, 0.2, 0],
            ],
          },
        },
      }),
    );

    store.dispatch(selected(['sternum']));
    const { rerender } = renderInspector(store);
    expect(
      screen.queryByRole('button', { name: 'Watch food pass through here' }),
    ).not.toBeInTheDocument();

    store.dispatch(selected(['femur--l']));
    rerender(
      <Provider store={store}>
        <CameraApiProvider value={mockCameraApi}>
          <Inspector />
        </CameraApiProvider>
      </Provider>,
    );
    const linkBtn = screen.getByRole('button', {
      name: 'Watch food pass through here',
    });
    expect(linkBtn).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Watch blood flow through here' }),
    ).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(linkBtn);
    await waitFor(() => {
      expect(store.getState().journey.activeId).toBe('digestion');
      expect(store.getState().journey.stageIndex).toBe(0);
    });
  });
});
