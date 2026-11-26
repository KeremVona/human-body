import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeStore } from '../../app/store';
import { quizStarted } from '../quiz/quizSlice';
import { toursFailed, toursLoaded } from './tourSlice';
import { ToursDialog } from './ToursDialog';
import type { Tour } from './schema';
import type { TourText } from './localizeTours';

const defs: Tour[] = [
  {
    id: 'arm-bone-to-muscle',
    steps: [
      { id: 'step-1', view: { c: [0, 0, 2, 0, 0, 0], s: ['skeletal'], h: [], sel: [] } },
      { id: 'step-2', view: { c: [0, 0, 2, 0, 0, 0], s: ['skeletal'], h: [], sel: [] } },
      { id: 'step-3', view: { c: [0, 0, 2, 0, 0, 0], s: ['skeletal'], h: [], sel: [] } },
      { id: 'step-4', view: { c: [0, 0, 2, 0, 0, 0], s: ['skeletal'], h: [], sel: [] } },
    ],
  },
  {
    id: 'how-the-heart-beats',
    steps: [
      { id: 'step-1', view: { c: [0, 0, 2, 0, 0, 0], s: ['skeletal'], h: [], sel: [] } },
      { id: 'step-2', view: { c: [0, 0, 2, 0, 0, 0], s: ['skeletal'], h: [], sel: [] } },
      { id: 'step-3', view: { c: [0, 0, 2, 0, 0, 0], s: ['skeletal'], h: [], sel: [] } },
      { id: 'step-4', view: { c: [0, 0, 2, 0, 0, 0], s: ['skeletal'], h: [], sel: [] } },
      { id: 'step-5', view: { c: [0, 0, 2, 0, 0, 0], s: ['skeletal'], h: [], sel: [] } },
    ],
  },
];

const texts: Record<string, TourText> = {
  'arm-bone-to-muscle': {
    title: 'From bone to muscle: the arm',
    summary: 'Follow arm skeleton to superficial flexor muscles.',
    fallback: false,
    steps: {
      'step-1': { title: 'S1', body: 'B1' },
      'step-2': { title: 'S2', body: 'B2' },
      'step-3': { title: 'S3', body: 'B3' },
      'step-4': { title: 'S4', body: 'B4' },
    },
  },
  'how-the-heart-beats': {
    title: 'How the heart beats',
    summary: 'Trace vessels, ventricles, and pulsing chambers.',
    fallback: false,
    steps: {
      'step-1': { title: 'H1', body: 'HB1' },
      'step-2': { title: 'H2', body: 'HB2' },
      'step-3': { title: 'H3', body: 'HB3' },
      'step-4': { title: 'H4', body: 'HB4' },
      'step-5': { title: 'H5', body: 'HB5' },
    },
  },
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ToursDialog', () => {
  it('lists all loaded tours with titles, summaries, and step counts', () => {
    const store = makeStore();
    store.dispatch(toursLoaded({ defs, texts }));

    render(
      <Provider store={store}>
        <ToursDialog open onOpenChange={() => {}} />
      </Provider>,
    );

    expect(
      screen.getByRole('heading', { name: 'Guided tours' }),
    ).toBeInTheDocument();
    expect(screen.getByText('From bone to muscle: the arm')).toBeInTheDocument();
    expect(screen.getByText('How the heart beats')).toBeInTheDocument();
    expect(screen.getByText('4 steps')).toBeInTheDocument();
    expect(screen.getByText('5 steps')).toBeInTheDocument();
  });

  it('calls start handler and closes when Start is clicked', async () => {
    const user = userEvent.setup();
    const store = makeStore();
    store.dispatch(toursLoaded({ defs, texts }));
    const onOpenChange = vi.fn();
    const onStartTour = vi.fn(async () => {});

    render(
      <Provider store={store}>
        <ToursDialog
          open
          onOpenChange={onOpenChange}
          onStartTour={onStartTour}
        />
      </Provider>,
    );

    const startButtons = screen.getAllByRole('button', { name: 'Start' });
    await user.click(startButtons[1]);

    await waitFor(() => {
      expect(onStartTour).toHaveBeenCalledWith('how-the-heart-beats');
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('disables Start buttons with finishQuizTitle tooltip while a quiz is active', () => {
    const store = makeStore();
    store.dispatch(toursLoaded({ defs, texts }));
    store.dispatch(
      quizStarted({
        questions: ['femur--l'],
        savedDissection: { hidden: [], isolated: null, faded: null },
        best: 0,
      }),
    );

    render(
      <Provider store={store}>
        <ToursDialog open onOpenChange={() => {}} />
      </Provider>,
    );

    const startButtons = screen.getAllByRole('button', { name: 'Start' });
    for (const btn of startButtons) {
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute('title', 'Finish the quiz first');
    }
  });

  it('shows the tour-specific error message when loading tours fails', () => {
    const store = makeStore();
    store.dispatch(toursFailed());

    render(
      <Provider store={store}>
        <ToursDialog open onOpenChange={() => {}} />
      </Provider>,
    );

    expect(screen.getByText('Could not load guided tours.')).toBeInTheDocument();
  });
});
