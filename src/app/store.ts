import {
  combineReducers,
  configureStore,
  type ThunkAction,
  type UnknownAction,
} from '@reduxjs/toolkit';
import { assetsReducer } from '../features/assets/assetsSlice';
import { contentReducer } from '../features/content/contentSlice';
import { dissectionReducer } from '../features/dissection/dissectionSlice';
import { motionReducer } from '../features/motion/motionSlice';
import { pinsReducer } from '../features/pins/pinsSlice';
import { quizReducer } from '../features/quiz/quizSlice';
import { sectionReducer } from '../features/section/sectionSlice';
import { selectionReducer } from '../features/selection/selectionSlice';
import { uiReducer } from '../features/settings/uiSlice';
import { shareReducer } from '../features/share/shareSlice';
import { systemsReducer } from '../features/systems/systemsSlice';
import { tourReducer } from '../features/tours/tourSlice';
import { journeyReducer } from '../features/journey/journeySlice';
import type { CameraApi } from '../scene/camera';
import type { MeshRegistry } from '../scene/meshRegistry';
import { listenerMiddleware } from './listeners';

export type CameraRef = { current: CameraApi | null };

export type ThunkExtra = {
  camera: CameraRef;
  registry?: MeshRegistry;
  subscribe?: (listener: () => void) => () => void;
};

const rootReducer = combineReducers({
  assets: assetsReducer,
  content: contentReducer,
  systems: systemsReducer,
  dissection: dissectionReducer,
  selection: selectionReducer,
  quiz: quizReducer,
  ui: uiReducer,
  share: shareReducer,
  pins: pinsReducer,
  section: sectionReducer,
  motion: motionReducer,
  tour: tourReducer,
  journey: journeyReducer,
});

export type RootState = ReturnType<typeof rootReducer>;

/** Creates an isolated Redux store instance, optionally seeded with `preloaded` slice states. */
export function makeStore(
  preloaded?: Partial<RootState>,
  extra: ThunkExtra = { camera: { current: null } },
) {
  const thunkExtra: ThunkExtra = {
    camera: extra.camera,
    registry: extra.registry,
    subscribe: extra.subscribe,
  };
  const store = configureStore({
    reducer: rootReducer,
    preloadedState: preloaded,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
        thunk: { extraArgument: thunkExtra },
      }).prepend(listenerMiddleware.middleware),
  });
  if (!thunkExtra.subscribe) {
    thunkExtra.subscribe = (listener) => store.subscribe(listener);
  }
  return store;
}

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore['dispatch'];
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  ThunkExtra,
  UnknownAction
>;
