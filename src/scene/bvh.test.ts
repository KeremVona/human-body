import {
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Vector3,
} from 'three';
import { acceleratedRaycast } from 'three-mesh-bvh';
import { attachMeshBvh, detachMeshBvh } from './bvh';

function makeBoxMesh(): Mesh {
  return new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
}

it('builds a boundsTree, uses acceleratedRaycast, and restores on detach', () => {
  const mesh = makeBoxMesh();
  expect(mesh.geometry.boundsTree).toBeUndefined();
  expect(mesh.raycast).toBe(Mesh.prototype.raycast);

  expect(attachMeshBvh(mesh)).toBe(true);
  expect(mesh.geometry.boundsTree).toBeDefined();
  expect(mesh.raycast).toBe(acceleratedRaycast);
  expect(attachMeshBvh(mesh)).toBe(false);

  const raycaster = new Raycaster(new Vector3(0, 0, 5), new Vector3(0, 0, -1));
  raycaster.firstHitOnly = true;
  expect(raycaster.intersectObject(mesh)).toHaveLength(1);

  detachMeshBvh(mesh);
  expect(mesh.geometry.boundsTree).toBeNull();
  expect(mesh.raycast).toBe(Mesh.prototype.raycast);
});
