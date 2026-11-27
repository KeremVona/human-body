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
  reloadLocaleContent,
  selectStructureLookup,
  type ContentState,
} from '../features/content/contentSlice';
import { localeSet, type UiState } from '../features/settings/uiSlice';
import {
  motionStopped,
  type MotionState,
} from '../features/motion/motionSlice';
import {
  pinsHydrated,
  sharedPinsLoaded,
  storageFailed,
  storageNoticeShown,
  type PinsState,
} from '../features/pins/pinsSlice';
import { savePins } from '../features/pins/storage';
import { quizStarted } from '../features/quiz/quizSlice';
import { selected } from '../features/selection/selectionSlice';
import {
  systemsSet,
  systemToggled,
  uiGroupToggled,
  type SystemsState,
} from '../features/systems/systemsSlice';
import type { TourState } from '../features/tours/tourSlice';
import type { JourneyState } from '../features/journey/journeySlice';
import { clearGltf } from '../scene/gltfCache';

type ListenerState = {
  assets: AssetsState;
  content: ContentState;
  systems: SystemsState;
  pins: PinsState;
  motion: MotionState;
  tour?: TourState;
  journey?: JourneyState;
  ui?: UiState;
};

/** App-wide Redux listener middleware for bundle cache clearing and lazy structure loading. */
export const listenerMiddleware = createListenerMiddleware<ListenerState>();

listenerMiddleware.startListening({
  actionCreator: localeSet,
  effect: (action, listenerApi) => {
    const state = listenerApi.getState();
    if (state.content.index) {
      void listenerApi.dispatch(reloadLocaleContent(action.payload));
    }
    if (state.tour?.defs !== null && state.tour?.defs !== undefined) {
      void import('../features/tours/thunks').then(({ reloadTourTexts }) =>
        listenerApi.dispatch(reloadTourTexts(action.payload)),
      );
    }
    if (state.journey?.defs !== null && state.journey?.defs !== undefined) {
      void import('../features/journey/thunks').then(({ reloadJourneyTexts }) =>
        listenerApi.dispatch(reloadJourneyTexts(action.payload)),
      );
    }
  },
});

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
  matcher: isAnyOf(systemToggled, uiGroupToggled, systemsSet),
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

listenerMiddleware.startListening({
  predicate: (action) =>
    typeof action.type === 'string' &&
    action.type.startsWith('pins/') &&
    !storageFailed.match(action) &&
    !storageNoticeShown.match(action) &&
    !pinsHydrated.match(action) &&
    !sharedPinsLoaded.match(action),
  effect: (_action, listenerApi) => {
    const state = listenerApi.getState();
    const ok = savePins(state.pins.items);
    if (!ok && !state.pins.storageFailed) {
      listenerApi.dispatch(storageFailed());
    }
  },
});

listenerMiddleware.startListening({
  actionCreator: quizStarted,
  effect: (_action, listenerApi) => {
    if (listenerApi.getState().motion.activeId !== null) {
      listenerApi.dispatch(motionStopped());
    }
  },
});

listenerMiddleware.startListening({
  matcher: isAnyOf(systemToggled, uiGroupToggled, systemsSet),
  effect: (_action, listenerApi) => {
    const state = listenerApi.getState();
    const { activeId, defs } = state.motion;
    if (!activeId) return;
    const def = defs?.find((d) => d.id === activeId);
    if (!def) return;
    if (def.systems.some((sys) => !state.systems[sys].enabled)) {
      listenerApi.dispatch(motionStopped());
    }
  },
});

listenerMiddleware.startListening({
  actionCreator: bundleRetry,
  effect: (action, listenerApi) => {
    const state = listenerApi.getState();
    const { activeId, defs } = state.motion;
    if (!activeId) return;
    const def = defs?.find((d) => d.id === activeId);
    if (!def) return;
    const moving = new Set<string>(
      def.kind === 'hinge'
        ? def.moving
        : def.kind === 'breath'
          ? [
              ...def.expand.flatMap((g) => g.meshes),
              ...(def.shift ?? []).flatMap((s) => s.meshes),
            ]
          : def.groups.flatMap((group) => group.meshes),
    );
    if (action.payload.meshIds.some((id) => moving.has(id))) {
      listenerApi.dispatch(motionStopped());
    }
  },
});
