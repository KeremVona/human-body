import type { AppThunk } from '../../app/store';
import type { SystemId } from '../../data/schema';
import {
  bodyBounds,
  fitDistance,
  presetPose,
  type Pose,
} from '../../scene/camera';
import { suppressSectionPreset } from '../../scene/sectionPlaneStore';
import {
  bundlesRequested,
  selectBundlesForSystem,
} from '../assets/assetsSlice';
import {
  dissectionBaselineSet,
  dissectionRestored,
} from '../dissection/dissectionSlice';
import { sharedPinsLoaded } from '../pins/pinsSlice';
import { waitForBundles } from '../search/revealAndFocus';
import type { SectionAxis } from '../section/sectionPlane';
import { sectionSet } from '../section/sectionSlice';
import { selected, selectionCleared } from '../selection/selectionSlice';
import {
  DEFAULT_OPACITY,
  opacitySet,
  systemsSet,
} from '../systems/systemsSlice';
import type { SharedPin, ViewStateV1 } from './viewState';

const SECTION_AXES: readonly SectionAxis[] = ['axial', 'sagittal', 'coronal'];
const AXIS_TO_INDEX: Record<SectionAxis, 0 | 1 | 2> = {
  axial: 0,
  sagittal: 1,
  coronal: 2,
};

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
      if (opacity !== DEFAULT_OPACITY[id]) {
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
    if (state.section.enabled) {
      view.x = [
        AXIS_TO_INDEX[state.section.axis],
        round3(state.section.t),
        state.section.flip ? 1 : 0,
      ];
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

export type ApplyViewOptions = {
  animate?: boolean;
  keepHistory?: boolean;
  keepPins?: boolean;
};

/** Applies a decoded `ViewStateV1` to systems, bundles, dissection, selection, and camera. */
export function applyViewState(
  view: ViewStateV1,
  opts: ApplyViewOptions = {},
): AppThunk<Promise<void>> {
  return async (dispatch, getState, extra) => {
    dispatch(systemsSet(view.s));

    const allSystems = Object.keys(getState().systems) as SystemId[];
    for (const sys of allSystems) {
      dispatch(
        opacitySet({
          systems: [sys],
          opacity: view.o?.[sys] ?? DEFAULT_OPACITY[sys],
        }),
      );
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
      try {
        await waitForBundles({ getState, subscribe: extra.subscribe }, bundles);
      } catch {
        // Apply remaining applicable state if a bundle load fails or times out
      }
    }

    const snapshot = {
      hidden: [...new Set(view.h)].sort(),
      isolated: view.i ? [...new Set(view.i)].sort() : null,
      faded: view.f ? [...new Set(view.f)].sort() : null,
    };
    dispatch(
      opts.keepHistory
        ? dissectionRestored(snapshot)
        : dissectionBaselineSet(snapshot),
    );

    if (view.sel.length > 0) {
      dispatch(selected(view.sel));
    } else {
      dispatch(selectionCleared());
    }

    if (!opts.keepPins) {
      dispatch(sharedPinsLoaded(view.p ?? []));
    }

    if (view.x) {
      const axis = SECTION_AXES[view.x[0]] ?? 'axial';
      const t = view.x[1];
      const flip = view.x[2] === 1;
      suppressSectionPreset(`true|${axis}|${flip}`);
      dispatch(sectionSet({ enabled: true, axis, t, flip }));
    } else {
      dispatch(sectionSet({ enabled: false }));
    }

    await extra.camera.current?.setPose(
      {
        position: [view.c[0], view.c[1], view.c[2]],
        target: [view.c[3], view.c[4], view.c[5]],
      },
      Boolean(opts.animate),
    );
  };
}
