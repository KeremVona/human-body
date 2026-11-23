import { isZAnatomySourceUrl, type checkContent } from './checkContent';
import type { StructureId } from './ids';
import {
  IndexFileSchema,
  StructureFileSchema,
  TaxonomySchema,
  type StructureEntry,
  type SystemId,
} from './schema';

export type ContentReportRow = {
  system: SystemId;
  structures: number;
  featured: number;
  featuredComplete: number;
  missingLatin: number;
  gaps: { id: StructureId; missing: string[] }[];
};

/** Summarizes per-system structure counts, Latin name coverage, and featured completeness gaps. */
export function contentReport(
  input: Parameters<typeof checkContent>[0],
): ContentReportRow[] {
  const taxonomy = TaxonomySchema.parse(input.taxonomy);
  const index = IndexFileSchema.parse(input.index);

  const entriesBySystem = new Map<SystemId, Map<StructureId, StructureEntry>>();
  for (const raw of Object.values(input.structureFiles)) {
    const parsed = StructureFileSchema.safeParse(raw);
    if (!parsed.success) continue;
    let map = entriesBySystem.get(parsed.data.system);
    if (!map) {
      map = new Map();
      entriesBySystem.set(parsed.data.system, map);
    }
    for (const entry of parsed.data.entries) {
      map.set(entry.id, entry);
    }
  }

  const orderedSystems = [...taxonomy.systems]
    .sort((a, b) => a.order - b.order)
    .map((s) => s.id);

  const rows = new Map<SystemId, ContentReportRow>();
  for (const system of orderedSystems) {
    rows.set(system, {
      system,
      structures: 0,
      featured: 0,
      featuredComplete: 0,
      missingLatin: 0,
      gaps: [],
    });
  }

  for (const structure of index.structures) {
    const row = rows.get(structure.system);
    if (!row) continue;

    row.structures++;
    const hasLatin = Boolean(structure.names.latin?.trim());
    if (!hasLatin) {
      row.missingLatin++;
    }

    if (!structure.featured) continue;
    row.featured++;

    const missing: string[] = [];
    if (!hasLatin) {
      missing.push('latin');
    }

    const entry = entriesBySystem.get(structure.system)?.get(structure.id);
    if (!entry?.overview?.trim()) {
      missing.push('overview');
    }
    if (!entry?.function?.trim()) {
      missing.push('function');
    }
    if (
      (structure.kind === 'muscle' && entry?.details?.kind !== 'muscle') ||
      (structure.kind === 'bone' && entry?.details?.kind !== 'bone')
    ) {
      missing.push('details');
    }
    if (!entry || !entry.sources.some((s) => !isZAnatomySourceUrl(s.url))) {
      missing.push('source');
    }

    if (missing.length === 0) {
      row.featuredComplete++;
    } else {
      row.gaps.push({ id: structure.id, missing });
    }
  }

  return orderedSystems.map((id) => rows.get(id)!);
}
