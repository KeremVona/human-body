import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeStore } from '../../app/store';
import { toursLoaded, tourStarted, tourStepSet } from './tourSlice';
import { TourBar } from './TourBar';
import type { Tour } from './schema';
import type { TourText } from './localizeTours';

const fixtureDefs: Tour[] = [
  {
    id: 'arm-bone-to-muscle',
    steps: [
      { id: 'step-1', view: { c: [0, 0, 2, 0, 0, 0], s: ['skeletal'], h: [], sel: [] } },
      { id: 'step-2', view: { c: [0, 0, 2, 0, 0, 0], s: ['skeletal'], h: [], sel: [] } },
      { id: 'step-3', view: { c: [0, 0, 2, 0, 0, 0], s: ['skeletal'], h: [], sel: [] } },
      { id: 'step-4', view: { c: [0, 0, 2, 0, 0, 0], s: ['skeletal'], h: [], sel: [] } },
    ],
  },
];

function makeTexts(bodyTwo = 'Explore <b>humerus</b> safely.'): Record<string, TourText> {
  return {
    'arm-bone-to-muscle': {
      title: 'From bone to muscle',
      summary: 'Summary',
      fallback: false,
      steps: {
        'step-1': { title: 'Overview', body: 'Step 1 body.' },
        'step-2': { title: 'Upper arm bones', body: bodyTwo },
        'step-3': { title: 'Biceps focus', body: 'Step 3 body.' },
        'step-4': { title: 'Summary', body: 'Final step body.' },
      },
    },
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('TourBar', () => {
  it('renders Back disabled at step 1, calls nextStep and exitTour, and switches Next to Finish at final step', async () => {
    const user = userEvent.setup();
    const store = makeStore();
    store.dispatch(toursLoaded({ defs: fixtureDefs, texts: makeTexts() }));
    store.dispatch(
      tourStarted({
        id: 'arm-bone-to-muscle',
        savedView: { c: [0, 0, 3, 0, 0, 0], s: ['skeletal'], h: [], sel: [] },
      }),
    );

    const onPrev = vi.fn(async () => {});
    const onNext = vi.fn(async () => {});
    const onExit = vi.fn(async () => {});

    render(
      <Provider store={store}>
        <TourBar onPrev={onPrev} onNext={onNext} onExit={onExit} />
      </Provider>,
    );

    expect(
      screen.getByRole('region', { name: 'From bone to muscle' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(onNext).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Exit tour' }));
    expect(onExit).toHaveBeenCalledTimes(1);

    // Step 2: check progress, Back enabled, live region title, and literal markup escaping
    act(() => {
      store.dispatch(tourStepSet(1));
    });
    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
    const live = screen
      .getByRole('region', { name: 'From bone to muscle' })
      .querySelector('[aria-live="polite"]');
    expect(live?.textContent).toContain('Upper arm bones');
    expect(screen.getByText('Explore <b>humerus</b> safely.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onPrev).toHaveBeenCalledTimes(1);

    // Final step: button switches to Finish
    act(() => {
      store.dispatch(tourStepSet(3));
    });
    expect(screen.getByRole('button', { name: 'Finish' })).toBeInTheDocument();
  });
});
