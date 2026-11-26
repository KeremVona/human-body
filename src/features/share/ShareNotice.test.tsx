import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';
import { makeStore } from '../../app/store';
import { tourNoticeSet } from '../tours/tourSlice';
import { ShareNotice } from './ShareNotice';

afterEach(() => {
  cleanup();
});

describe('ShareNotice', () => {
  it('renders and dismisses the missing-tour notice', async () => {
    const user = userEvent.setup();
    const store = makeStore();
    store.dispatch(tourNoticeSet('not-found'));

    render(
      <Provider store={store}>
        <ShareNotice />
      </Provider>,
    );

    expect(
      screen.getByText("This tour couldn't be found."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dismiss notice' }));
    expect(store.getState().tour.notice).toBeNull();
  });
});
