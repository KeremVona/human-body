import {
  combineReducers,
  configureStore,
  type ThunkAction,
  type UnknownAction,
} from '@reduxjs/toolkit';
import { assetsReducer } from '../features/assets/assetsSlice';
import { contentReducer } from '../features/content/contentSlice';
import { dissectionReducer } from '../features/dissection/dissectionSlice';
import { selectionReducer } from '../features/selection/selectionSlice';
import { systemsReducer } from '../features/systems/systemsSlice';
import type { CameraApi } from '../scene/camera';
import { listenerMiddleware } from './listeners';

export type CameraRef = { current: CameraApi | null };

export type ThunkExtra = {
  camera: CameraRef;
  subscribe?: (listener: () => void) => () => void;
};

const rootReducer = combineReducers({
  assets: assetsReducer,
  content: contentReducer,
  systems: systemsReducer,
  dissection: dissectionReducer,
  selection: selectionReducer,
});

export type RootState = ReturnType<typeof rootReducer>;

/** Creates an isolated Redux store instance, optionally seeded with `preloaded` slice states. */
export function makeStore(
  preloaded?: Partial<RootState>,
  extra: ThunkExtra = { camera: { current: null } },
) {
  const thunkExtra: ThunkExtra = {
    camera: extra.camera,
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
