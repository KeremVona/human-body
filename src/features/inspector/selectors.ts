import { createSelector } from '@reduxjs/toolkit';
import {
  isMeshId,
  parseMeshId,
  type MeshId,
  type StructureId,
} from '../../data/ids';
import type { Details, RegionId, Source, SystemId } from '../../data/schema';
import {
  selectStructureLookup,
  type ContentState,
} from '../content/contentSlice';
import type { SelectionState } from '../selection/selectionSlice';

export type InspectorModel = {
  structureId: StructureId;
  meshIds: MeshId[];
  side: 'Left' | 'Right' | 'Both' | null;
  paired: boolean;
  common: string;
  latin?: string;
  systemId: SystemId;
  systemLabel: string;
  systemColor: string;
  regionId: RegionId;
  regionLabel: string;
  groupLabel?: string;
  overview?: string;
  function?: string;
  details?: Details;
  sources: Source[];
  contentStatus: 'loading' | 'ready';
  notTranslated: boolean;
};

type InspectorSliceInput = {
  content: ContentState;
  selection: SelectionState;
  ui?: { locale: string };
};

/** Derives a single-structure InspectorViewModel from the current selection, or null. */
export const selectInspectorModel = createSelector(
  [
    (state: InspectorSliceInput) => state.selection.selectedIds,
    selectStructureLookup,
    (state: InspectorSliceInput) => state.content.taxonomy,
    (state: InspectorSliceInput) => state.content.structures,
    (state: InspectorSliceInput) => state.content.fallback,
    (state: InspectorSliceInput) =>
      state.ui?.locale ?? state.content.locale ?? 'en',
  ],
  (
    selectedIds,
    lookup,
    taxonomy,
    structures,
    fallback,
    locale,
  ): InspectorModel | null => {
    if (selectedIds.length === 0) return null;

    let structureId: StructureId | null = null;
    let hasLeft = false;
    let hasRight = false;

    for (const meshId of selectedIds) {
      if (!isMeshId(meshId)) return null;
      const parsed = parseMeshId(meshId);
      if (structureId === null) {
        structureId = parsed.structureId;
      } else if (structureId !== parsed.structureId) {
        return null;
      }
      if (parsed.side === 'left') hasLeft = true;
      if (parsed.side === 'right') hasRight = true;
    }

    if (structureId === null) return null;
    const indexEntry = lookup.get(structureId);
    if (!indexEntry) return null;

    let side: InspectorModel['side'] = null;
    if (indexEntry.paired) {
      if (hasLeft && hasRight) side = 'Both';
      else if (hasLeft) side = 'Left';
      else if (hasRight) side = 'Right';
    }

    const sysMeta = taxonomy?.systems.find((s) => s.id === indexEntry.system);
    const regionMeta = taxonomy?.regions.find(
      (r) => r.id === indexEntry.region,
    );
    const systemStructures = structures[indexEntry.system];
    const contentEntry = systemStructures?.entries[structureId];
    const contentStatus: InspectorModel['contentStatus'] =
      systemStructures?.status === 'ready' ? 'ready' : 'loading';
    const indexFallback = fallback?.index?.includes(structureId) ?? false;
    const structuresFallback =
      fallback?.structures?.[indexEntry.system]?.includes(structureId) ?? false;
    const notTranslated =
      locale !== 'en' && (indexFallback || structuresFallback);

    return {
      structureId,
      meshIds: [...selectedIds],
      side,
      paired: indexEntry.paired,
      common: indexEntry.names.common,
      latin: indexEntry.names.latin,
      systemId: indexEntry.system,
      systemLabel: sysMeta?.label ?? indexEntry.system,
      systemColor: sysMeta?.color ?? '#94A3B8',
      regionId: indexEntry.region,
      regionLabel: regionMeta?.label ?? indexEntry.region,
      groupLabel: indexEntry.group,
      overview: contentEntry?.overview,
      function: contentEntry?.function,
      details: contentEntry?.details,
      sources: contentEntry?.sources ?? [],
      contentStatus,
      notTranslated,
    };
  },
);
