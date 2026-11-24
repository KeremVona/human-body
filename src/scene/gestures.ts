import type { Object3D } from 'three';
import type { MeshId } from '../data/ids';
import { meshIdOf } from './meshRegistry';

export const STATIONARY_PX = 5;
export const LONG_PRESS_MS = 500;
export const DOUBLE_TAP_MS = 300;
export const DOUBLE_TAP_PX = 24;

export type PointerKind = 'mouse' | 'touch' | 'pen';

/** Classifies a pointer release into click, drag, context click, or long-press. */
export function classifyRelease(g: {
  button: number;
  pointerType: PointerKind;
  dx: number;
  dy: number;
  ms: number;
}): 'click' | 'drag' | 'context' | 'long-press' {
  if (Math.hypot(g.dx, g.dy) > STATIONARY_PX) {
    return 'drag';
  }
  if (g.pointerType === 'mouse') {
    if (g.button === 2) return 'context';
    if (g.button === 0) return 'click';
    return 'drag';
  }
  if (g.ms >= LONG_PRESS_MS) {
    return 'long-press';
  }
  return g.button === 0 ? 'click' : 'drag';
}

/** Tracks consecutive stationary taps to detect double-tap / double-click within threshold. */
export function createTapTracker(): {
  tap(p: { x: number; y: number; t: number }): 'single' | 'double';
} {
  let last: { x: number; y: number; t: number } | null = null;

  return {
    tap(p) {
      if (
        last &&
        p.t - last.t <= DOUBLE_TAP_MS &&
        Math.hypot(p.x - last.x, p.y - last.y) <= DOUBLE_TAP_PX
      ) {
        last = null;
        return 'double';
      }
      last = { x: p.x, y: p.y, t: p.t };
      return 'single';
    },
  };
}

/** Returns the MeshId and world hit point of the closest intersection whose object is marked pickable. */
export function pickMeshHit<P>(
  intersections: readonly { object: Object3D; point?: P }[],
): { meshId: MeshId; point: P | undefined } | null {
  for (const hit of intersections) {
    if (hit.object.userData?.pickable !== true) {
      continue;
    }
    const id = meshIdOf(hit.object);
    if (id) {
      return { meshId: id, point: hit.point };
    }
  }
  return null;
}

/** Returns the MeshId of the closest intersection whose object is marked pickable. */
export function pickMeshId(
  intersections: readonly { object: Object3D }[],
): MeshId | null {
  return pickMeshHit(intersections)?.meshId ?? null;
}
