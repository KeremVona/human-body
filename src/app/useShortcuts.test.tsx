import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type JSX } from 'react';
import { Provider } from 'react-redux';
import { describe, expect, it, vi } from 'vitest';
import { makeStore } from './store';
import { useShortcuts } from './useShortcuts';
import { TopBar } from '../features/about/TopBar';
import {
  DissectionMenu,
  type ContextMenuTarget,
} from '../features/dissection/DissectionMenu';
import { hide } from '../features/dissection/dissectionSlice';
import { quizStarted } from '../features/quiz/quizSlice';
import { selected } from '../features/selection/selectionSlice';
import { CameraApiProvider, type CameraApi } from '../scene/camera';

const noopCamera: CameraApi = {
  focusMeshes: vi.fn(async () => {}),
  goToPreset: vi.fn(async () => {}),
  resetView: vi.fn(async () => {}),
  zoom: vi.fn(),
  getPose: vi.fn(() => null),
  setPose: vi.fn(async () => {}),
  lookAtPoint: vi.fn(async () => {}),
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

  it('suppresses viewer shortcuts while a modal dialog is open', async () => {
    const user = userEvent.setup();
    const store = makeStore();
    store.dispatch(selected(['femur--l']));
    const camera: CameraApi = {
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
        <CameraApiProvider value={camera}>
          <ShortcutMenuHarness initialMenu={null} />
          <TopBar />
        </CameraApiProvider>
      </Provider>,
    );

    await user.click(screen.getByRole('button', { name: 'About this atlas' }));
    expect(
      screen.getByRole('dialog', { name: 'About Anatomy Atlas' }),
    ).toBeInTheDocument();

    await user.keyboard('h');
    await user.keyboard('f');
    await user.keyboard('0');

    expect(store.getState().dissection.hidden).toEqual([]);
    expect(camera.focusMeshes).not.toHaveBeenCalled();
    expect(camera.resetView).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');
    expect(
      screen.queryByRole('dialog', { name: 'About Anatomy Atlas' }),
    ).not.toBeInTheDocument();
    expect(store.getState().selection.selectedIds).toEqual(['femur--l']);
  });

  it('suppresses Escape deselect and Ctrl+Z undo while a quiz is active', async () => {
    const user = userEvent.setup();
    const store = makeStore();
    store.dispatch(hide(['sternum']));
    store.dispatch(
      quizStarted({
        questions: ['femur--l'],
        savedDissection: { hidden: ['sternum'], isolated: null, faded: null },
        best: 0,
      }),
    );
    store.dispatch(selected(['femur--l']));

    render(
      <Provider store={store}>
        <CameraApiProvider value={noopCamera}>
          <ShortcutMenuHarness initialMenu={null} />
        </CameraApiProvider>
      </Provider>,
    );

    await user.keyboard('{Escape}');
    await user.keyboard('{Control>}z{/Control}');

    expect(store.getState().selection.selectedIds).toEqual(['femur--l']);
    expect(store.getState().dissection.hidden).toEqual(['sternum']);
  });
});
