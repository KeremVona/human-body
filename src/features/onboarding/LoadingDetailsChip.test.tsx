import { act, cleanup, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';
import { makeStore } from '../../app/store';
import { previewState } from '../../scene/previewState';
import { bundleFailed, bundleReady } from '../assets/assetsSlice';
import { LoadingDetailsChip } from './LoadingDetailsChip';

afterEach(() => {
  cleanup();
  previewState.set('loading');
});

describe('LoadingDetailsChip', () => {
  it('renders only while preview is shown and skeletal bundle is not ready', () => {
    const store = makeStore();
    render(
      <Provider store={store}>
        <LoadingDetailsChip />
      </Provider>,
    );

    expect(
      screen.queryByText('Loading anatomy details…'),
    ).not.toBeInTheDocument();

    act(() => {
      previewState.set('shown');
    });
    expect(
      screen.getByText('Loading anatomy details…'),
    ).toBeInTheDocument();

    act(() => {
      store.dispatch(bundleReady('skeletal'));
    });
    expect(
      screen.queryByText('Loading anatomy details…'),
    ).not.toBeInTheDocument();
  });

  it('stays hidden when preview transitions directly to gone', () => {
    const store = makeStore();
    act(() => {
      previewState.set('gone');
    });

    render(
      <Provider store={store}>
        <LoadingDetailsChip />
      </Provider>,
    );
    expect(
      screen.queryByText('Loading anatomy details…'),
    ).not.toBeInTheDocument();
  });

  it('hides when skeletal bundle transitions to error', () => {
    const store = makeStore();
    act(() => {
      previewState.set('shown');
    });
    render(
      <Provider store={store}>
        <LoadingDetailsChip />
      </Provider>,
    );
    expect(screen.getByText('Loading anatomy details…')).toBeInTheDocument();

    act(() => {
      store.dispatch(bundleFailed('skeletal'));
    });
    expect(
      screen.queryByText('Loading anatomy details…'),
    ).not.toBeInTheDocument();
  });
});
