import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeStore } from '../../app/store';
import { pinAdded } from '../pins/pinsSlice';
import { decodeViewState } from './codec';
import { SharePopover } from './SharePopover';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('SharePopover', () => {
  it('generates share link and copies via clipboard', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const store = makeStore();
    render(
      <Provider store={store}>
        <SharePopover open onOpenChange={() => {}} />
      </Provider>,
    );

    const input = (await screen.findByLabelText(
      'Share link',
    )) as HTMLInputElement;
    await waitFor(() => {
      expect(input.value).toMatch(/^http:\/\/localhost(:\d+)?\/#v1\./);
    });

    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(writeText).toHaveBeenCalledWith(input.value);
    expect(await screen.findByText('Link copied')).toBeInTheDocument();
  });

  it('selects the input text when clipboard write rejects', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn(async () => Promise.reject(new Error('denied'))),
      },
    });

    const store = makeStore();
    render(
      <Provider store={store}>
        <SharePopover open onOpenChange={() => {}} />
      </Provider>,
    );

    const input = (await screen.findByLabelText(
      'Share link',
    )) as HTMLInputElement;
    await waitFor(() => {
      expect(input.value.length).toBeGreaterThan(10);
    });

    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    await waitFor(() => {
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(input.value.length);
    });
  });

  it('include pins changes the link', async () => {
    const user = userEvent.setup();
    const store = makeStore();
    store.dispatch(
      pinAdded({ meshId: 'femur--l', local: [0, 1, 0], label: 'My pin' }),
    );

    render(
      <Provider store={store}>
        <SharePopover open onOpenChange={() => {}} />
      </Provider>,
    );

    const input = (await screen.findByLabelText(
      'Share link',
    )) as HTMLInputElement;
    await waitFor(() => expect(input.value).toContain('#v1.'));
    const hashBefore = input.value.slice(input.value.indexOf('#'));

    await user.click(screen.getByRole('checkbox', { name: 'Include my pins' }));
    await waitFor(() => {
      expect(input.value.slice(input.value.indexOf('#'))).not.toBe(hashBefore);
    });

    const decoded = await decodeViewState(
      input.value.slice(input.value.indexOf('#')),
      {
        meshIds: new Set(['femur--l']),
        systems: new Set(['skeletal'] as const),
      },
    );
    expect(decoded.ok && decoded.view.p?.length).toBe(1);
  });

  it('shows long link warning when URL exceeds 4,000 characters', async () => {
    const store = makeStore();
    const hugeEncoder = vi.fn(async () => `#v1.${'a'.repeat(4001)}`);

    render(
      <Provider store={store}>
        <SharePopover open onOpenChange={() => {}} encode={hugeEncoder} />
      </Provider>,
    );

    expect(
      await screen.findByText(
        'This link is long and some apps may cut it off.',
      ),
    ).toBeInTheDocument();
  });

  it('offers Link to this step during active tour and hides dev-only Copy as tour step when isDev is false', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn<(text: string) => Promise<void>>(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const store = makeStore();
    const { toursLoaded, tourStarted, tourStepSet } = await import(
      '../tours/tourSlice'
    );
    store.dispatch(
      toursLoaded({
        defs: [
          {
            id: 'arm-bone-to-muscle',
            steps: [
              {
                id: 'step-1',
                view: { c: [0, 0, 3, 0, 0, 0], s: ['skeletal'], h: [], sel: [] },
              },
              {
                id: 'step-2',
                view: { c: [0, 0, 3, 0, 0, 0], s: ['skeletal'], h: [], sel: [] },
              },
              {
                id: 'step-3',
                view: { c: [0, 0, 3, 0, 0, 0], s: ['skeletal'], h: [], sel: [] },
              },
              {
                id: 'step-4',
                view: { c: [0, 0, 3, 0, 0, 0], s: ['skeletal'], h: [], sel: [] },
              },
            ],
          },
        ],
        texts: {},
      }),
    );
    store.dispatch(
      tourStarted({
        id: 'arm-bone-to-muscle',
        savedView: { c: [0, 0, 3, 0, 0, 0], s: ['skeletal'], h: [], sel: [] },
      }),
    );
    store.dispatch(tourStepSet(1));

    const { rerender } = render(
      <Provider store={store}>
        <SharePopover open onOpenChange={() => {}} isDev={false} />
      </Provider>,
    );

    expect(
      screen.queryByRole('button', { name: 'Copy as tour step' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Link to this step' }));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('#tour/arm-bone-to-muscle/2'),
    );

    rerender(
      <Provider store={store}>
        <SharePopover open onOpenChange={() => {}} isDev />
      </Provider>,
    );
    const devBtn = screen.getByRole('button', { name: 'Copy as tour step' });
    await user.click(devBtn);
    const copiedJson = writeText.mock.calls[1]?.[0] ?? '';
    expect(copiedJson.length).toBeGreaterThan(0);
    expect(JSON.parse(copiedJson).id).toBe('step-x');
    expect(JSON.parse(copiedJson).view.p).toBeUndefined();
  });

  it('offers Link to this stage during active journey', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn<(text: string) => Promise<void>>(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const store = makeStore();
    const { journeysLoaded, journeyStarted, journeyStageSet } = await import(
      '../journey/journeySlice'
    );
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
                organs: [],
                view: { c: [0, 0, 2, 0, 0, 0], s: ['digestive'], h: [], sel: [] },
                path: [{ line: 'a' }],
                modelled: true,
                meters: { carbs: 5 },
              },
              {
                id: 'stomach',
                durationS: 14,
                look: 'chyme',
                radius: 0.011,
                motion: 'churn',
                organs: [],
                view: { c: [0, 0, 2, 0, 0, 0], s: ['digestive'], h: [], sel: [] },
                path: [{ line: 'b' }],
                modelled: true,
                meters: { carbs: 30 },
              },
            ],
          },
        ],
        texts: {},
        centerlines: { version: 1, lines: { a: [[0, 0, 0], [0, 0.1, 0]], b: [[0, 0.1, 0], [0, 0.2, 0]] } },
      }),
    );
    store.dispatch(
      journeyStarted({
        id: 'digestion',
        stageIndex: 0,
        progress: 0,
        following: true,
        playing: true,
      }),
    );
    store.dispatch(journeyStageSet(1));

    render(
      <Provider store={store}>
        <SharePopover open onOpenChange={() => {}} />
      </Provider>,
    );

    await user.click(screen.getByRole('button', { name: 'Link to this stage' }));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('#journey/digestion/2'),
    );
  });
});
