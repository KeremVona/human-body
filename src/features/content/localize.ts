import type { StructureId } from '../../data/ids';
import type {
  Details,
  IndexEntry,
  IndexFile,
  StructureEntry,
  StructureFile,
} from '../../data/schema';

export type LocalizedResult<T> = {
  file: T;
  fallbackIds: ReadonlySet<StructureId>;
};

/**
 * Overlays localized names from `loc` onto `en` while preserving all
 * non-localized structural attributes (`id`, `system`, `region`, `group`,
 * `paired`, `kind`, `tissue`, `color`, `featured`) from `en`.
 */
export function localizeIndex(
  en: IndexFile,
  loc: IndexFile | null,
): LocalizedResult<IndexFile> {
  const fallbackIds = new Set<StructureId>();
  if (!loc) {
    for (const s of en.structures) {
      fallbackIds.add(s.id);
    }
    return { file: en, fallbackIds };
  }

  const byId = new Map<StructureId, IndexEntry>();
  for (const entry of loc.structures) {
    byId.set(entry.id, entry);
  }

  const structures: IndexEntry[] = en.structures.map((enEntry) => {
    const locEntry = byId.get(enEntry.id);
    if (!locEntry) {
      fallbackIds.add(enEntry.id);
      return enEntry;
    }
    return {
      ...enEntry,
      names: {
        common: locEntry.names.common,
        ...((locEntry.names.latin ?? enEntry.names.latin)
          ? { latin: locEntry.names.latin ?? enEntry.names.latin }
          : {}),
        synonyms: locEntry.names.synonyms,
      },
    };
  });

  return {
    file: { locale: loc.locale, structures },
    fallbackIds,
  };
}

function mergeDetails(
  enDetails: Details | undefined,
  locDetails: Details | undefined,
): { details: Details | undefined; fellBack: boolean } {
  if (!enDetails) {
    return { details: locDetails, fellBack: false };
  }
  if (!locDetails || locDetails.kind !== enDetails.kind) {
    return { details: enDetails, fellBack: true };
  }
  if (enDetails.kind === 'muscle' && locDetails.kind === 'muscle') {
    return {
      details: {
        kind: 'muscle',
        origin: locDetails.origin || enDetails.origin,
        insertion: locDetails.insertion || enDetails.insertion,
        innervation: locDetails.innervation || enDetails.innervation,
        bloodSupply: locDetails.bloodSupply || enDetails.bloodSupply,
        action: locDetails.action || enDetails.action,
      },
      fellBack: false,
    };
  }
  if (enDetails.kind === 'bone' && locDetails.kind === 'bone') {
    return {
      details: {
        kind: 'bone',
        boneType: locDetails.boneType,
        articulatesWith: enDetails.articulatesWith,
      },
      fellBack: false,
    };
  }
  if (enDetails.kind === 'facts' && locDetails.kind === 'facts') {
    const hasFacts = locDetails.facts.length > 0;
    return {
      details: hasFacts ? locDetails : enDetails,
      fellBack: !hasFacts,
    };
  }
  return { details: enDetails, fellBack: true };
}

/**
 * Merges localized structure entries from `loc` over `en` field by field
 * (`overview`, `function`, `details`, `sources`). Records every structure ID
 * where any present English field fell back to English.
 */
export function localizeStructures(
  en: StructureFile | null,
  loc: StructureFile | null,
): LocalizedResult<StructureFile | null> {
  const fallbackIds = new Set<StructureId>();
  if (!en) {
    return { file: null, fallbackIds };
  }
  if (!loc || loc.system !== en.system) {
    for (const entry of en.entries) {
      fallbackIds.add(entry.id);
    }
    return { file: en, fallbackIds };
  }

  const byId = new Map<StructureId, StructureEntry>();
  for (const entry of loc.entries) {
    byId.set(entry.id, entry);
  }

  const entries: StructureEntry[] = en.entries.map((enEntry) => {
    const locEntry = byId.get(enEntry.id);
    if (!locEntry) {
      fallbackIds.add(enEntry.id);
      return enEntry;
    }

    let fellBack = false;
    const overview = locEntry.overview ?? enEntry.overview;
    if (enEntry.overview !== undefined && locEntry.overview === undefined) {
      fellBack = true;
    }
    const fn = locEntry.function ?? enEntry.function;
    if (enEntry.function !== undefined && locEntry.function === undefined) {
      fellBack = true;
    }
    const mergedDetails = mergeDetails(enEntry.details, locEntry.details);
    if (mergedDetails.fellBack) {
      fellBack = true;
    }
    const sources =
      locEntry.sources.length > 0 ? locEntry.sources : enEntry.sources;
    if (enEntry.sources.length > 0 && locEntry.sources.length === 0) {
      fellBack = true;
    }

    if (fellBack) {
      fallbackIds.add(enEntry.id);
    }

    return {
      id: enEntry.id,
      ...(overview !== undefined ? { overview } : {}),
      ...(fn !== undefined ? { function: fn } : {}),
      ...(mergedDetails.details !== undefined
        ? { details: mergedDetails.details }
        : {}),
      sources,
    };
  });

  return {
    file: { system: en.system, entries },
    fallbackIds,
  };
}
