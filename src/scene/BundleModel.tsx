import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { Mesh } from 'three';
import type { MeshId } from '../data/ids';
import { attachMeshBvh, detachMeshBvh } from './bvh';
import { useGltf } from './gltf';
import { meshIdOf, useMeshRegistry } from './meshRegistry';

type BundleModelProps = {
  url: string;
  bundleId: string;
  onReady?: (count: number) => void;
};

/** Loads one Meshopt-compressed GLB bundle and registers every mesh in MeshRegistry. */
export function BundleModel({ url, bundleId, onReady }: BundleModelProps) {
  const gltf = useGltf(url);
  const registry = useMeshRegistry();
  const invalidate = useThree((s) => s.invalidate);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const registeredIds: MeshId[] = [];
    const bvhMeshes: Mesh[] = [];
    try {
      gltf.scene.traverse((obj) => {
        const mesh = obj as Mesh;
        if (!mesh.isMesh) return;
        const id = meshIdOf(mesh);
        if (!id) {
          console.warn(
            `Bundle "${bundleId}": mesh "${mesh.name}" has no valid MeshId ancestor`,
          );
          return;
        }
        mesh.visible = false;
        if (attachMeshBvh(mesh)) {
          bvhMeshes.push(mesh);
        }
        registry.register(id, mesh);
        registeredIds.push(id);
      });
    } catch (error) {
      registry.unregister(registeredIds);
      for (const mesh of bvhMeshes) {
        detachMeshBvh(mesh);
      }
      throw error;
    }

    onReadyRef.current?.(registeredIds.length);
    invalidate();
    return () => {
      registry.unregister(registeredIds);
      for (const mesh of bvhMeshes) {
        detachMeshBvh(mesh);
      }
      invalidate();
    };
  }, [gltf.scene, bundleId, registry, invalidate]);

  return <primitive object={gltf.scene} />;
}
