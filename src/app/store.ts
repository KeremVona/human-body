import {
  combineReducers,
  configureStore,
  type ThunkAction,
  type UnknownAction,
} from '@reduxjs/toolkit';
import { assetsReducer } from '../features/assets/assetsSlice';
import { contentReducer } from '../features/content/contentSlice';
import { systemsReducer } from '../features/systems/systemsSlice';
import { listenerMiddleware } from './listeners';

const rootReducer = combineReducers({
  assets: assetsReducer,
  content: contentReducer,
  systems: systemsReducer,
});

export type RootState = ReturnType<typeof rootReducer>;

/** Creates an isolated Redux store instance, optionally seeded with `preloaded` slice states. */
export function makeStore(preloaded?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState: preloaded,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
      }).prepend(listenerMiddleware.middleware),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore['dispatch'];
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  UnknownAction
>;
