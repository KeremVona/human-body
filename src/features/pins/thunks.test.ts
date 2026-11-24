import { BoxGeometry, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { makeStore } from '../../app/store';
import { createMeshRegistry } from '../../scene/meshRegistry';
import { lastHit } from '../../scene/lastHit';
import { addPinAtPointer } from './thunks';

afterEach(() => {
  lastHit.set(null);
  localStorage.clear();
});

describe('addPinAtPointer', () => {
  it('adds a pin from an explicit hit even after lastHit is cleared by pointerout', () => {
    const registry = createMeshRegistry();
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    mesh.position.set(1, 2, 3);
    mesh.updateWorldMatrix(true, false);
    registry.register('femur--l', mesh);

    const store = makeStore(undefined, {
      camera: { current: null },
      registry,
    });
    lastHit.set(null);

    store.dispatch(addPinAtPointer({ meshId: 'femur--l', point: [1.5, 2, 3] }));

    const pins = store.getState().pins.items;
    expect(pins).toHaveLength(1);
    expect(pins[0].meshId).toBe('femur--l');
    expect(pins[0].local[0]).toBeCloseTo(0.5);
    expect(pins[0].local[1]).toBeCloseTo(0);
    expect(pins[0].local[2]).toBeCloseTo(0);
  });

  it('falls back to mesh bounding-box center when explicit point is null (keyboard context menu)', () => {
    const registry = createMeshRegistry();
    const mesh = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial());
    mesh.position.set(4, 5, 6);
    mesh.updateWorldMatrix(true, false);
    registry.register('femur--l', mesh);

    const store = makeStore(undefined, {
      camera: { current: null },
      registry,
    });
    store.dispatch(addPinAtPointer({ meshId: 'femur--l', point: null }));

    const pins = store.getState().pins.items;
    expect(pins).toHaveLength(1);
    expect(pins[0].local[0]).toBeCloseTo(0);
    expect(pins[0].local[1]).toBeCloseTo(0);
    expect(pins[0].local[2]).toBeCloseTo(0);
  });

  it('ignores non-pickable pointer hits when placing via shortcut P (no explicit hit)', () => {
    const registry = createMeshRegistry();
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    mesh.visible = true;
    mesh.userData.pickable = false;
    registry.register('femur--l', mesh);

    const store = makeStore(undefined, {
      camera: { current: null },
      registry,
    });
    lastHit.set({ meshId: 'femur--l', point: new Vector3(0, 0, 0) });

    store.dispatch(addPinAtPointer());
    expect(store.getState().pins.items).toHaveLength(0);

    mesh.userData.pickable = true;
    store.dispatch(addPinAtPointer());
    expect(store.getState().pins.items).toHaveLength(1);
  });
});
