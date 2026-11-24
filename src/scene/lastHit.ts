import type { Vector3 } from 'three';
import type { MeshId } from '../data/ids';

export type SurfaceHit = {
  meshId: MeshId;
  point: Vector3;
};

let current: SurfaceHit | null = null;

/** Module-level store holding the latest pickable 3D surface hit in world coordinates. */
export const lastHit = {
  get(): SurfaceHit | null {
    return current;
  },
  set(next: SurfaceHit | null): void {
    current = next;
  },
};
