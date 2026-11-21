import {
  createSelector,
  createSlice,
  type PayloadAction,
  type ThunkAction,
  type UnknownAction,
} from '@reduxjs/toolkit';
import { parseMeshId, type MeshId } from '../../data/ids';
import type { Manifest, SystemId } from '../../data/schema';
import {
  bootstrap,
  selectStructureLookup,
  type ContentState,
} from '../content/contentSlice';
import type { BundleStatus } from './scheduler';

export type BootStatus = 'idle' | 'loading' | 'ready' | 'error';

export type AssetsState = {
  manifest: Manifest | null;
  boot: BootStatus;
  bundles: Record<string, BundleStatus>;
  requested: string[];
};

const initialState: AssetsState = {
  manifest: null,
  boot: 'idle',
  bundles: {},
  requested: [],
};

const assetsSlice = createSlice({
  name: 'assets',
  initialState,
  reducers: {
    bundleStarted(state, action: PayloadAction<string>) {
      const id = action.payload;
      state.bundles[id] = 'loading';
      state.requested = state.requested.filter((x) => x !== id);
    },
    bundleReady(state, action: PayloadAction<string>) {
      state.bundles[action.payload] = 'ready';
    },
    bundleFailed(state, action: PayloadAction<string>) {
      state.bundles[action.payload] = 'error';
    },
    bundlesRequested(state, action: PayloadAction<string[]>) {
      for (const id of action.payload) {
        if (state.bundles[id] !== 'ready' && !state.requested.includes(id)) {
          state.requested.push(id);
        }
      }
    },
    bundleRetry(
      state,
      action: PayloadAction<{ id: string; meshIds: MeshId[] }>,
    ) {
      const { id } = action.payload;
      state.bundles[id] = 'idle';
      state.requested = [id, ...state.requested.filter((x) => x !== id)];
    },
  },
  extraReducers: (builder) => {
    builder.addCase(bootstrap.pending, (state) => {
      state.boot = 'loading';
    });
    builder.addCase(bootstrap.fulfilled, (state, action) => {
      state.boot = 'ready';
      state.manifest = action.payload.manifest;
      state.bundles = Object.fromEntries(
        action.payload.manifest.bundles.map((b) => [b.id, 'idle' as const]),
      );
    });
    builder.addCase(bootstrap.rejected, (state) => {
      state.boot = 'error';
    });
  },
});

export const assetsReducer = assetsSlice.reducer;
export const {
  bundleStarted,
  bundleReady,
  bundleFailed,
  bundlesRequested,
  bundleRetry,
} = assetsSlice.actions;

/** Looks up the bundle's meshIds from the manifest and dispatches `bundleRetry`. */
export function retryBundle(
  id: string,
): ThunkAction<void, { assets: AssetsState }, unknown, UnknownAction> {
  return (dispatch, getState) => {
    const meshIds =
      getState().assets.manifest?.bundles.find((b) => b.id === id)?.meshIds ??
      [];
    dispatch(bundleRetry({ id, meshIds }));
  };
}

/** Returns bundle ids containing at least one mesh belonging to `system`. */
export const selectBundlesForSystem = createSelector(
  [
    (state: { assets: AssetsState }) => state.assets.manifest,
    selectStructureLookup,
    (
      _state: { assets: AssetsState; content: ContentState },
      system: SystemId,
    ) => system,
  ],
  (manifest, lookup, system): string[] => {
    if (!manifest) return [];
    const ids: string[] = [];
    for (const bundle of manifest.bundles) {
      const matches = bundle.meshIds.some((meshId) => {
        const entry = lookup.get(parseMeshId(meshId).structureId);
        return entry?.system === system;
      });
      if (matches) {
        ids.push(bundle.id);
      }
    }
    return ids;
  },
);
