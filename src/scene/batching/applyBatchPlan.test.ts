import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { MeshId } from '../../data/ids';
import { createMaterialLibrary } from '../materials';
import { createMeshRegistry } from '../meshRegistry';
import type { MeshState } from '../resolveMeshState';
import { applyBatchPlan } from './applyBatchPlan';
import { buildBatches } from './buildBatches';
import { planBatches } from './planBatches';

function makeState(overrides: Partial<MeshState> = {}): MeshState {
  return {
    visible: true,
    opacity: 1,
    ghost: false,
    highlight: 'none',
    pickable: true,
    active: false,
    ...overrides,
  };
}

function setupGroup(
  system: 'skeletal' | 'muscular',
  tissue: 'bone' | 'muscle',
  ids: MeshId[],
) {
  const registry = createMeshRegistry();
  const appearance = { system, tissue };
  const entries = ids.map((id) => {
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    mesh.name = id;
    mesh.visible = false;
    registry.register(id, mesh);
    return { id, mesh, appearance };
  });
  const handles = buildBatches(
    system,
    entries,
    () => new MeshBasicMaterial(),
  );
  const members = new Map(handles.map((h) => [h.key, h.meshIdAt]));
  return { registry, handles, members };
}

describe('applyBatchPlan', () => {
  it('applies base plan with promoted and batch-drawn meshes', () => {
    const ids = ['femur--l', 'tibia--l', 'fibula--l'] as MeshId[];
    const { registry, handles, members } = setupGroup('skeletal', 'bone', ids);
    const library = createMaterialLibrary(0.15);

    const states = new Map<MeshId, MeshState>([
      ['femur--l', makeState({ highlight: 'hovered' })],
      ['tibia--l', makeState()],
      ['fibula--l', makeState()],
    ]);
    const plan = planBatches({ members, states, moving: new Set() });

    const stats = applyBatchPlan({ handles, plan, states, registry, library });
    expect(stats.promoted).toBe(1);
    expect(stats.visibleBatches).toBe(1);

    expect(registry.get('femur--l' as MeshId)?.visible).toBe(true);
    expect(registry.get('femur--l' as MeshId)?.layers.isEnabled(0)).toBe(true);
    expect(registry.get('tibia--l' as MeshId)?.visible).toBe(false);
    expect(registry.get('tibia--l' as MeshId)?.layers.isEnabled(0)).toBe(false);
    expect(registry.get('fibula--l' as MeshId)?.visible).toBe(false);
    expect(registry.get('fibula--l' as MeshId)?.layers.isEnabled(0)).toBe(false);

    const batch = handles[0].batch;
    expect(batch.visible).toBe(true);
    expect(batch.getVisibleAt(0)).toBe(false);
    expect(batch.getVisibleAt(1)).toBe(true);
    expect(batch.getVisibleAt(2)).toBe(true);
    expect(batch.material).toBe(
      library.get({ system: 'skeletal', tissue: 'bone', state: 'base' }),
    );
    expect(Array.from(batch.userData.pickable as Uint8Array)).toEqual([
      0, 1, 1,
    ]);
  });

  it('applies ghost batch material, renderOrder, and sortObjects for muscular ghost batch', () => {
    const ids = [
      'biceps-brachii--l',
      'triceps-brachii--l',
      'deltoid--l',
    ] as MeshId[];
    const { registry, handles, members } = setupGroup(
      'muscular',
      'muscle',
      ids,
    );
    const library = createMaterialLibrary(0.15);

    const states = new Map<MeshId, MeshState>([
      ['biceps-brachii--l', makeState({ ghost: true, pickable: false, opacity: 0.15 })],
      ['triceps-brachii--l', makeState({ ghost: true, pickable: false, opacity: 0.15 })],
      ['deltoid--l', makeState()],
    ]);
    const plan = planBatches({ members, states, moving: new Set() });

    applyBatchPlan({ handles, plan, states, registry, library });

    const handle = handles[0];
    expect(handle.state).toBe('ghost');
    expect(handle.batch.material).toBe(
      library.get({ system: 'muscular', tissue: 'muscle', state: 'ghost' }),
    );
    expect(handle.batch.renderOrder).toBe(13);
    expect(handle.batch.sortObjects).toBe(true);
    expect(registry.get('deltoid--l' as MeshId)?.visible).toBe(true);
  });

  it('skips setVisibleAt calls on unchanged re-application', () => {
    const ids = ['femur--l', 'tibia--l'] as MeshId[];
    const { registry, handles, members } = setupGroup('skeletal', 'bone', ids);
    const library = createMaterialLibrary(0.15);
    const states = new Map<MeshId, MeshState>([
      ['femur--l', makeState()],
      ['tibia--l', makeState()],
    ]);
    const plan = planBatches({ members, states, moving: new Set() });

    applyBatchPlan({ handles, plan, states, registry, library });

    const spy = vi.spyOn(handles[0].batch, 'setVisibleAt');
    applyBatchPlan({ handles, plan, states, registry, library });
    expect(spy).not.toHaveBeenCalled();
  });
});
