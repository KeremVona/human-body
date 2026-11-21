import {
  createContext,
  createElement,
  useContext,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import type { MeshId } from '../data/ids';
import type { Manifest } from '../data/schema';

/** Axis-aligned 3D bounding box in world meters. */
export type Bounds = {
  min: [number, number, number];
  max: [number, number, number];
};

/** Anatomical viewing presets. */
export type Preset =
  'anterior' | 'posterior' | 'left' | 'right' | 'superior' | 'inferior';

const DEFAULT_BODY_BOUNDS: Bounds = {
  min: [-0.3, -0.9, -0.15],
  max: [0.3, 0.9, 0.15],
};

function halfDiagonal(b: Bounds): number {
  return (
    0.5 *
    Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2])
  );
}

/** Computes the enclosing bounding box of the given mesh ids, or null if none exist. */
export function unionBounds(
  ids: readonly MeshId[],
  meshes: Manifest['meshes'],
): Bounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  let found = false;

  for (const id of ids) {
    const entry = meshes[id];
    if (!entry) continue;
    const { min, max } = entry.bounds;
    if (min[0] < minX) minX = min[0];
    if (min[1] < minY) minY = min[1];
    if (min[2] < minZ) minZ = min[2];
    if (max[0] > maxX) maxX = max[0];
    if (max[1] > maxY) maxY = max[1];
    if (max[2] > maxZ) maxZ = max[2];
    found = true;
  }

  if (!found) return null;
  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
  };
}

/** Derives full-body bounds from the skeletal bundle's meshes. */
export function bodyBounds(manifest: Manifest): Bounds {
  const skeletal = manifest.bundles.find((b) => b.id === 'skeletal');
  const fromSkeletal = skeletal
    ? unionBounds(skeletal.meshIds, manifest.meshes)
    : null;
  if (fromSkeletal) return fromSkeletal;

  const fallback = unionBounds(Object.keys(manifest.meshes), manifest.meshes);
  return fallback ?? DEFAULT_BODY_BOUNDS;
}

/** Returns camera distance required to frame `b` cleanly inside the viewport. */
export function fitDistance(
  b: Bounds,
  fovDeg: number,
  aspect: number,
  padding = 1.15,
): number {
  const r = halfDiagonal(b);
  const fovV = (fovDeg * Math.PI) / 180;
  const safeAspect = Math.max(aspect, 0.01);
  const fovH = 2 * Math.atan(Math.tan(fovV / 2) * safeAspect);
  const limitingHalfFov = Math.min(fovV, fovH) / 2;
  return Math.max(0.05, (padding * r) / Math.sin(limitingHalfFov));
}

/** Returns camera position and look-at target for an anatomical preset pose. */
export function presetPose(
  p: Preset,
  b: Bounds,
  distance: number,
): {
  position: [number, number, number];
  target: [number, number, number];
} {
  const tx = (b.min[0] + b.max[0]) / 2;
  const ty = (b.min[1] + b.max[1]) / 2;
  const tz = (b.min[2] + b.max[2]) / 2;
  const target: [number, number, number] = [tx, ty, tz];

  switch (p) {
    case 'anterior':
      return { position: [tx, ty, tz + distance], target };
    case 'posterior':
      return { position: [tx, ty, tz - distance], target };
    case 'left':
      return { position: [tx + distance, ty, tz], target };
    case 'right':
      return { position: [tx - distance, ty, tz], target };
    case 'superior':
      return { position: [tx, ty + distance, tz + 0.01], target };
    case 'inferior':
      return { position: [tx, ty - distance, tz + 0.01], target };
  }
}

/** Computes minimum and maximum camera dolly distance bounds. */
export function distanceLimits(
  focus: Bounds | null,
  body: Bounds,
): { min: number; max: number } {
  const ref = focus ?? body;
  const min = Math.max(0.01, 1.1 * halfDiagonal(ref));
  const max = Math.max(min + 0.5, 4 * (body.max[1] - body.min[1]));
  return { min, max };
}

/** Imperative camera controls exposed outside and inside the Canvas via context. */
export type CameraApi = {
  focusMeshes(ids: MeshId[]): Promise<void>;
  goToPreset(p: Preset): Promise<void>;
  resetView(): Promise<void>;
  zoom(step: 1 | -1): void;
};

export type CameraDebugProbe = {
  screenPointOf(id: MeshId): { x: number; y: number } | null;
  waitIdle(): Promise<void>;
};

export type CameraController = {
  api: CameraApi;
  bind(impl: CameraApi, probe?: CameraDebugProbe): () => void;
  screenPointOf(id: MeshId): { x: number; y: number } | null;
  waitIdle(): Promise<void>;
};

export function createCameraController(): CameraController {
  let impl: CameraApi | null = null;
  let probeImpl: CameraDebugProbe | null = null;
  const api: CameraApi = {
    focusMeshes(ids) {
      return impl ? impl.focusMeshes(ids) : Promise.resolve();
    },
    goToPreset(p) {
      return impl ? impl.goToPreset(p) : Promise.resolve();
    },
    resetView() {
      return impl ? impl.resetView() : Promise.resolve();
    },
    zoom(step) {
      impl?.zoom(step);
    },
  };

  return {
    api,
    bind(next, nextProbe) {
      impl = next;
      probeImpl = nextProbe ?? null;
      return () => {
        if (impl === next) {
          impl = null;
          probeImpl = null;
        }
      };
    },
    screenPointOf(id) {
      return probeImpl ? probeImpl.screenPointOf(id) : null;
    },
    waitIdle() {
      return probeImpl ? probeImpl.waitIdle() : Promise.resolve();
    },
  };
}

export const CameraApiContext = createContext<CameraController | null>(null);

/** Provides shared CameraApi context to UI controls and Canvas children. */
export function CameraApiProvider({
  value,
  controller,
  children,
}: {
  value?: CameraApi;
  controller?: CameraController;
  children: ReactNode;
}): JSX.Element {
  const [fallback] = useState(createCameraController);
  const resolved = useMemo<CameraController>(() => {
    if (controller) return controller;
    if (value) {
      return {
        api: value,
        bind: () => () => {},
        screenPointOf: () => null,
        waitIdle: () => Promise.resolve(),
      };
    }
    return fallback;
  }, [controller, value, fallback]);

  return createElement(
    CameraApiContext.Provider,
    { value: resolved },
    children,
  );
}

/** Returns the active CameraApi from context, throwing if no provider is mounted. */
export function useCameraApi(): CameraApi {
  const ctx = useContext(CameraApiContext);
  if (!ctx) {
    throw new Error('useCameraApi must be used within CameraApiProvider');
  }
  return ctx.api;
}
