import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeStore } from '../../app/store';
import type { Manifest } from '../../data/schema';
import { loadMessages, setActiveLocale } from '../../i18n/t';
import { JourneyBar } from './JourneyBar';
import {
  journeyFollowingSet,
  journeysFailed,
  journeysLoaded,
  journeyStarted,
} from './journeySlice';
import type { Journey } from './schema';

const bounds = {
  min: [-0.1, 0, -0.1] as [number, number, number],
  max: [0.1, 0.5, 0.1] as [number, number, number],
};

const manifest: Manifest = {
  version: 1,
  generatedAt: '2026-11-27T00:00:00Z',
  source: { name: 'Z-Anatomy', version: '2023', license: 'CC-BY-SA-4.0' },
  bundles: [{ id: 'organs', file: 'organs.glb', bytes: 100, sha256: 'a'.repeat(64), meshIds: ['tongue', 'stomach'] }],
  meshes: {
    tongue: { bundle: 'organs', bounds, triangles: 10, sizeClass: 'small' },
    stomach: { bundle: 'organs', bounds, triangles: 10, sizeClass: 'medium' },
  },
};

const fixtureJourney: Journey = {
  id: 'digestion',
  systems: ['digestive'],
  stages: [
    {
      id: 'mouth',
      durationS: 10,
      realTime: { min: 5, max: 30, unit: 's' },
      food: 'bolus',
      radius: 0.008,
      motion: 'none',
      organs: ['tongue'],
      view: { c: [0, 0.5, 0.6, 0, 0.5, 0], s: ['digestive'], h: [], sel: [] },
      path: [{ line: 'mouth' }],
      modelled: true,
      nutrients: { carbs: 5, protein: 0, fat: 0, water: 0, absorbed: 0 },
    },
    {
      id: 'stomach',
      durationS: 14,
      realTime: { min: 2, max: 4, unit: 'h' },
      food: 'chyme',
      radius: 0.011,
      motion: 'churn',
      organs: ['stomach'],
      view: { c: [0, 0.2, 0.7, 0, 0.2, 0], s: ['digestive'], h: [], sel: [] },
      path: [{ line: 'stomach' }],
      modelled: false,
      nutrients: { carbs: 30, protein: 15, fat: 10, water: 0, absorbed: 0 },
    },
  ],
};

const centerlines = {
  version: 1 as const,
  lines: {
    mouth: [
      [0, 0.5, 0] as [number, number, number],
      [0, 0.4, 0] as [number, number, number],
    ],
    stomach: [
      [0, 0.3, 0] as [number, number, number],
      [0, 0.2, 0] as [number, number, number],
    ],
  },
};

function setupBar(opts: { reduced?: boolean; locale?: 'en' | 'tr' } = {}) {
  const reduced = opts.reduced ?? false;
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduced && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  const store = makeStore({
    assets: {
      manifest,
      boot: 'ready',
      bundles: { organs: 'ready' },
      requested: [],
    },
  });
  store.dispatch(
    journeysLoaded({
      defs: [fixtureJourney],
      texts: {
        digestion: {
          title: opts.locale === 'tr' ? 'Bir lokmanın yolculuğu' : 'Follow a bite of food',
          summary: 'Summary',
          stages: {
            mouth: {
              title: opts.locale === 'tr' ? 'Çiğneme' : 'Chewing',
              body: opts.locale === 'tr' ? 'Ağızda başlar.' : 'Starts in the mouth.',
            },
            stomach: {
              title: opts.locale === 'tr' ? 'Mide' : 'Stomach',
              body: opts.locale === 'tr' ? 'Asit karışımı.' : 'Acid mixes chyme.',
              note: opts.locale === 'tr' ? 'Model dışı not' : 'Sample note.',
            },
          },
          events: {},
          fallback: false,
        },
      },
      centerlines,
    }),
  );
  store.dispatch(journeyStarted({ id: 'digestion', stageIndex: 0, progress: 0 }));

  render(
    <Provider store={store}>
      <JourneyBar />
    </Provider>,
  );
  return { store };
}

afterEach(() => {
  cleanup();
  setActiveLocale('en');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('JourneyBar', () => {
  it('renders stage narration, real time, speed toggle, follow chip, and PageDown/PageUp navigation', async () => {
    const user = userEvent.setup();
    const { store } = setupBar();

    expect(screen.getByText('Follow a bite of food')).toBeInTheDocument();
    expect(screen.getByText('Stage 1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Chewing' })).toBeInTheDocument();
    expect(screen.getByText('Real time: about 5–30 seconds')).toBeInTheDocument();

    // Speed toggle
    await user.click(screen.getByRole('radio', { name: '2×' }));
    expect(store.getState().journey.speed).toBe(2);

    // Follow chip appears only when following is false
    expect(screen.queryByRole('button', { name: 'Follow the food' })).not.toBeInTheDocument();
    act(() => {
      store.dispatch(journeyFollowingSet(false));
    });
    const followBtn = await screen.findByRole('button', { name: 'Follow the food' });
    await user.click(followBtn);
    expect(store.getState().journey.following).toBe(true);

    // Slider PageDown advances to stage 2 (note rendered too), Next becomes Finish
    const slider = screen.getByRole('slider', { name: 'Journey progress' });
    fireEvent.keyDown(slider, { key: 'PageDown' });
    expect(store.getState().journey.stageIndex).toBe(1);
    expect(await screen.findByText('Sample note.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish' })).toBeInTheDocument();

    fireEvent.keyDown(slider, { key: 'PageUp' });
    expect(store.getState().journey.stageIndex).toBe(0);
  });

  it('hides Play/Pause under reduced motion and renders Turkish locale strings', async () => {
    await loadMessages('tr');
    setActiveLocale('tr');
    setupBar({ reduced: true, locale: 'tr' });

    expect(screen.getByText('Bir lokmanın yolculuğu')).toBeInTheDocument();
    expect(screen.getByText('Aşama 1 / 2')).toBeInTheDocument();
    expect(screen.getByText('Gerçek süre: yaklaşık 5–30 saniye')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Oynat' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Duraklat' })).not.toBeInTheDocument();
  });

  it('shows error banner with exit button on load failure', async () => {
    const user = userEvent.setup();
    const { store } = setupBar();
    act(() => {
      store.dispatch(journeysFailed());
    });

    expect(await screen.findByText('Could not load the journey.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Exit journey' }));
    expect(store.getState().journey.activeId).toBeNull();
  });

  it('starts nutrients collapsed and toggles between minimized and expanded panel', async () => {
    const user = userEvent.setup();
    setupBar();

    // Nutrient breakdown starts collapsed so it does not cover the viewport
    const nutrientsBtn = screen.getByRole('button', {
      name: "What's been digested",
    });
    expect(nutrientsBtn).toHaveAttribute('aria-expanded', 'false');

    // Minimize collapses narration, scrubber, and nutrients down to a slim bar
    const minBtn = screen.getByRole('button', { name: 'Minimize panel' });
    expect(minBtn).toHaveAttribute('aria-expanded', 'true');
    await user.click(minBtn);

    expect(
      screen.queryByRole('slider', { name: 'Journey progress' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Chewing')).toBeInTheDocument();

    const expandBtn = screen.getByRole('button', { name: 'Expand panel' });
    expect(expandBtn).toHaveAttribute('aria-expanded', 'false');
    await user.click(expandBtn);

    expect(
      screen.getByRole('slider', { name: 'Journey progress' }),
    ).toBeInTheDocument();
  });
});
