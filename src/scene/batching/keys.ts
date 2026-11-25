import type { MeshAppearance } from '../applyMeshStates';

/** Canonical batch grouping key for a bundle + appearance descriptor. */
export function appearanceKey(
  bundleId: string,
  appearance: MeshAppearance | undefined,
): string {
  if (!appearance) {
    return `${bundleId}|fallback`;
  }
  return `${bundleId}|${appearance.system}|${appearance.tissue}|${appearance.color ?? ''}`;
}
