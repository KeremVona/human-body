import type { MeshId } from '../data/ids';
import type { SystemId, Tissue } from '../data/schema';
import {
  RENDER_ORDER,
  materialStateFor,
  type createMaterialLibrary,
} from './materials';
import type { MeshRegistry } from './meshRegistry';
import type { MeshState } from './resolveMeshState';

export type MeshAppearance = {
  system: SystemId;
  tissue: Tissue;
  color?: string;
};

const warnedPerRegistry = new WeakMap<MeshRegistry, Set<MeshId>>();

function warnOnce(registry: MeshRegistry, id: MeshId): void {
  let warned = warnedPerRegistry.get(registry);
  if (!warned) {
    warned = new Set();
    warnedPerRegistry.set(registry, warned);
  }
  if (!warned.has(id)) {
    warned.add(id);
    console.warn(
      `No metadata lookup found for mesh "${id}"; using fallback material.`,
    );
  }
}

function sameMeshState(a: MeshState, b: MeshState): boolean {
  return (
    a.visible === b.visible &&
    a.opacity === b.opacity &&
    a.ghost === b.ghost &&
    a.highlight === b.highlight &&
    a.pickable === b.pickable
  );
}

/** Imperatively updates registered Three.js meshes whose resolved MeshState changed. */
export function applyMeshStates({
  registry,
  prev,
  next,
  lookup,
  library,
}: {
  registry: MeshRegistry;
  prev: Map<MeshId, MeshState>;
  next: Map<MeshId, MeshState>;
  lookup: (id: MeshId) => MeshAppearance | undefined;
  library: ReturnType<typeof createMaterialLibrary>;
}): number {
  let changed = 0;

  for (const [id, state] of next) {
    const previous = prev.get(id);
    if (previous && sameMeshState(previous, state)) {
      continue;
    }

    const mesh = registry.get(id);
    if (!mesh) {
      continue;
    }

    const info = lookup(id);
    if (!info) {
      warnOnce(registry, id);
      mesh.material = library.fallback();
      mesh.renderOrder = state.ghost ? 10 : 0;
    } else {
      mesh.material = library.get({
        system: info.system,
        tissue: info.tissue,
        color: info.color,
        state: materialStateFor(state),
      });
      mesh.renderOrder = RENDER_ORDER[info.system] + (state.ghost ? 10 : 0);
    }

    mesh.visible = state.visible;
    mesh.userData.pickable = state.pickable;
    changed += 1;
  }

  return changed;
}
