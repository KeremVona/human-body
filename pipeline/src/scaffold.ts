import type { IndexEntry, IndexFile } from '../../src/data/schema';
import type { StructureStub } from './resolvePlan';

function compareAscii(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Appends missing structure stubs to an existing index file without modifying existing entries. */
export function scaffoldIndex(
  existing: IndexFile,
  stubs: StructureStub[],
): IndexFile {
  const byId = new Map<string, IndexEntry>();
  for (const entry of existing.structures) {
    byId.set(entry.id, entry);
  }

  for (const stub of stubs) {
    if (byId.has(stub.id)) continue;
    byId.set(stub.id, {
      id: stub.id,
      system: stub.system,
      region: stub.region,
      paired: stub.paired,
      kind: stub.kind,
      tissue: stub.tissue,
      ...(stub.color !== undefined ? { color: stub.color } : {}),
      names: { common: stub.displayName, synonyms: [] },
      featured: false,
    });
  }

  const structures = [...byId.values()].sort((a, b) =>
    compareAscii(a.id, b.id),
  );

  return {
    locale: existing.locale,
    structures,
  };
}
