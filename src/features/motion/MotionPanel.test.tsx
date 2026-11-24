import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';
import rawTaxonomy from '../../../content/taxonomy.json';
import { makeStore, type CameraRef } from '../../app/store';
import { TaxonomySchema, type Manifest } from '../../data/schema';
import { quizStarted } from '../quiz/quizSlice';
import { LeftPanel } from '../tree/LeftPanel';
import { MotionPanel } from './MotionPanel';
import type { MotionsFile } from './schema';

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
      meshIds: ['left-atrium', 'left-ventricle'],
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
    'left-atrium': {
      bundle: 'cardiovascular',
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
      label: 'Heartbeat cycle',
      view: 'anterior',
      systems: ['cardiovascular'],
      center: { mesh: 'left-ventricle', anchor: [0.5, 0.5, 0.5] },
      bpm: 72,
      amplitude: 0.06,
      groups: [
        { meshes: ['left-atrium'], phase: 0 },
        { meshes: ['left-ventricle'], phase: 0.15 },
      ],
    },
  ],
};

function setupStore() {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () => new Response(JSON.stringify(motionsFixture), { status: 200 }),
    ),
  );

  const camera: CameraRef = {
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
        bundles: {
          skeletal: 'ready',
          muscular: 'ready',
          cardiovascular: 'ready',
        },
        requested: [],
      },
      content: {
        taxonomy,
        index: {
          locale: 'en',
          structures: [
            {
              id: 'humerus',
              system: 'skeletal',
              region: 'upper-limb',
              paired: true,
              kind: 'bone',
              tissue: 'bone',
              names: { common: 'Humerus', synonyms: [] },
              featured: false,
            },
            {
              id: 'long-head-of-biceps-brachii',
              system: 'muscular',
              region: 'upper-limb',
              paired: true,
              kind: 'muscle',
              tissue: 'muscle',
              names: { common: 'Biceps brachii', synonyms: [] },
              featured: false,
            },
            {
              id: 'left-ventricle',
              system: 'cardiovascular',
              region: 'thorax',
              paired: false,
              kind: 'organ',
              tissue: 'muscle',
              names: { common: 'Left ventricle', synonyms: [] },
              featured: false,
            },
          ],
        },
        structures: {},
      },
    },
    { camera },
  );
  return { store };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('MotionPanel and LeftPanel Motion tab', () => {
  it('lists demos lazily when opening the Motion tab', async () => {
    const user = userEvent.setup();
    const { store } = setupStore();

    render(
      <Provider store={store}>
        <LeftPanel />
      </Provider>,
    );

    const motionTab = screen.getByRole('tab', { name: 'Motion' });
    await user.click(motionTab);

    expect(
      await screen.findByRole('button', {
        name: 'Elbow flexion and extension',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Heartbeat cycle' }),
    ).toBeInTheDocument();
  });

  it('plays, pauses, stops, changes speed, and scrubs to pause and set phase', async () => {
    const user = userEvent.setup();
    const { store } = setupStore();

    render(
      <Provider store={store}>
        <MotionPanel />
      </Provider>,
    );

    const elbowBtn = await screen.findByRole('button', {
      name: 'Elbow flexion and extension',
    });
    expect(screen.getByRole('status')).toHaveTextContent('');

    await user.click(elbowBtn);

    const pauseBtn = await screen.findByRole('button', { name: 'Pause' });
    expect(store.getState().motion.playing).toBe(true);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Playing Elbow flexion and extension.',
    );

    await user.click(screen.getByRole('radio', { name: '0.5×' }));
    expect(store.getState().motion.speed).toBe(0.5);

    await user.click(pauseBtn);
    expect(store.getState().motion.playing).toBe(false);
    expect(screen.getByRole('status')).toHaveTextContent('Paused.');

    const playBtn = screen.getByRole('button', { name: 'Play' });
    await user.click(playBtn);
    expect(store.getState().motion.playing).toBe(true);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Playing Elbow flexion and extension.',
    );

    const slider = screen.getByRole('slider', { name: 'Motion position' });
    slider.focus();
    await user.keyboard('{End}');
    expect(store.getState().motion.playing).toBe(false);
    expect(store.getState().motion.scrubPhase).toBe(1);

    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(store.getState().motion.activeId).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Stopped.');
  });

  it('shows the illustrative caption and disables demo buttons during an active quiz', async () => {
    const { store } = setupStore();
    store.dispatch(
      quizStarted({
        questions: ['humerus--l'],
        savedDissection: { hidden: [], isolated: null, faded: null },
        best: 0,
      }),
    );

    render(
      <Provider store={store}>
        <MotionPanel />
      </Provider>,
    );

    const elbowBtn = await screen.findByRole('button', {
      name: 'Elbow flexion and extension',
    });
    expect(elbowBtn).toBeDisabled();
    expect(elbowBtn).toHaveAttribute('title', 'Finish the quiz first');
    expect(
      screen.getByText(
        'Illustrative motion — real joints and hearts move in more complex ways.',
      ),
    ).toBeInTheDocument();
  });
});
