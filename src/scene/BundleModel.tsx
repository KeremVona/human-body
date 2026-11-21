import { useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { MeshStandardMaterial, type Mesh } from 'three';
import type { MeshId } from '../data/ids';
import { meshIdOf, useMeshRegistry } from './meshRegistry';

const placeholderMaterial = new MeshStandardMaterial({
  color: '#E8DCC4',
  roughness: 0.85,
});

type BundleModelProps = {
  url: string;
  bundleId: string;
  onReady?: (count: number) => void;
};

/** Loads one Meshopt-compressed GLB bundle and registers every mesh in MeshRegistry. */
export function BundleModel({ url, bundleId, onReady }: BundleModelProps) {
  const gltf = useGLTF(url, false, true);
  const registry = useMeshRegistry();
  const invalidate = useThree((s) => s.invalidate);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const registeredIds: MeshId[] = [];
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
      mesh.material = placeholderMaterial;
      registry.register(id, mesh);
      registeredIds.push(id);
    });

    onReadyRef.current?.(registeredIds.length);
    invalidate();
    return () => {
      registry.unregister(registeredIds);
      invalidate();
    };
  }, [gltf.scene, bundleId, registry, invalidate]);

  return <primitive object={gltf.scene} />;
}
