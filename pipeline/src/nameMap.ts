import { isMeshId, toMeshId, type MeshId, type Side } from '../../src/data/ids';

/** Mapping from Blender source object name to stable MeshId. */
export type NameMap = Record<string, MeshId>;

/** Proposes a stable MeshId from a source object name and flags ambiguous names for review. */
export function proposeMeshId(sourceName: string): {
  meshId: MeshId | null;
  needsReview: boolean;
} {
  let needsReview = /\.\d{3}$/.test(sourceName);
  let base = sourceName.replace(/\.\d{3}$/, '');

  let side: Side = null;
  const sideMatch = base.match(/[._\s](l|r|left|right)$/i);
  if (sideMatch && sideMatch.index !== undefined) {
    side = sideMatch[1].toLowerCase().startsWith('l') ? 'left' : 'right';
    base = base.slice(0, sideMatch.index);
  }

  if (/[^\p{L}0-9 -]/u.test(base)) {
    needsReview = true;
  }

  const kebab = base
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!kebab) {
    return { meshId: null, needsReview };
  }

  const meshId = toMeshId(kebab, side);
  if (!isMeshId(meshId)) {
    return { meshId: null, needsReview: true };
  }

  return { meshId, needsReview };
}

/** Merges new source names into an existing NameMap without altering existing entries. */
export function updateNameMap(
  existing: NameMap,
  sourceNames: string[],
): { map: NameMap; added: string[]; needsReview: string[] } {
  const next: NameMap = { ...existing };
  const added: string[] = [];
  const needsReview: string[] = [];
  const seen = new Set<string>();

  for (const name of sourceNames) {
    if (seen.has(name)) continue;
    seen.add(name);
    if (Object.hasOwn(existing, name)) continue;

    const proposal = proposeMeshId(name);
    if (proposal.needsReview || proposal.meshId === null) {
      needsReview.push(name);
    }
    if (proposal.meshId !== null) {
      next[name] = proposal.meshId;
      added.push(name);
    }
  }

  const sorted: NameMap = {};
  for (const key of Object.keys(next).sort()) {
    sorted[key] = next[key];
  }

  return { map: sorted, added, needsReview };
}
