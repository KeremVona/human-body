import { Mesh, PerspectiveCamera } from 'three';
import { describe, expect, it } from 'vitest';
import { createMeshRegistry } from '../../scene/meshRegistry';
import type { Pin } from './pinsSlice';
import { localToWorld, projectPins, worldToLocal } from './pinProjection';

function makePin(id: string, meshId: string): Pin {
  return {
    id,
    meshId,
    local: [0, 0, 0],
    label: `Pin ${id}`,
    note: '',
    createdAt: 1000,
  };
}

describe('pinProjection', () => {
  it('round-trips world/local through a moved mesh', () => {
    const m = new Mesh();
    m.position.set(1, 0, 0);
    m.rotation.set(0, Math.PI / 2, 0);
    m.updateMatrixWorld();

    const local = worldToLocal(m, [1, 0, -1]);
    expect(localToWorld(m, local).map((n) => +n.toFixed(6))).toEqual([
      1, 0, -1,
    ]);
  });

  it('projectPins skips missing and invisible meshes', () => {
    const registry = createMeshRegistry();
    const visibleMesh = new Mesh();
    visibleMesh.visible = true;
    const hiddenMesh = new Mesh();
    hiddenMesh.visible = false;

    registry.register('femur--l', visibleMesh);
    registry.register('sternum', hiddenMesh);

    const camera = new PerspectiveCamera(50, 800 / 600, 0.1, 100);
    camera.position.set(0, 0, 3);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    const out = projectPins({
      pins: [
        makePin('a', 'femur--l'),
        makePin('b', 'sternum'),
        makePin('c', 'gone'),
      ],
      registry,
      camera,
      size: { width: 800, height: 600 },
      occlusion: () => false,
    });

    expect(out.map((p) => p.id)).toEqual(['a']);
    expect(out[0]).toMatchObject({ x: 400, y: 300, dimmed: false });
  });

  it('projectPins skips points behind the camera', () => {
    const registry = createMeshRegistry();
    const behindMesh = new Mesh();
    behindMesh.position.set(0, 0, 10);
    behindMesh.visible = true;
    registry.register('femur--l', behindMesh);

    const camera = new PerspectiveCamera(50, 800 / 600, 0.1, 100);
    camera.position.set(0, 0, 3);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    const out = projectPins({
      pins: [makePin('behind', 'femur--l')],
      registry,
      camera,
      size: { width: 800, height: 600 },
      occlusion: () => false,
    });

    expect(out).toEqual([]);
  });
});
