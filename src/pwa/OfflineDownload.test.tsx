import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeStore } from '../app/store';
import { bootstrap } from '../features/content/contentSlice';
import type { Manifest } from '../data/schema';
import { OfflineDownload } from './OfflineDownload';
import { markOfflineReady } from './offline';

const manifest: Manifest = {
  version: 1,
  generatedAt: '2026-11-26T10:00:00Z',
  source: {
    name: 'Z-Anatomy',
    version: '2023-05-02',
    license: 'CC-BY-SA-4.0',
  },
  bundles: [
    {
      id: 'skeletal',
      file: 'skeletal.aaaaaaaa.glb',
      bytes: 10 * 1024 * 1024,
      sha256: 'a'.repeat(64),
      meshIds: [],
    },
  ],
  meshes: {},
};

function makeBootedStore() {
  const store = makeStore();
  store.dispatch(
    bootstrap.fulfilled(
      {
        manifest,
        taxonomy: { systems: [], regions: [], uiGroups: [] },
        index: { locale: 'en', structures: [] },
        enIndex: { locale: 'en', structures: [] },
        locale: 'en',
        fallbackIndexIds: [],
      },
      'req-1',
      undefined,
    ),
  );
  return store;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('OfflineDownload', () => {
  it('renders nothing when no service worker controls the page', () => {
    const store = makeBootedStore();
    const { container } = render(
      <Provider store={store}>
        <OfflineDownload hasController={false} />
      </Provider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows size button, downloads all assets, and displays ready state', async () => {
    const user = userEvent.setup();
    const store = makeBootedStore();
    const downloadFn = vi.fn(async ({ urls, onProgress }) => {
      onProgress?.({ done: 1, total: urls.length });
      onProgress?.({ done: urls.length, total: urls.length });
    });

    render(
      <Provider store={store}>
        <OfflineDownload hasController download={downloadFn} />
      </Provider>,
    );

    const button = screen.getByRole('button', {
      name: 'Make available offline (10 MB)',
    });
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText('Available offline')).toBeInTheDocument();
    });
    expect(downloadFn).toHaveBeenCalledTimes(1);
  });

  it('renders already-ready status when generatedAt was previously cached', () => {
    markOfflineReady(manifest.generatedAt);
    const store = makeBootedStore();
    render(
      <Provider store={store}>
        <OfflineDownload hasController />
      </Provider>,
    );
    expect(screen.getByText('Available offline')).toBeInTheDocument();
  });

  it('displays quota error message when storage quota is exceeded', async () => {
    const user = userEvent.setup();
    const store = makeBootedStore();
    const downloadFn = vi.fn(async () => {
      throw new Error('quota');
    });

    render(
      <Provider store={store}>
        <OfflineDownload hasController download={downloadFn} />
      </Provider>,
    );

    await user.click(
      screen.getByRole('button', { name: 'Make available offline (10 MB)' }),
    );

    await waitFor(() => {
      expect(
        screen.getByText('Not enough device storage for offline use.'),
      ).toBeInTheDocument();
    });
  });

  it('displays failure error message on network failure', async () => {
    const user = userEvent.setup();
    const store = makeBootedStore();
    const downloadFn = vi.fn(async () => {
      throw new Error('failed');
    });

    render(
      <Provider store={store}>
        <OfflineDownload hasController download={downloadFn} />
      </Provider>,
    );

    await user.click(
      screen.getByRole('button', { name: 'Make available offline (10 MB)' }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          'Offline download failed. Please check your connection.',
        ),
      ).toBeInTheDocument();
    });
  });
});
