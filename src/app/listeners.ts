import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import { isMeshId, parseMeshId } from '../data/ids';
import { bundleUrl } from '../data/manifest';
import { SystemIdSchema, type SystemId } from '../data/schema';
import {
  bundleReady,
  bundleRetry,
  bundlesRequested,
  selectBundlesForSystem,
  type AssetsState,
} from '../features/assets/assetsSlice';
import {
  loadStructures,
  selectStructureLookup,
  type ContentState,
} from '../features/content/contentSlice';
import { selected } from '../features/selection/selectionSlice';
import {
  systemToggled,
  uiGroupToggled,
  type SystemsState,
} from '../features/systems/systemsSlice';
import { clearGltf } from '../scene/gltfCache';

type ListenerState = {
  assets: AssetsState;
  content: ContentState;
  systems: SystemsState;
};

/** App-wide Redux listener middleware for bundle cache clearing and lazy structure loading. */
export const listenerMiddleware = createListenerMiddleware<ListenerState>();

listenerMiddleware.startListening({
  actionCreator: bundleRetry,
  effect: (action, listenerApi) => {
    const manifest = listenerApi.getState().assets.manifest;
    const bundle = manifest?.bundles.find((b) => b.id === action.payload.id);
    if (bundle) {
      clearGltf(bundleUrl(bundle.file));
    }
  },
});

listenerMiddleware.startListening({
  actionCreator: bundleReady,
  effect: (action, listenerApi) => {
    const state = listenerApi.getState();
    const bundle = state.assets.manifest?.bundles.find(
      (b) => b.id === action.payload,
    );
    if (!bundle) return;

    const lookup = selectStructureLookup(state);
    const systems = new Set<SystemId>();
    for (const meshId of bundle.meshIds) {
      const entry = lookup.get(parseMeshId(meshId).structureId);
      if (entry) {
        systems.add(entry.system);
      }
    }

    for (const system of systems) {
      void listenerApi.dispatch(loadStructures(system));
    }
  },
});

listenerMiddleware.startListening({
  matcher: isAnyOf(systemToggled, uiGroupToggled),
  effect: (_action, listenerApi) => {
    const prev = listenerApi.getOriginalState();
    const next = listenerApi.getState();
    const toRequest = new Set<string>();

    for (const sys of SystemIdSchema.options) {
      if (!prev.systems[sys].enabled && next.systems[sys].enabled) {
        for (const bundleId of selectBundlesForSystem(next, sys)) {
          if (next.assets.bundles[bundleId] !== 'ready') {
            toRequest.add(bundleId);
          }
        }
      }
    }

    if (toRequest.size > 0) {
      listenerApi.dispatch(bundlesRequested([...toRequest]));
    }
  },
});

listenerMiddleware.startListening({
  actionCreator: selected,
  effect: (action, listenerApi) => {
    const state = listenerApi.getState();
    const lookup = selectStructureLookup(state);
    const systems = new Set<SystemId>();
    for (const meshId of action.payload) {
      if (!isMeshId(meshId)) continue;
      const entry = lookup.get(parseMeshId(meshId).structureId);
      if (entry && state.content.structures[entry.system] === undefined) {
        systems.add(entry.system);
      }
    }
    for (const system of systems) {
      void listenerApi.dispatch(loadStructures(system));
    }
  },
});
