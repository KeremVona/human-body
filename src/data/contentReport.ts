import {
  isZAnatomySourceUrl,
  type checkContent,
  type LocaleContentInput,
} from './checkContent';
import type { StructureId } from './ids';
import {
  IndexFileSchema,
  StructureFileSchema,
  TaxonomySchema,
  type StructureEntry,
  type SystemId,
} from './schema';
import {
  ToursFileSchema,
  TourTextsFileSchema,
} from '../features/tours/schema';

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

export type LocaleCoverageRow = {
  locale: string;
  namesTranslated: number;
  namesTotal: number;
  featuredTranslated: number;
  featuredTotal: number;
  toursTranslated: number;
  toursTotal: number;
};

/** Summarizes translated index name, featured structure, and tour coverage per locale. */
export function contentLocaleReport(input: {
  index: unknown;
  locales?: Record<string, LocaleContentInput>;
  tours?: unknown;
  tourTexts?: Record<string, unknown>;
}): LocaleCoverageRow[] {
  const enIndex = IndexFileSchema.parse(input.index);
  const locales = input.locales ?? {};
  const featured = enIndex.structures.filter((s) => s.featured);
  const enIds = new Set(enIndex.structures.map((s) => s.id));
  const parsedTours = input.tours ? ToursFileSchema.safeParse(input.tours) : null;
  const tourDefs = parsedTours?.success ? parsedTours.data.tours : [];
  const tourTexts = input.tourTexts ?? {};

  return Object.entries(locales)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([locale, locInput]) => {
      const locIndexRes = IndexFileSchema.safeParse(locInput.index);
      const translatedNameIds = new Set<StructureId>();
      if (locIndexRes.success) {
        for (const s of locIndexRes.data.structures) {
          if (enIds.has(s.id) && s.names.common.trim()) {
            translatedNameIds.add(s.id);
          }
        }
      }

      const locEntriesBySystem = new Map<
        SystemId,
        Map<StructureId, StructureEntry>
      >();
      for (const raw of Object.values(locInput.structureFiles)) {
        const parsed = StructureFileSchema.safeParse(raw);
        if (!parsed.success) continue;
        let map = locEntriesBySystem.get(parsed.data.system);
        if (!map) {
          map = new Map();
          locEntriesBySystem.set(parsed.data.system, map);
        }
        for (const entry of parsed.data.entries) {
          map.set(entry.id, entry);
        }
      }

      let featuredTranslated = 0;
      for (const s of featured) {
        const entry = locEntriesBySystem.get(s.system)?.get(s.id);
        if (!entry) continue;
        const hasOverview = Boolean(entry.overview?.trim());
        const hasFn = Boolean(entry.function?.trim());
        const hasSrc = entry.sources.some(
          (src) => !isZAnatomySourceUrl(src.url),
        );
        const hasDetails =
          (s.kind !== 'muscle' || entry.details?.kind === 'muscle') &&
          (s.kind !== 'bone' || entry.details?.kind === 'bone');
        if (hasOverview && hasFn && hasSrc && hasDetails) {
          featuredTranslated++;
        }
      }

      const rawTourTexts = tourTexts[locale];
      const parsedTourTexts = rawTourTexts
        ? TourTextsFileSchema.safeParse(rawTourTexts)
        : null;
      let toursTranslated = 0;
      if (parsedTourTexts?.success) {
        for (const tour of tourDefs) {
          const entry = parsedTourTexts.data.tours[tour.id];
          const hasTourMeta =
            Boolean(entry?.title?.trim()) && Boolean(entry?.summary?.trim());
          const hasAllSteps = tour.steps.every((step) => {
            const st = entry?.steps?.[step.id];
            return Boolean(st?.title?.trim()) && Boolean(st?.body?.trim());
          });
          if (hasTourMeta && hasAllSteps) {
            toursTranslated++;
          }
        }
      }

      return {
        locale,
        namesTranslated: translatedNameIds.size,
        namesTotal: enIndex.structures.length,
        featuredTranslated,
        featuredTotal: featured.length,
        toursTranslated,
        toursTotal: tourDefs.length,
      };
    });
}
