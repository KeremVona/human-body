import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type JSX } from 'react';
import { Provider } from 'react-redux';
import { describe, expect, it, vi } from 'vitest';
import { makeStore } from './store';
import { useShortcuts } from './useShortcuts';
import { TopBar } from '../features/about/TopBar';
import { bundleReady } from '../features/assets/assetsSlice';
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
    store.dispatch(bundleReady('skeletal'));
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
    store.dispatch(bundleReady('skeletal'));
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
    await user.keyboard('x');

    expect(store.getState().selection.selectedIds).toEqual(['femur--l']);
    expect(store.getState().dissection.hidden).toEqual(['sternum']);
    expect(store.getState().section.enabled).toBe(false);
  });

  it('toggles cross-section on X outside quiz', async () => {
    const user = userEvent.setup();
    const store = makeStore();
    store.dispatch(bundleReady('skeletal'));

    render(
      <Provider store={store}>
        <CameraApiProvider value={noopCamera}>
          <ShortcutMenuHarness initialMenu={null} />
        </CameraApiProvider>
      </Provider>,
    );

    await user.keyboard('x');
    expect(store.getState().section.enabled).toBe(true);
    await user.keyboard('X');
    expect(store.getState().section.enabled).toBe(false);
  });

  it('keeps dissection and selection shortcuts inert until skeletal is ready', async () => {
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

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await user.keyboard('h');
    await user.keyboard('x');
    await user.keyboard('{Escape}');
    expect(store.getState().dissection.hidden).toEqual([]);
    expect(store.getState().section.enabled).toBe(false);
    expect(store.getState().selection.selectedIds).toEqual(['femur--l']);
  });

  it('focuses the search box on / even when UI locale is Turkish', async () => {
    const user = userEvent.setup();
    const { localeSet } = await import('../features/settings/uiSlice');
    const { loadMessages, __resetI18nForTests } = await import('../i18n/t');
    const { SearchBox } = await import('../features/search/SearchBox');
    const { bootstrap } = await import('../features/content/contentSlice');
    const taxonomy = (await import('../../content/taxonomy.json')).default;

    const store = makeStore();
    store.dispatch(
      bootstrap.fulfilled(
        {
          manifest: {
            version: 1,
            generatedAt: '2026-11-21T00:00:00Z',
            source: {
              name: 'Z-Anatomy',
              version: '1',
              license: 'CC-BY-SA-4.0',
            },
            bundles: [],
            meshes: {},
          },
          taxonomy: taxonomy as never,
          index: { locale: 'tr', structures: [] },
        },
        'req-1',
        undefined,
      ),
    );
    store.dispatch(localeSet('tr'));
    await loadMessages('tr');

    render(
      <Provider store={store}>
        <CameraApiProvider value={noopCamera}>
          <ShortcutMenuHarness initialMenu={null} />
          <SearchBox />
        </CameraApiProvider>
      </Provider>,
    );

    const search = screen.getByRole('combobox', { name: 'Yapıları ara' });
    expect(search).not.toHaveFocus();
    await user.keyboard('/');
    expect(search).toHaveFocus();

    store.dispatch(localeSet('en'));
    localStorage.clear();
    __resetI18nForTests();
  });

  it('handles ArrowRight/ArrowLeft stepping and Escape deselect-then-exit during a tour', async () => {
    const user = userEvent.setup();
    const { toursLoaded, tourStarted } = await import(
      '../features/tours/tourSlice'
    );
    const store = makeStore();
    store.dispatch(bundleReady('skeletal'));
    store.dispatch(
      toursLoaded({
        defs: [
          {
            id: 'arm-bone-to-muscle',
            steps: [
              { id: 'step-1', view: { c: [0, 0, 2, 0, 0, 0], s: ['skeletal'], h: [], sel: ['femur--l'] } },
              { id: 'step-2', view: { c: [0, 0, 2, 0, 0, 0], s: ['skeletal'], h: [], sel: [] } },
              { id: 'step-3', view: { c: [0, 0, 2, 0, 0, 0], s: ['skeletal'], h: [], sel: [] } },
              { id: 'step-4', view: { c: [0, 0, 2, 0, 0, 0], s: ['skeletal'], h: [], sel: [] } },
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

    render(
      <Provider store={store}>
        <CameraApiProvider value={noopCamera}>
          <ShortcutMenuHarness initialMenu={null} />
        </CameraApiProvider>
      </Provider>,
    );

    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(store.getState().tour.stepIndex).toBe(1));

    await user.keyboard('{ArrowLeft}');
    await waitFor(() => expect(store.getState().tour.stepIndex).toBe(0));

    // Step 1 selects femur--l; first Escape clears selection without exiting tour
    await waitFor(() =>
      expect(store.getState().selection.selectedIds).toEqual(['femur--l']),
    );
    await user.keyboard('{Escape}');
    expect(store.getState().selection.selectedIds).toEqual([]);
    expect(store.getState().tour.activeId).toBe('arm-bone-to-muscle');

    // Second Escape exits tour
    await user.keyboard('{Escape}');
    await waitFor(() => expect(store.getState().tour.activeId).toBeNull());
  });
});
