/** Lowercase kebab-case ASCII identifier for an anatomical structure. */
export type StructureId = string;

/** StructureId with an optional `--l` or `--r` lateral suffix matching the GLB node name. */
export type MeshId = string;

/** Anatomical lateral side, or null for unpaired/midline structures. */
export type Side = 'left' | 'right' | null;

/** Pattern matching a valid StructureId (lowercase kebab-case ASCII). */
export const STRUCTURE_ID_RE: RegExp = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Pattern matching a valid MeshId (StructureId with optional `--l` or `--r` suffix). */
export const MESH_ID_RE: RegExp = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[lr])?$/;

/** Returns true when `s` is a valid StructureId. */
export function isStructureId(s: string): boolean {
  return STRUCTURE_ID_RE.test(s);
}

/** Returns true when `s` is a valid MeshId. */
export function isMeshId(s: string): boolean {
  return MESH_ID_RE.test(s);
}

/** Parses a MeshId into its StructureId and lateral Side, throwing on invalid input. */
export function parseMeshId(id: string): {
  structureId: StructureId;
  side: Side;
} {
  if (!isMeshId(id)) {
    throw new Error(`invalid mesh id "${id}"`);
  }
  if (id.endsWith('--l')) {
    return { structureId: id.slice(0, -3), side: 'left' };
  }
  if (id.endsWith('--r')) {
    return { structureId: id.slice(0, -3), side: 'right' };
  }
  return { structureId: id, side: null };
}

/** Formats a StructureId and Side into a MeshId. */
export function toMeshId(structureId: StructureId, side: Side): MeshId {
  if (side === 'left') return `${structureId}--l`;
  if (side === 'right') return `${structureId}--r`;
  return structureId;
}
