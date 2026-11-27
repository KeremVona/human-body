import { createSelector } from '@reduxjs/toolkit';
import { isMeshId, parseMeshId, type MeshId } from '../../data/ids';
import type { IndexFile, Manifest } from '../../data/schema';
import type { JourneyState } from './journeySlice';
import { getRoute, localProgress } from './route';
import type { Journey, JourneyId } from './schema';

export type JourneyOverrides = {
  ghost: ReadonlySet<MeshId>;
  active: ReadonlySet<MeshId>;
};

const EMPTY_SET: ReadonlySet<MeshId> = new Set();
const EMPTY_OVERRIDES: JourneyOverrides = {
  ghost: EMPTY_SET,
  active: EMPTY_SET,
};

const SECRETE_WINDOW_S = 1.2;

function clamp01(u: number): number {
  if (!Number.isFinite(u)) return 0;
  return Math.min(1, Math.max(0, u));
}

type OverrideSelectorInput = {
  journey?: JourneyState;
  assets?: { manifest: Manifest | null };
  content?: { index: IndexFile | null };
};

/** Returns sorted open secrete-event meshes joined as a stable cache key so steady frames do not churn overrides. */
function selectOpenSecreteKey(state: OverrideSelectorInput): string {
  const j = state.journey;
  if (!j?.activeId || !j.defs) return '';
  const def = j.defs.find((d) => d.id === j.activeId);
  const stage = def?.stages[j.stageIndex];
  if (!def || !stage?.events?.length) return '';

  const manifest = state.assets?.manifest ?? null;
  const centerlines = j.centerlines;
  const localP =
    centerlines && manifest
      ? localProgress(
          getRoute(def, centerlines.lines, manifest.meshes),
          j.stageIndex,
          j.progress,
        )
      : clamp01(j.progress);

  const open: MeshId[] = [];
  for (const ev of stage.events) {
    const windowEnd = ev.at + SECRETE_WINDOW_S / stage.durationS;
    if (localP >= ev.at && localP <= windowEnd) {
      open.push(ev.mesh);
    }
  }
  return open.length > 0 ? open.sort().join('|') : '';
}

/** Memoized selector returning active organs (+open secrete helpers) and ghosted tract organs. */
export const selectJourneyOverrides = createSelector(
  [
    (state: OverrideSelectorInput) => state.journey?.defs ?? null,
    (state: OverrideSelectorInput) => state.journey?.activeId ?? null,
    (state: OverrideSelectorInput) => state.journey?.stageIndex ?? 0,
    selectOpenSecreteKey,
    (state: OverrideSelectorInput) => state.assets?.manifest ?? null,
    (state: OverrideSelectorInput) => state.content?.index ?? null,
  ],
  (
    defs: Journey[] | null,
    activeId: JourneyId | null,
    stageIndex: number,
    openEventKey: string,
    manifest: Manifest | null,
    index: IndexFile | null,
  ): JourneyOverrides => {
    if (!defs || !activeId) return EMPTY_OVERRIDES;
    const def = defs.find((d) => d.id === activeId);
    const stage = def?.stages[stageIndex];
    if (!def || !stage) return EMPTY_OVERRIDES;

    const active = new Set<MeshId>(stage.organs);
    if (openEventKey.length > 0) {
      for (const meshId of openEventKey.split('|')) {
        if (isMeshId(meshId)) {
          active.add(meshId);
        }
      }
    }

    const indexMap = index
      ? new Map(index.structures.map((item) => [item.id, item.system]))
      : null;
    const systemFilter =
      indexMap && def.systems.length > 0 ? new Set(def.systems) : null;

    const ghost = new Set<MeshId>();
    for (const s of def.stages) {
      for (const meshId of s.organs) {
        if (active.has(meshId)) continue;
        if (manifest && !Object.hasOwn(manifest.meshes, meshId)) continue;
        if (systemFilter && indexMap) {
          const sys = indexMap.get(parseMeshId(meshId).structureId);
          if (!sys || !systemFilter.has(sys)) continue;
        }
        ghost.add(meshId);
      }
    }

    return { active, ghost };
  },
);
