import type { AppThunk } from '../../app/store';
import type { SystemId } from '../../data/schema';
import {
  bodyBounds,
  fitDistance,
  presetPose,
  type Pose,
} from '../../scene/camera';
import {
  bundlesRequested,
  selectBundlesForSystem,
} from '../assets/assetsSlice';
import { dissectionBaselineSet } from '../dissection/dissectionSlice';
import { sharedPinsLoaded } from '../pins/pinsSlice';
import { waitForBundles } from '../search/revealAndFocus';
import { selected, selectionCleared } from '../selection/selectionSlice';
import { opacitySet, systemsSet } from '../systems/systemsSlice';
import type { SharedPin, ViewStateV1 } from './viewState';

function round3(n: number): number {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
}

function defaultAnteriorPose(
  manifest: Parameters<typeof bodyBounds>[0] | null,
): Pose {
  if (!manifest) {
    return { position: [0, 0, 3.2], target: [0, 0, 0] };
  }
  const body = bodyBounds(manifest);
  const dist = fitDistance(body, 35, 16 / 9);
  return presetPose('anterior', body, dist);
}

/** Captures the current view (camera, enabled systems, non-default opacities, dissection, selection, optional own pins). */
export function captureViewState(opts: {
  includePins: boolean;
}): AppThunk<ViewStateV1> {
  return (_dispatch, getState, extra) => {
    const state = getState();
    const pose =
      extra.camera.current?.getPose() ??
      defaultAnteriorPose(state.assets.manifest);

    const enabledSystems = (Object.keys(state.systems) as SystemId[])
      .filter((id) => state.systems[id].enabled)
      .sort();

    const opacities: Partial<Record<SystemId, number>> = {};
    for (const id of (Object.keys(state.systems) as SystemId[]).sort()) {
      const opacity = state.systems[id].opacity;
      if (opacity !== 1) {
        opacities[id] = opacity;
      }
    }

    const view: ViewStateV1 = {
      c: [
        round3(pose.position[0]),
        round3(pose.position[1]),
        round3(pose.position[2]),
        round3(pose.target[0]),
        round3(pose.target[1]),
        round3(pose.target[2]),
      ],
      s: enabledSystems,
      h: [...state.dissection.hidden].sort(),
      sel: [...state.selection.selectedIds].sort(),
    };

    if (Object.keys(opacities).length > 0) {
      view.o = opacities;
    }
    if (state.dissection.isolated !== null) {
      view.i = [...state.dissection.isolated].sort();
    }
    if (state.dissection.faded !== null) {
      view.f = [...state.dissection.faded].sort();
    }
    if (opts.includePins) {
      const ownPins: SharedPin[] = state.pins.items
        .filter((p) => !p.shared)
        .map((p) => ({
          m: p.meshId,
          l: [round3(p.local[0]), round3(p.local[1]), round3(p.local[2])],
          t: p.label,
          ...(p.note ? { n: p.note } : {}),
        }));
      if (ownPins.length > 0) {
        view.p = ownPins;
      }
    }

    return view;
  };
}

/** Applies a decoded `ViewStateV1` to systems, bundles, dissection (clearing undo), selection, and camera. */
export function applyViewState(view: ViewStateV1): AppThunk<Promise<void>> {
  return async (dispatch, getState, extra) => {
    dispatch(systemsSet(view.s));

    const allSystems = Object.keys(getState().systems) as SystemId[];
    for (const sys of allSystems) {
      dispatch(opacitySet({ systems: [sys], opacity: view.o?.[sys] ?? 1 }));
    }

    const bundleSet = new Set<string>();
    const afterSystems = getState();
    for (const sys of view.s) {
      for (const bundleId of selectBundlesForSystem(afterSystems, sys)) {
        bundleSet.add(bundleId);
      }
    }
    const bundles = [...bundleSet];
    if (bundles.length > 0) {
      dispatch(bundlesRequested(bundles));
      await waitForBundles({ getState, subscribe: extra.subscribe }, bundles);
    }

    dispatch(
      dissectionBaselineSet({
        hidden: view.h,
        isolated: view.i ?? null,
        faded: view.f ?? null,
      }),
    );

    if (view.sel.length > 0) {
      dispatch(selected(view.sel));
    } else {
      dispatch(selectionCleared());
    }

    dispatch(sharedPinsLoaded(view.p ?? []));

    await extra.camera.current?.setPose(
      {
        position: [view.c[0], view.c[1], view.c[2]],
        target: [view.c[3], view.c[4], view.c[5]],
      },
      false,
    );
  };
}
