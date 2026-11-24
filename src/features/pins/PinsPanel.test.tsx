import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { Mesh } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeStore } from '../../app/store';
import { CameraApiProvider, type CameraApi } from '../../scene/camera';
import {
  createMeshRegistry,
  MeshRegistryProvider,
} from '../../scene/meshRegistry';
import { PinsPanel } from './PinsPanel';
import { pinsHydrated } from './pinsSlice';

function fakeCamera(): CameraApi {
  return {
    focusMeshes: vi.fn(async () => {}),
    goToPreset: vi.fn(async () => {}),
    resetView: vi.fn(async () => {}),
    zoom: vi.fn(),
    getPose: vi.fn(() => null),
    setPose: vi.fn(async () => {}),
    lookAtPoint: vi.fn(async () => {}),
  };
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('PinsPanel', () => {
  it('lists pins newest-first and frames pin world point on Go to', async () => {
    const user = userEvent.setup();
    const camera = fakeCamera();
    const registry = createMeshRegistry();
    const mesh = new Mesh();
    mesh.updateMatrixWorld();
    registry.register('femur--l', mesh);

    const store = makeStore();
    store.dispatch(
      pinsHydrated([
        {
          id: 'p1',
          meshId: 'femur--l',
          local: [0.1, 0.2, 0.3],
          label: 'Older pin',
          note: '',
          createdAt: 1000,
        },
        {
          id: 'p2',
          meshId: 'femur--l',
          local: [0.4, 0.5, 0.6],
          label: 'Newer pin',
          note: 'Top head',
          createdAt: 2000,
        },
      ]),
    );

    render(
      <Provider store={store}>
        <MeshRegistryProvider registry={registry}>
          <CameraApiProvider value={camera}>
            <PinsPanel />
          </CameraApiProvider>
        </MeshRegistryProvider>
      </Provider>,
    );

    const labels = screen
      .getAllByRole('listitem')
      .map((el) => el.textContent ?? '');
    expect(labels[0]).toContain('Newer pin');
    expect(labels[1]).toContain('Older pin');

    const goButtons = screen.getAllByRole('button', { name: 'Go to' });
    await user.click(goButtons[0]);
    expect(camera.lookAtPoint).toHaveBeenCalledWith([0.4, 0.5, 0.6]);
  });

  it('shows empty state copy', () => {
    const store = makeStore();
    render(
      <Provider store={store}>
        <MeshRegistryProvider registry={createMeshRegistry()}>
          <CameraApiProvider value={fakeCamera()}>
            <PinsPanel />
          </CameraApiProvider>
        </MeshRegistryProvider>
      </Provider>,
    );

    expect(
      screen.getByText('No pins yet. Right-click a part and choose Add pin.'),
    ).toBeInTheDocument();
  });

  it('supports delete and undo', async () => {
    const user = userEvent.setup();
    const store = makeStore();
    store.dispatch(
      pinsHydrated([
        {
          id: 'p1',
          meshId: 'femur--l',
          local: [0, 0, 0],
          label: 'Neck pin',
          note: '',
          createdAt: 1000,
        },
      ]),
    );

    render(
      <Provider store={store}>
        <MeshRegistryProvider registry={createMeshRegistry()}>
          <CameraApiProvider value={fakeCamera()}>
            <PinsPanel />
          </CameraApiProvider>
        </MeshRegistryProvider>
      </Provider>,
    );

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.queryByText('Neck pin')).toBeNull();
    expect(screen.getByText('Pin deleted')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText('Neck pin')).toBeInTheDocument();
  });

  it('renders notes as text without interpreting HTML', () => {
    const store = makeStore();
    store.dispatch(
      pinsHydrated([
        {
          id: 'p1',
          meshId: 'femur--l',
          local: [0, 0, 0],
          label: 'Safe label',
          note: '<b>x</b>',
          createdAt: 1000,
        },
      ]),
    );

    render(
      <Provider store={store}>
        <MeshRegistryProvider registry={createMeshRegistry()}>
          <CameraApiProvider value={fakeCamera()}>
            <PinsPanel />
          </CameraApiProvider>
        </MeshRegistryProvider>
      </Provider>,
    );

    expect(screen.getByText('<b>x</b>')).toBeInTheDocument();
    expect(document.querySelector('b')).toBeNull();
  });
});
