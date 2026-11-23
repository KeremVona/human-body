import type { MeshId } from '../data/ids';
import { selected } from '../features/selection/selectionSlice';
import type { CameraController } from '../scene/camera';
import type { MeshRegistry } from '../scene/meshRegistry';
import { pointerPosition } from '../scene/pointerPosition';
import type { AppDispatch, AppStore, RootState } from './store';

export type AtlasTestApi = {
  meshCount(): number;
  meshIds(): MeshId[];
  readonly ready: boolean;
  select(ids: MeshId[]): void;
  setPointer(x: number, y: number): void;
  getState(): RootState;
  dispatch: AppDispatch;
  screenPointOf(id: MeshId): { x: number; y: number } | null;
  waitIdle(): Promise<void>;
};

/** Exposes dev/e2e inspection hooks on `window.__atlas`; stripped from production builds. */
export function installTestHooks(api: {
  registry: MeshRegistry;
  store: AppStore;
  camera: CameraController | null;
  isReady(): boolean;
}): void {
  if (!import.meta.env.DEV) return;
  const target = window as unknown as { __atlas?: AtlasTestApi };
  target.__atlas = {
    meshCount: () => api.registry.size,
    meshIds: () => api.registry.ids(),
    get ready(): boolean {
      return api.isReady();
    },
    select: (ids) => {
      api.store.dispatch(selected(ids));
    },
    setPointer: (x, y) => {
      pointerPosition.set(x, y);
    },
    getState: () => api.store.getState(),
    dispatch: api.store.dispatch,
    screenPointOf: (id) => api.camera?.screenPointOf(id) ?? null,
    waitIdle: () => api.camera?.waitIdle() ?? Promise.resolve(),
  };
}
