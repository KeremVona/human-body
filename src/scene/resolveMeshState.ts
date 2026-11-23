import { createSelector, lruMemoize } from '@reduxjs/toolkit';
import { isMeshId, parseMeshId, type MeshId } from '../data/ids';
import {
  selectStructureLookup,
  type ContentState,
} from '../features/content/contentSlice';
import type {
  DissectionSnapshot,
  DissectionState,
} from '../features/dissection/dissectionSlice';
import type { SelectionState } from '../features/selection/selectionSlice';
import type { SystemsState } from '../features/systems/systemsSlice';

/** Resolved per-mesh visibility, opacity, highlight, and picking state. */
export type MeshState = {
  visible: boolean;
  opacity: number;
  ghost: boolean;
  highlight: 'none' | 'hovered' | 'selected';
  pickable: boolean;
};

export type ResolveMeshStateInput = {
  meshId: MeshId;
  systemEnabled: boolean;
  systemOpacity: number;
  dissection: DissectionSnapshot & { fadeOpacity: number };
  selectedIds: MeshId[];
  hoveredId: MeshId | null;
};

type CompiledDissectionSets = {
  hidden: Set<MeshId>;
  isolated: Set<MeshId> | null;
  faded: Set<MeshId> | null;
  fadeOpacity: number;
  selected: Set<MeshId>;
  hoveredId: MeshId | null;
};

function resolveWithSets(
  meshId: MeshId,
  systemEnabled: boolean,
  systemOpacity: number,
  sets: CompiledDissectionSets,
): MeshState {
  const visible =
    systemEnabled &&
    systemOpacity > 0 &&
    !sets.hidden.has(meshId) &&
    (sets.isolated === null || sets.isolated.has(meshId));

  const ghost = sets.faded !== null && !sets.faded.has(meshId);
  const opacity = ghost ? sets.fadeOpacity : systemOpacity;

  let highlight: MeshState['highlight'] = 'none';
  if (visible) {
    if (sets.selected.has(meshId)) {
      highlight = 'selected';
    } else if (sets.hoveredId === meshId) {
      highlight = 'hovered';
    }
  }

  return {
    visible,
    opacity,
    ghost,
    highlight,
    pickable: visible && opacity >= 0.5,
  };
}

/** Resolves effective visibility, opacity, highlight, and pickability for a single mesh per §6.3. */
export function resolveMeshState({
  meshId,
  systemEnabled,
  systemOpacity,
  dissection,
  selectedIds,
  hoveredId,
}: ResolveMeshStateInput): MeshState {
  return resolveWithSets(meshId, systemEnabled, systemOpacity, {
    hidden: new Set(dissection.hidden),
    isolated: dissection.isolated ? new Set(dissection.isolated) : null,
    faded: dissection.faded ? new Set(dissection.faded) : null,
    fadeOpacity: dissection.fadeOpacity,
    selected: new Set(selectedIds),
    hoveredId,
  });
}

type ResolvedStateSlice = {
  content: ContentState;
  systems: SystemsState;
  dissection: DissectionState;
  selection: SelectionState;
};

const selectDissectionSets = createSelector(
  [
    (state: ResolvedStateSlice) => state.dissection,
    (state: ResolvedStateSlice) => state.selection.selectedIds,
    (state: ResolvedStateSlice) => state.selection.hoveredId,
  ],
  (dissection, selectedIds, hoveredId): CompiledDissectionSets => ({
    hidden: new Set(dissection.hidden),
    isolated: dissection.isolated ? new Set(dissection.isolated) : null,
    faded: dissection.faded ? new Set(dissection.faded) : null,
    fadeOpacity: dissection.fadeOpacity,
    selected: new Set(selectedIds),
    hoveredId,
  }),
);

function sameRefOrArray(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** Memoised selector returning resolved MeshState entries for all supplied MeshIds. */
export const selectResolvedMeshStates = createSelector(
  [
    selectStructureLookup,
    (state: ResolvedStateSlice) => state.systems,
    selectDissectionSets,
    (_state: ResolvedStateSlice, meshIds: readonly MeshId[]) => meshIds,
  ],
  (lookup, systems, sets, meshIds): Map<MeshId, MeshState> => {
    const out = new Map<MeshId, MeshState>();
    for (const meshId of meshIds) {
      const entry = isMeshId(meshId)
        ? lookup.get(parseMeshId(meshId).structureId)
        : undefined;
      const sys = entry ? systems[entry.system] : undefined;
      const systemEnabled = sys?.enabled ?? false;
      const systemOpacity = sys?.opacity ?? 1;
      out.set(
        meshId,
        resolveWithSets(meshId, systemEnabled, systemOpacity, sets),
      );
    }
    return out;
  },
  {
    memoize: lruMemoize,
    memoizeOptions: { equalityCheck: sameRefOrArray },
  },
);
