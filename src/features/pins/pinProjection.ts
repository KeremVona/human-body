import { Vector3, type Camera, type Object3D } from 'three';
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

/** Projects visible on-screen pins into viewport CSS pixel coordinates. */
export function projectPins(args: {
  pins: readonly Pin[];
  registry: MeshRegistry;
  camera: Camera;
  size: { width: number; height: number };
  occlusion: (pin: Pin, world: Vector3) => boolean;
}): PinScreen[] {
  const { pins, registry, camera, size, occlusion } = args;
  camera.updateMatrixWorld();
  const out: PinScreen[] = [];

  for (const pin of pins) {
    const mesh = registry.get(pin.meshId);
    if (!mesh || !mesh.visible) continue;

    const worldArr = localToWorld(mesh, pin.local);
    const worldVec = new Vector3(worldArr[0], worldArr[1], worldArr[2]);
    const ndc = worldVec.clone().project(camera);

    if (ndc.z < -1 || ndc.z > 1) continue;

    const x = ((ndc.x + 1) / 2) * size.width;
    const y = ((-ndc.y + 1) / 2) * size.height;
    const dimmed = occlusion(pin, worldVec);
    out.push({ id: pin.id, x, y, dimmed });
  }

  return out;
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
