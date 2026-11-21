import { Mesh } from 'three';
import {
  SAH,
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
} from 'three-mesh-bvh';

/** Attaches a three-mesh-bvh bounds tree and accelerated raycast to `mesh`. */
export function attachMeshBvh(mesh: Mesh): boolean {
  if (mesh.geometry.boundsTree || mesh.raycast !== Mesh.prototype.raycast) {
    return false;
  }
  mesh.raycast = acceleratedRaycast;
  computeBoundsTree.call(mesh.geometry, {
    strategy: SAH,
    targetLeafSize: 10,
    setBoundingBox: true,
  });
  return true;
}

/** Disposes a mesh's bounds tree and restores default Three.js raycasting. */
export function detachMeshBvh(mesh: Mesh): void {
  if (mesh.geometry.boundsTree) {
    disposeBoundsTree.call(mesh.geometry);
  }
  if (mesh.raycast === acceleratedRaycast) {
    mesh.raycast = Mesh.prototype.raycast;
  }
}
