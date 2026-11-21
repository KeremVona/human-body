import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type JSX } from 'react';
import { Provider } from 'react-redux';
import { describe, expect, it, vi } from 'vitest';
import { makeStore } from './store';
import { useShortcuts } from './useShortcuts';
import {
  DissectionMenu,
  type ContextMenuTarget,
} from '../features/dissection/DissectionMenu';
import { selected } from '../features/selection/selectionSlice';
import { CameraApiProvider, type CameraApi } from '../scene/camera';

const noopCamera: CameraApi = {
  focusMeshes: vi.fn(async () => {}),
  goToPreset: vi.fn(async () => {}),
  resetView: vi.fn(async () => {}),
  zoom: vi.fn(),
};

function ShortcutMenuHarness({
  initialMenu,
}: {
  initialMenu: ContextMenuTarget | null;
}): JSX.Element {
  const [menu, setMenu] = useState<ContextMenuTarget | null>(initialMenu);
  useShortcuts();
  return <DissectionMenu target={menu} onClose={() => setMenu(null)} />;
}

describe('useShortcuts', () => {
  it('lets Escape close an open DissectionMenu without clearing the selection, then clears on the second Escape', async () => {
    const user = userEvent.setup();
    const store = makeStore();
    store.dispatch(selected(['femur--l']));

    render(
      <Provider store={store}>
        <CameraApiProvider value={noopCamera}>
          <ShortcutMenuHarness
            initialMenu={{ x: 100, y: 100, meshIds: ['femur--l'] }}
          />
        </CameraApiProvider>
      </Provider>,
    );

    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(store.getState().selection.selectedIds).toEqual(['femur--l']);

    await user.keyboard('{Escape}');
    expect(store.getState().selection.selectedIds).toEqual([]);
  });
});
