import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { describe, expect, it, vi } from 'vitest';
import { makeStore } from '../../app/store';
import { CameraApiProvider, type CameraApi } from '../../scene/camera';
import { hide } from './dissectionSlice';
import { Toolbar } from './Toolbar';

describe('Toolbar', () => {
  function setup() {
    const store = makeStore();
    const cameraApi: CameraApi = {
      focusMeshes: vi.fn(async () => {}),
      goToPreset: vi.fn(async () => {}),
      resetView: vi.fn(async () => {}),
      zoom: vi.fn(),
      getPose: vi.fn(() => null),
      setPose: vi.fn(async () => {}),
      lookAtPoint: vi.fn(async () => {}),
    };
    render(
      <Provider store={store}>
        <CameraApiProvider value={cameraApi}>
          <Toolbar />
        </CameraApiProvider>
      </Provider>,
    );
    return { store, cameraApi };
  }

  it('disables Undo and Show all on a fresh store', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Show all' })).toBeDisabled();
  });

  it('enables Undo and Show all after hide and restores on Undo', async () => {
    const user = userEvent.setup();
    const { store } = setup();

    act(() => {
      store.dispatch(hide(['femur--l']));
    });
    const undoBtn = await screen.findByRole('button', { name: 'Undo' });
    const showAllBtn = screen.getByRole('button', { name: 'Show all' });

    expect(undoBtn).toBeEnabled();
    expect(showAllBtn).toBeEnabled();

    await user.click(undoBtn);
    expect(store.getState().dissection.hidden).toEqual([]);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('calls CameraApi.goToPreset for every preset button', async () => {
    const user = userEvent.setup();
    const { cameraApi } = setup();

    const cases = [
      ['Anterior view', 'anterior'],
      ['Posterior view', 'posterior'],
      ['Left lateral view', 'left'],
      ['Right lateral view', 'right'],
      ['Superior view', 'superior'],
      ['Inferior view', 'inferior'],
    ] as const;

    for (const [label, preset] of cases) {
      await user.click(screen.getByRole('button', { name: label }));
      expect(cameraApi.goToPreset).toHaveBeenCalledWith(preset);
    }

    await user.click(screen.getByRole('button', { name: 'Reset view' }));
    expect(cameraApi.resetView).toHaveBeenCalledTimes(1);
  });
});
