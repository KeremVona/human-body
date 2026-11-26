import { Vector3, type Camera, type Object3D, type Plane } from 'three';
import type { MeshRegistry } from '../../scene/meshRegistry';
import type { Pin } from './pinsSlice';

export type PinScreen = {
  id: string;
  x: number;
  y: number;
  dimmed: boolean;
};

/** Converts a world-space point into the mesh's local coordinate frame. */
export function worldToLocal(
  mesh: Object3D,
  world: [number, number, number],
): [number, number, number] {
  mesh.updateWorldMatrix(true, false);
  const v = new Vector3(world[0], world[1], world[2]);
  mesh.worldToLocal(v);
  return [v.x, v.y, v.z];
}

/** Converts a mesh-local point into world coordinates. */
export function localToWorld(
  mesh: Object3D,
  local: [number, number, number],
): [number, number, number] {
  mesh.updateWorldMatrix(true, false);
  const v = new Vector3(local[0], local[1], local[2]);
  mesh.localToWorld(v);
  return [v.x, v.y, v.z];
}

export type ProjectedPinCandidate = {
  pin: Pin;
  x: number;
  y: number;
  world: Vector3;
};

/** Collects visible, in-frustum pins with viewport CSS pixel coordinates and world positions. */
export function collectProjectedPins(args: {
  pins: readonly Pin[];
  registry: MeshRegistry;
  camera: Camera;
  size: { width: number; height: number };
}): ProjectedPinCandidate[] {
  const { pins, registry, camera, size } = args;
  camera.updateMatrixWorld();
  const out: ProjectedPinCandidate[] = [];

  for (const pin of pins) {
    const mesh = registry.get(pin.meshId);
    const isVisible = mesh
      ? ((mesh.userData?.atlasVisible as boolean | undefined) ?? mesh.visible)
      : false;
    if (!mesh || !isVisible) continue;

    const worldArr = localToWorld(mesh, pin.local);
    const world = new Vector3(worldArr[0], worldArr[1], worldArr[2]);
    const ndc = world.clone().project(camera);

    if (ndc.z < -1 || ndc.z > 1) continue;

    const x = ((ndc.x + 1) / 2) * size.width;
    const y = ((-ndc.y + 1) / 2) * size.height;
    out.push({ pin, x, y, world });
  }

  return out;
}

/** Selects up to `limit` round-robin pin IDs strictly from visible candidates. */
export function selectOcclusionBatch(
  candidates: readonly ProjectedPinCandidate[],
  cursor: number,
  limit: number,
): { batch: Set<string>; nextCursor: number } {
  const total = candidates.length;
  const batch = new Set<string>();
  if (total === 0 || limit <= 0) {
    return { batch, nextCursor: 0 };
  }
  const start = ((cursor % total) + total) % total;
  const count = Math.min(total, limit);
  for (let i = 0; i < count; i++) {
    batch.add(candidates[(start + i) % total].pin.id);
  }
  return { batch, nextCursor: (start + count) % total };
}

/** Returns true when a raycast hit list contains an unclipped mesh closer than `maxDistance` in front of `pinMesh`. */
export function isPinRayOccluded(args: {
  hits: readonly { object: Object3D; distance: number; point: Vector3 }[];
  pinMesh: Object3D | undefined;
  maxDistance: number;
  clip: Plane | null;
}): boolean {
  const { hits, pinMesh, maxDistance, clip } = args;
  const hit = clip
    ? hits.find((h) => clip.distanceToPoint(h.point) >= 0)
    : hits[0];
  return Boolean(hit && hit.object !== pinMesh && hit.distance < maxDistance);
}

/** Projects visible on-screen pins into viewport CSS pixel coordinates. */
export function projectPins(args: {
  pins: readonly Pin[];
  registry: MeshRegistry;
  camera: Camera;
  size: { width: number; height: number };
  occlusion: (pin: Pin, world: Vector3) => boolean;
}): PinScreen[] {
  const candidates = collectProjectedPins(args);
  return candidates.map(({ pin, x, y, world }) => ({
    id: pin.id,
    x,
    y,
    dimmed: args.occlusion(pin, world),
  }));
}

function screensEqual(
  a: readonly PinScreen[],
  b: readonly PinScreen[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const pa = a[i];
    const pb = b[i];
    if (
      pa.id !== pb.id ||
      pa.dimmed !== pb.dimmed ||
      Math.abs(pa.x - pb.x) > 0.25 ||
      Math.abs(pa.y - pb.y) > 0.25
    ) {
      return false;
    }
  }
  return true;
}

let currentScreens: PinScreen[] = [];
const listeners = new Set<() => void>();

/** External reactive store for projected 2D pin positions read via `useSyncExternalStore`. */
export const pinScreens = {
  get(): PinScreen[] {
    return currentScreens;
  },
  set(next: PinScreen[]): void {
    if (screensEqual(currentScreens, next)) return;
    currentScreens = next;
    for (const listener of listeners) {
      listener();
    }
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
