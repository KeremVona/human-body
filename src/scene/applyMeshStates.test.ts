import { BufferGeometry, Mesh } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyMeshStates } from './applyMeshStates';
import { createMaterialLibrary } from './materials';
import { createMeshRegistry } from './meshRegistry';
import type { MeshState } from './resolveMeshState';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('applyMeshStates', () => {
  it('applies visibility, material, renderOrder, and pickable only on changes', () => {
    const registry = createMeshRegistry();
    const bicep = new Mesh(new BufferGeometry());
    bicep.name = 'biceps-brachii--l';
    registry.register('biceps-brachii--l', bicep);

    const library = createMaterialLibrary(0.15);
    const lookup = () => ({
      system: 'muscular' as const,
      tissue: 'muscle' as const,
    });

    const normalState: MeshState = {
      visible: true,
      opacity: 1,
      ghost: false,
      highlight: 'none',
      pickable: true,
    };

    const next1 = new Map([['biceps-brachii--l', normalState]]);
    const changed1 = applyMeshStates({
      registry,
      prev: new Map(),
      next: next1,
      lookup,
      library,
    });

    expect(changed1).toBe(1);
    expect(bicep.visible).toBe(true);
    expect(bicep.renderOrder).toBe(3);
    expect(bicep.userData.pickable).toBe(true);
    const firstMaterial = bicep.material;

    const changed2 = applyMeshStates({
      registry,
      prev: next1,
      next: new Map([['biceps-brachii--l', { ...normalState }]]),
      lookup,
      library,
    });
    expect(changed2).toBe(0);
    expect(bicep.material).toBe(firstMaterial);

    const ghostState: MeshState = {
      visible: true,
      opacity: 0.15,
      ghost: true,
      highlight: 'none',
      pickable: false,
    };
    const changed3 = applyMeshStates({
      registry,
      prev: next1,
      next: new Map([['biceps-brachii--l', ghostState]]),
      lookup,
      library,
    });
    expect(changed3).toBe(1);
    expect(bicep.renderOrder).toBe(13);
    expect(bicep.userData.pickable).toBe(false);
    expect(bicep.material).toBe(
      library.get({ system: 'muscular', tissue: 'muscle', state: 'ghost' }),
    );
  });

  it('uses fallback material and warns once per unknown mesh id across calls', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const registry = createMeshRegistry();
    const mystery = new Mesh(new BufferGeometry());
    mystery.name = 'mystery-part';
    registry.register('mystery-part', mystery);

    const library = createMaterialLibrary(0.15);
    const state1: MeshState = {
      visible: false,
      opacity: 1,
      ghost: false,
      highlight: 'none',
      pickable: false,
    };
    const state2: MeshState = {
      visible: true,
      opacity: 1,
      ghost: false,
      highlight: 'hovered',
      pickable: true,
    };

    const map1 = new Map([['mystery-part', state1]]);
    const map2 = new Map([['mystery-part', state2]]);

    applyMeshStates({
      registry,
      prev: new Map(),
      next: map1,
      lookup: () => undefined,
      library,
    });
    applyMeshStates({
      registry,
      prev: map1,
      next: map2,
      lookup: () => undefined,
      library,
    });

    expect(mystery.material).toBe(library.fallback());
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('re-applies state when a MeshId is replaced by a new Mesh instance with the same state', () => {
    const registry = createMeshRegistry();
    const oldMesh = new Mesh(new BufferGeometry());
    oldMesh.name = 'femur--l';
    registry.register('femur--l', oldMesh);

    const library = createMaterialLibrary(0.15);
    const lookup = () => ({
      system: 'skeletal' as const,
      tissue: 'bone' as const,
    });
    const visibleState: MeshState = {
      visible: true,
      opacity: 1,
      ghost: false,
      highlight: 'none',
      pickable: true,
    };

    const next = new Map([['femur--l', visibleState]]);
    applyMeshStates({
      registry,
      prev: new Map(),
      next,
      lookup,
      library,
    });

    registry.unregister(['femur--l']);
    const reloadedMesh = new Mesh(new BufferGeometry());
    reloadedMesh.name = 'femur--l';
    reloadedMesh.visible = false;
    registry.register('femur--l', reloadedMesh);

    const changed = applyMeshStates({
      registry,
      prev: next,
      next: new Map([['femur--l', { ...visibleState }]]),
      lookup,
      library,
    });

    expect(changed).toBe(1);
    expect(reloadedMesh.visible).toBe(true);
    expect(reloadedMesh.userData.pickable).toBe(true);
    expect(reloadedMesh.material).toBe(
      library.get({ system: 'skeletal', tissue: 'bone', state: 'base' }),
    );
  });
});
