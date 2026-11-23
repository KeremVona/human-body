import { createSelector } from '@reduxjs/toolkit';
import type { SystemId } from '../../data/schema';
import {
  selectBundlesForSystem,
  type AssetsState,
} from '../assets/assetsSlice';
import type { BundleStatus } from '../assets/scheduler';
import type { ContentState } from '../content/contentSlice';
import type { SystemsState } from './systemsSlice';

export type ToggleRow = {
  id: string;
  label: string;
  color: string;
  systems: SystemId[];
  on: boolean | 'mixed';
  opacity: number;
  status: BundleStatus;
};

type ToggleRowState = {
  assets: AssetsState;
  content: ContentState;
  systems: SystemsState;
};

const STATUS_PRIORITY: Record<BundleStatus, number> = {
  ready: 0,
  idle: 1,
  loading: 2,
  error: 3,
};

function aggregateBundleStatus(
  state: ToggleRowState,
  systems: SystemId[],
): BundleStatus {
  if (!state.assets.manifest) return 'idle';
  const bundleIds = new Set<string>();
  for (const sys of systems) {
    for (const id of selectBundlesForSystem(state, sys)) {
      bundleIds.add(id);
    }
  }
  if (bundleIds.size === 0) return 'ready';

  let worst: BundleStatus = 'ready';
  for (const id of bundleIds) {
    const status = state.assets.bundles[id] ?? 'idle';
    if (STATUS_PRIORITY[status] > STATUS_PRIORITY[worst]) {
      worst = status;
    }
  }
  return worst;
}

/** Memoised sidebar toggle rows ordered by taxonomy, aggregating uiGroups cleanly. */
export const selectToggleRows = createSelector(
  [
    (state: ToggleRowState) => state.content.taxonomy,
    (state: ToggleRowState) => state.content.index,
    (state: ToggleRowState) => state.systems,
    (state: ToggleRowState) => state.assets,
  ],
  (taxonomy, index, systemsState, assets): ToggleRow[] => {
    if (!taxonomy || !index) return [];

    const activeSystems = new Set<SystemId>(
      index.structures.map((entry) => entry.system),
    );
    const systemMeta = new Map(taxonomy.systems.map((s) => [s.id, s]));
    const groupedSystems = new Set<SystemId>();
    const fullState: ToggleRowState = {
      assets,
      content: { taxonomy, index, structures: {} },
      systems: systemsState,
    };

    const buildRow = (
      id: string,
      label: string,
      candidateSystems: SystemId[],
    ): ToggleRow | null => {
      const systems = candidateSystems
        .filter((s) => activeSystems.has(s))
        .sort(
          (a, b) =>
            (systemMeta.get(a)?.order ?? Number.MAX_SAFE_INTEGER) -
            (systemMeta.get(b)?.order ?? Number.MAX_SAFE_INTEGER),
        );
      if (systems.length === 0) return null;

      const enabledCount = systems.filter(
        (s) => systemsState[s].enabled,
      ).length;
      const on: boolean | 'mixed' =
        enabledCount === 0
          ? false
          : enabledCount === systems.length
            ? true
            : 'mixed';

      return {
        id,
        label,
        color: systemMeta.get(systems[0])?.color ?? '#94A3B8',
        systems,
        on,
        opacity: Math.max(...systems.map((s) => systemsState[s].opacity)),
        status: aggregateBundleStatus(fullState, systems),
      };
    };

    const rows: ToggleRow[] = [];
    for (const group of taxonomy.uiGroups) {
      for (const sys of group.systems) {
        groupedSystems.add(sys);
      }
      const row = buildRow(group.id, group.label, group.systems);
      if (row) rows.push(row);
    }

    for (const sys of taxonomy.systems) {
      if (groupedSystems.has(sys.id)) continue;
      const row = buildRow(sys.id, sys.label, [sys.id]);
      if (row) rows.push(row);
    }

    return rows.sort(
      (a, b) =>
        (systemMeta.get(a.systems[0])?.order ?? Number.MAX_SAFE_INTEGER) -
        (systemMeta.get(b.systems[0])?.order ?? Number.MAX_SAFE_INTEGER),
    );
  },
);
