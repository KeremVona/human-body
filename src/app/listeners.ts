import { useGLTF } from '@react-three/drei';
import { createListenerMiddleware } from '@reduxjs/toolkit';
import { parseMeshId } from '../data/ids';
import { bundleUrl } from '../data/manifest';
import type { SystemId } from '../data/schema';
import {
  bundleReady,
  bundleRetry,
  type AssetsState,
} from '../features/assets/assetsSlice';
import {
  loadStructures,
  selectStructureLookup,
  type ContentState,
} from '../features/content/contentSlice';

type ListenerState = {
  assets: AssetsState;
  content: ContentState;
};

/** App-wide Redux listener middleware for bundle cache clearing and lazy structure loading. */
export const listenerMiddleware = createListenerMiddleware<ListenerState>();

listenerMiddleware.startListening({
  actionCreator: bundleRetry,
  effect: (action, listenerApi) => {
    const manifest = listenerApi.getState().assets.manifest;
    const bundle = manifest?.bundles.find((b) => b.id === action.payload.id);
    if (bundle) {
      useGLTF.clear(bundleUrl(bundle.file));
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
