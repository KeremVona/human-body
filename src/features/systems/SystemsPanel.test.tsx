import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';
import { makeStore } from '../../app/store';
import type { IndexEntry, Manifest, Taxonomy } from '../../data/schema';
import { bundleFailed, bundleStarted } from '../assets/assetsSlice';
import { bootstrap } from '../content/contentSlice';
import { systemToggled } from './systemsSlice';
import { SystemsPanel } from './SystemsPanel';

const taxonomy: Taxonomy = {
  systems: [
    { id: 'skeletal', label: 'Skeletal', color: '#E8E0D2', order: 0 },
    { id: 'muscular', label: 'Muscular', color: '#9E3434', order: 1 },
    {
      id: 'cardiovascular',
      label: 'Cardiovascular',
      color: '#C92A2A',
      order: 2,
    },
    { id: 'nervous', label: 'Nervous', color: '#DFB848', order: 3 },
    { id: 'respiratory', label: 'Respiratory', color: '#E07A90', order: 4 },
    { id: 'digestive', label: 'Digestive', color: '#B55D5B', order: 5 },
    { id: 'urinary', label: 'Urinary', color: '#6488B5', order: 6 },
    { id: 'lymphatic', label: 'Lymphatic', color: '#58A67D', order: 7 },
  ],
  regions: [{ id: 'thorax', label: 'Thorax' }],
  uiGroups: [
    {
      id: 'major-organs',
      label: 'Major Organs',
      systems: ['nervous', 'respiratory', 'digestive', 'urinary', 'lymphatic'],
    },
  ],
};

function makeEntry(id: string, system: IndexEntry['system']): IndexEntry {
  return {
    id,
    system,
    region: 'thorax',
    paired: false,
    kind: 'other',
    tissue: 'other',
    names: { common: id, synonyms: [] },
    featured: false,
  };
}

const structures: IndexEntry[] = [
  makeEntry('sternum', 'skeletal'),
  makeEntry('diaphragm', 'muscular'),
  makeEntry('heart', 'cardiovascular'),
  makeEntry('brainstem', 'nervous'),
  makeEntry('trachea', 'respiratory'),
  makeEntry('liver', 'digestive'),
  makeEntry('bladder', 'urinary'),
  makeEntry('spleen', 'lymphatic'),
];

const meshMeta = {
  bundle: 'organs',
  triangles: 100,
  bounds: {
    min: [-1, -1, -1] as [number, number, number],
    max: [1, 1, 1] as [number, number, number],
  },
  sizeClass: 'small' as const,
};

const manifest: Manifest = {
  version: 1,
  generatedAt: '2026-11-21T00:00:00Z',
  source: { name: 'Z-Anatomy', version: '1', license: 'CC-BY-SA-4.0' },
  bundles: [
    {
      id: 'skeletal',
      file: 'skeletal.glb',
      bytes: 1,
      sha256: 'a',
      meshIds: ['sternum'],
    },
    {
      id: 'muscular',
      file: 'muscular.glb',
      bytes: 1,
      sha256: 'b',
      meshIds: ['diaphragm'],
    },
    {
      id: 'cardiovascular',
      file: 'cardiovascular.glb',
      bytes: 1,
      sha256: 'c',
      meshIds: ['heart'],
    },
    {
      id: 'organs',
      file: 'organs.glb',
      bytes: 1,
      sha256: 'd',
      meshIds: ['liver'],
    },
  ],
  meshes: {
    sternum: { ...meshMeta, bundle: 'skeletal' },
    diaphragm: { ...meshMeta, bundle: 'muscular' },
    heart: { ...meshMeta, bundle: 'cardiovascular' },
    liver: { ...meshMeta, bundle: 'organs' },
  },
};

function setupStore() {
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

describe('SystemsPanel', () => {
  it('lists the four Phase 1 rows in order with only Skeletal checked', () => {
    const store = setupStore();
    render(
      <Provider store={store}>
        <SystemsPanel />
      </Provider>,
    );

    const switches = screen.getAllByRole('switch');
    expect(
      switches.map((s) => s.getAttribute('aria-label') ?? s.textContent),
    ).toHaveLength(4);
    expect(switches[0]).toHaveAccessibleName('Skeletal');
    expect(switches[1]).toHaveAccessibleName('Muscular');
    expect(switches[2]).toHaveAccessibleName('Cardiovascular');
    expect(switches[3]).toHaveAccessibleName('Major Organs');

    expect(switches[0]).toBeChecked();
    expect(switches[1]).not.toBeChecked();
    expect(switches[2]).not.toBeChecked();
    expect(switches[3]).not.toBeChecked();
  });

  it('toggling a system dispatches systemToggled', async () => {
    const user = userEvent.setup();
    const store = setupStore();
    render(
      <Provider store={store}>
        <SystemsPanel />
      </Provider>,
    );

    await user.click(screen.getByRole('switch', { name: 'Muscular' }));
    expect(store.getState().systems.muscular.enabled).toBe(true);
  });

  it('toggling the group toggles all its systems', async () => {
    const user = userEvent.setup();
    const store = setupStore();
    render(
      <Provider store={store}>
        <SystemsPanel />
      </Provider>,
    );

    await user.click(screen.getByRole('switch', { name: 'Major Organs' }));
    const sys = store.getState().systems;
    expect(sys.nervous.enabled).toBe(true);
    expect(sys.respiratory.enabled).toBe(true);
    expect(sys.digestive.enabled).toBe(true);
    expect(sys.urinary.enabled).toBe(true);
    expect(sys.lymphatic.enabled).toBe(true);
  });

  it('shows loading and retry states', async () => {
    const user = userEvent.setup();
    const store = setupStore();
    store.dispatch(bundleStarted('organs'));

    render(
      <Provider store={store}>
        <SystemsPanel />
      </Provider>,
    );

    expect(screen.getByLabelText('Loading Major Organs')).toBeInTheDocument();

    act(() => {
      store.dispatch(bundleFailed('organs'));
    });
    const retry = await screen.findByRole('button', {
      name: 'Retry Major Organs',
    });
    await user.click(retry);
    expect(store.getState().assets.bundles.organs).toBe('idle');
  });

  it('collapses and expands', async () => {
    const user = userEvent.setup();
    const store = setupStore();
    render(
      <Provider store={store}>
        <SystemsPanel />
      </Provider>,
    );

    await user.click(screen.getByRole('button', { name: 'Collapse panel' }));
    expect(screen.queryAllByRole('switch')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Expand panel' }));
    expect(screen.getAllByRole('switch')).toHaveLength(4);
  });

  it('renders mixed state with aria-checked="mixed"', () => {
    const store = setupStore();
    store.dispatch(systemToggled('digestive'));
    render(
      <Provider store={store}>
        <SystemsPanel />
      </Provider>,
    );

    expect(
      screen.getByRole('switch', { name: 'Major Organs' }),
    ).toHaveAttribute('aria-checked', 'mixed');
  });

  it('slider dispatches opacity', async () => {
    const user = userEvent.setup();
    const store = setupStore();
    render(
      <Provider store={store}>
        <SystemsPanel />
      </Provider>,
    );

    const slider = screen.getByRole('slider', { name: 'Skeletal opacity' });
    slider.focus();
    await user.keyboard('{End}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}');

    expect(store.getState().systems.skeletal.opacity).toBe(0.8);
    expect(screen.getByText('80%')).toBeInTheDocument();
  });
});
