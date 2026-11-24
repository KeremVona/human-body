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
});
