import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';
import { makeStore } from '../../app/store';
import { PinEditor } from './PinEditor';
import { editorOpened, pinAdded, pinEdited } from './pinsSlice';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('PinEditor', () => {
  it('disables Save when label is empty', async () => {
    const user = userEvent.setup();
    const store = makeStore();
    store.dispatch(
      pinAdded({ meshId: 'femur--l', local: [0, 0, 0], label: 'Femur' }),
    );

    render(
      <Provider store={store}>
        <PinEditor />
      </Provider>,
    );

    const labelInput = screen.getByLabelText('Label');
    await user.clear(labelInput);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('Cancel on a new pin removes it, while Cancel on an existing pin keeps it', async () => {
    const user = userEvent.setup();
    const store = makeStore();
    store.dispatch(
      pinAdded({ meshId: 'femur--l', local: [0, 0, 0], label: 'New pin' }),
    );

    render(
      <Provider store={store}>
        <PinEditor />
      </Provider>,
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(store.getState().pins.items).toHaveLength(0);

    store.dispatch(
      pinAdded({ meshId: 'sternum', local: [0, 1, 0], label: 'Saved pin' }),
    );
    const id = store.getState().pins.items[0].id;
    store.dispatch(pinEdited({ id, label: 'Saved pin', note: 'Original' }));
    store.dispatch(editorOpened(id));

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(store.getState().pins.items).toHaveLength(1);
    expect(store.getState().pins.items[0].note).toBe('Original');
  });

  it('renders notes as text without interpreting HTML', () => {
    const store = makeStore();
    store.dispatch(
      pinAdded({ meshId: 'femur--l', local: [0, 0, 0], label: 'HTML test' }),
    );
    const id = store.getState().pins.items[0].id;
    store.dispatch(pinEdited({ id, label: 'HTML test', note: '<b>x</b>' }));
    store.dispatch(editorOpened(id));

    render(
      <Provider store={store}>
        <PinEditor />
      </Provider>,
    );

    const textarea = screen.getByLabelText('Note') as HTMLTextAreaElement;
    expect(textarea.value).toBe('<b>x</b>');
    expect(document.querySelector('b')).toBeNull();
  });
});
