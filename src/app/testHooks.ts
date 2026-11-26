import type { MeshId } from '../data/ids';
import { motionPhase } from '../features/motion/motionPhase';
import { pinScreens, type PinScreen } from '../features/pins/pinProjection';
import { startQuiz } from '../features/quiz/thunks';
import type { SectionState } from '../features/section/sectionSlice';
import { selected } from '../features/selection/selectionSlice';
import {
  computeDrawStats,
  type BatchRegistry,
  type DrawStats,
} from '../scene/batching/batchRegistry';
import type { CameraController, Pose } from '../scene/camera';
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
  startQuiz(seed?: number): void;
  quizTarget(): MeshId | null;
  meshVisible(id: MeshId): boolean;
  drawStats(): DrawStats & { sceneChildren: number };
  encodeView(): Promise<string>;
  getPose(): Pose | null;
  pinScreenPoints(): PinScreen[];
  section(): SectionState;
  motionPhase(): number;
  meshTransform(id: MeshId): {
    position: number[];
    quaternion: number[];
    scale: number[];
  } | null;
};

/** Exposes dev/e2e inspection hooks on `window.__atlas`; stripped from production builds. */
export function installTestHooks(api: {
  registry: MeshRegistry;
  batchRegistry?: BatchRegistry;
  getSceneChildren?: () => number;
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
    startQuiz: (seed) => {
      api.store.dispatch(startQuiz(seed));
    },
    quizTarget: () => {
      const q = api.store.getState().quiz;
      return q.status === 'asking' ? (q.questions[q.current] ?? null) : null;
    },
    meshVisible: (id) => {
      const mesh = api.registry.get(id);
      if (!mesh) return false;
      if (mesh.visible) return true;
      const batched = api.batchRegistry?.byMesh(id);
      return Boolean(
        batched &&
          batched.handle.batch.visible &&
          batched.handle.batch.getVisibleAt(batched.instance),
      );
    },
    drawStats: () => ({
      ...computeDrawStats(api.registry, api.batchRegistry ?? null),
      sceneChildren: api.getSceneChildren?.() ?? 0,
    }),
    encodeView: async () => {
      const [{ encodeViewState }, { captureViewState }] = await Promise.all([
        import('../features/share/codec'),
        import('../features/share/thunks'),
      ]);
      const view = api.store.dispatch(captureViewState({ includePins: false }));
      return encodeViewState(view);
    },
    getPose: () => api.camera?.api.getPose() ?? null,
    pinScreenPoints: () => pinScreens.get(),
    section: () => api.store.getState().section,
    motionPhase: () => motionPhase.get(),
    meshTransform: (id) => {
      const obj = api.registry.get(id);
      if (!obj) return null;
      return {
        position: obj.position.toArray(),
        quaternion: obj.quaternion.toArray(),
        scale: obj.scale.toArray(),
      };
    },
  };
}
