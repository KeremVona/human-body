import { isMeshId, parseMeshId, type MeshId } from '../../data/ids';
import type { IndexFile, Manifest, SystemId } from '../../data/schema';

function compareAscii(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Builds a sorted quiz pool of medium/large meshes belonging to featured structures in enabled systems. */
export function buildQuizPool(
  index: IndexFile,
  manifest: Manifest,
  enabled: (s: SystemId) => boolean,
): MeshId[] {
  const byId = new Map(index.structures.map((s) => [s.id, s]));
  const pool: MeshId[] = [];

  for (const [id, meta] of Object.entries(manifest.meshes)) {
    if (!isMeshId(id)) continue;
    if (meta.sizeClass !== 'medium' && meta.sizeClass !== 'large') continue;
    const { structureId } = parseMeshId(id);
    const entry = byId.get(structureId);
    if (!entry || !entry.featured || !enabled(entry.system)) continue;
    pool.push(id);
  }

  return pool.sort(compareAscii);
}
