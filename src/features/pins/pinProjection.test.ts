import { Mesh, PerspectiveCamera, Plane, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { createMeshRegistry } from '../../scene/meshRegistry';
import type { Pin } from './pinsSlice';
import {
  collectProjectedPins,
  isPinRayOccluded,
  localToWorld,
  projectPins,
  selectOcclusionBatch,
  worldToLocal,
} from './pinProjection';

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

  it('collectProjectedPins + selectOcclusionBatch only budgets visible in-frustum pins', () => {
    const registry = createMeshRegistry();
    const visible = new Mesh();
    visible.visible = true;
    registry.register('femur--l', visible);

    const hidden = new Mesh();
    hidden.visible = false;
    registry.register('sternum', hidden);

    const camera = new PerspectiveCamera(50, 800 / 600, 0.1, 100);
    camera.position.set(0, 0, 3);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    const pins = [
      ...Array.from({ length: 60 }, (_, i) =>
        makePin(`hidden-${i}`, 'sternum'),
      ),
      ...Array.from({ length: 5 }, (_, i) => makePin(`vis-${i}`, 'femur--l')),
    ];

    const candidates = collectProjectedPins({
      pins,
      registry,
      camera,
      size: { width: 800, height: 600 },
    });
    expect(candidates.map((c) => c.pin.id)).toEqual([
      'vis-0',
      'vis-1',
      'vis-2',
      'vis-3',
      'vis-4',
    ]);

    const { batch, nextCursor } = selectOcclusionBatch(candidates, 0, 3);
    expect([...batch]).toEqual(['vis-0', 'vis-1', 'vis-2']);
    expect(nextCursor).toBe(3);

    const second = selectOcclusionBatch(candidates, nextCursor, 3);
    expect([...second.batch]).toEqual(['vis-3', 'vis-4', 'vis-0']);
    expect(second.nextCursor).toBe(1);
  });

  it('isPinRayOccluded ignores occluder hits on the removed side of a clip plane', () => {
    const pinMesh = new Mesh();
    const removedOccluder = new Mesh();
    const keptOccluder = new Mesh();
    const clip = new Plane(new Vector3(0, -1, 0), 0); // keeps y <= 0

    expect(
      isPinRayOccluded({
        hits: [
          {
            object: removedOccluder,
            distance: 0.5,
            point: new Vector3(0, 0.25, 0),
          },
        ],
        pinMesh,
        maxDistance: 2.0,
        clip,
      }),
    ).toBe(false);

    expect(
      isPinRayOccluded({
        hits: [
          {
            object: removedOccluder,
            distance: 0.5,
            point: new Vector3(0, 0.25, 0),
          },
          {
            object: keptOccluder,
            distance: 1.0,
            point: new Vector3(0, -0.25, 0),
          },
        ],
        pinMesh,
        maxDistance: 2.0,
        clip,
      }),
    ).toBe(true);
  });
});
