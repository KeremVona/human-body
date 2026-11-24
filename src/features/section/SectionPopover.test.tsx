import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeStore } from '../../app/store';
import { CameraApiProvider, type CameraApi } from '../../scene/camera';
import { Toolbar } from '../dissection/Toolbar';

afterEach(() => {
  cleanup();
});

function renderToolbar() {
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
  return { store };
}

describe('SectionPopover', () => {
  it('enables and configures cross-section from the toolbar button', async () => {
    const user = userEvent.setup();
    const { store } = renderToolbar();

    const trigger = screen.getByRole('button', { name: 'Cross-section' });
    expect(trigger).toHaveAttribute('aria-pressed', 'false');
    await user.click(trigger);

    const toggle = await screen.findByRole('switch', { name: 'Cross-section' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    await user.click(toggle);
    expect(store.getState().section.enabled).toBe(true);
    expect(trigger).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('radio', { name: 'Coronal' }));
    expect(store.getState().section.axis).toBe('coronal');

    const slider = screen.getByRole('slider', { name: 'Section position' });
    slider.focus();
    await user.keyboard('{End}');
    expect(store.getState().section.t).toBe(1);
    expect(screen.getByText('100%')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Flip side' }));
    expect(store.getState().section.flip).toBe(true);
  });

  it('disables axis radios, position slider, and flip button while section is off', async () => {
    const user = userEvent.setup();
    renderToolbar();

    await user.click(screen.getByRole('button', { name: 'Cross-section' }));
    await screen.findByRole('switch', { name: 'Cross-section' });

    for (const label of ['Axial', 'Sagittal', 'Coronal'] as const) {
      const radio = screen.getByRole('radio', { name: label });
      expect(
        radio.hasAttribute('disabled') || radio.hasAttribute('data-disabled'),
      ).toBe(true);
    }

    const slider = screen.getByRole('slider', { name: 'Section position' });
    expect(slider).toHaveAttribute('data-disabled');

    const flipBtn = screen.getByRole('button', { name: 'Flip side' });
    expect(flipBtn).toBeDisabled();
  });
});
