import MiniSearch from 'minisearch';
import type { StructureId } from '../../data/ids';
import type { IndexFile, SystemId } from '../../data/schema';

export type SearchHit = {
  structureId: StructureId;
  common: string;
  latin?: string;
  system: SystemId;
};

type SearchDoc = {
  id: StructureId;
  common: string;
  latin: string;
  synonyms: string;
  system: SystemId;
  hasLatin: boolean;
};

function stripDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function processTerm(term: string): string | null {
  const cleaned = stripDiacritics(term)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}-]+/gu, '');
  return cleaned.length > 0 ? cleaned : null;
}

/** Builds an in-memory MiniSearch index over common, Latin, and lay synonym names. */
export function buildSearchIndex(index: IndexFile): {
  search(q: string, limit?: number): SearchHit[];
} {
  const docs: SearchDoc[] = index.structures.map((s) => ({
    id: s.id,
    common: s.names.common,
    latin: s.names.latin ?? '',
    synonyms: s.names.synonyms.join(' '),
    system: s.system,
    hasLatin: s.names.latin !== undefined,
  }));

  const byId = new Map(docs.map((d) => [d.id, d]));

  const mini = new MiniSearch<SearchDoc>({
    fields: ['common', 'latin', 'synonyms'],
    storeFields: ['common', 'system'],
    processTerm,
    searchOptions: {
      prefix: true,
      fuzzy: (term) => (term.length > 3 ? 0.2 : false),
      boost: { common: 3, latin: 2, synonyms: 1.5 },
    },
  });

  mini.addAll(docs);

  return {
    search(q: string, limit = 8): SearchHit[] {
      const trimmed = q.trim();
      if (!trimmed || limit <= 0) return [];
      try {
        const raw = mini.search(trimmed);
        const hits: SearchHit[] = [];
        const seen = new Set<StructureId>();
        for (const r of raw) {
          const id = r.id as StructureId;
          if (seen.has(id)) continue;
          const doc = byId.get(id);
          if (!doc) continue;
          seen.add(id);
          hits.push({
            structureId: doc.id,
            common: doc.common,
            ...(doc.hasLatin ? { latin: doc.latin } : {}),
            system: doc.system,
          });
          if (hits.length >= limit) break;
        }
        return hits;
      } catch {
        return [];
      }
    },
  };
}
