import { useThree } from '@react-three/fiber';
import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from 'react';
import { ReactReduxContext } from 'react-redux';
import { MeshBasicMaterial, type Mesh } from 'three';
import type { RootState } from '../app/store';
import { parseMeshId, type MeshId } from '../data/ids';
import { selectStructureLookup } from '../features/content/contentSlice';
import { useOptionalBatchRegistry } from './batching/batchRegistry';
import { buildBatches } from './batching/buildBatches';
import { batchingEnabled } from './batching/flag';
import { attachMeshBvh, detachMeshBvh } from './bvh';
import { useGltf } from './gltf';
import { meshIdOf, useMeshRegistry } from './meshRegistry';

type BundleModelProps = {
  url: string;
  bundleId: string;
  onReady?: (count: number) => void;
};

let placeholderMaterial: MeshBasicMaterial | null = null;

function getPlaceholderMaterial(): MeshBasicMaterial {
  if (!placeholderMaterial) {
    placeholderMaterial = new MeshBasicMaterial();
  }
  return placeholderMaterial;
}

/** Loads one Meshopt-compressed GLB bundle, registers every mesh, and builds appearance batches. */
export function BundleModel({ url, bundleId, onReady }: BundleModelProps) {
  const gltf = useGltf(url);
  const registry = useMeshRegistry();
  const batchRegistry = useOptionalBatchRegistry();
  const reduxCtx = useContext(ReactReduxContext);
  const store = reduxCtx?.store ?? null;
  const invalidate = useThree((s) => s.invalidate);
  const onReadyRef = useRef(onReady);

  const subscribeStore = useCallback(
    (onChange: () => void) => (store ? store.subscribe(onChange) : () => {}),
    [store],
  );
  const getHasIndex = useCallback(
    () => (store ? (store.getState() as RootState).content.index !== null : true),
    [store],
  );
  const hasIndex = useSyncExternalStore(subscribeStore, getHasIndex);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  const useBatching = Boolean(
    batchRegistry && batchingEnabled(window.location.search),
  );

  useEffect(() => {
    const registeredIds: MeshId[] = [];
    const registeredMeshes: Mesh[] = [];
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
        if (!useBatching) {
          attachMeshBvh(mesh);
        }
        registry.register(id, mesh);
        registeredIds.push(id);
        registeredMeshes.push(mesh);
      });
    } catch (error) {
      registry.unregister(registeredIds);
      for (const mesh of registeredMeshes) {
        detachMeshBvh(mesh);
      }
      throw error;
    }

    if (!useBatching) {
      onReadyRef.current?.(registeredIds.length);
    }
    invalidate();
    return () => {
      registry.unregister(registeredIds);
      for (const mesh of registeredMeshes) {
        detachMeshBvh(mesh);
      }
      invalidate();
    };
  }, [gltf.scene, bundleId, registry, useBatching, invalidate]);

  useEffect(() => {
    if (!batchRegistry || !hasIndex || !useBatching) {
      return;
    }

    const structureLookup = store
      ? selectStructureLookup(store.getState() as RootState)
      : null;

    gltf.scene.updateWorldMatrix(true, true);
    const entries: Array<{
      id: MeshId;
      mesh: Mesh;
      appearance: ReturnType<NonNullable<typeof structureLookup>['get']>;
    }> = [];
    gltf.scene.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh) return;
      const id = meshIdOf(mesh);
      if (!id) return;
      entries.push({
        id,
        mesh,
        appearance: structureLookup?.get(parseMeshId(id).structureId),
      });
    });

    if (entries.length === 0) {
      onReadyRef.current?.(0);
      return;
    }

    const handles = buildBatches(bundleId, entries, getPlaceholderMaterial);
    batchRegistry.add(handles);
    onReadyRef.current?.(entries.length);
    invalidate();

    return () => {
      const removed = batchRegistry.removeBundle(bundleId);
      for (const handle of removed) {
        (
          handle.batch as { disposeBoundsTree?: () => void }
        ).disposeBoundsTree?.();
        handle.batch.dispose();
      }
      invalidate();
    };
  }, [
    gltf.scene,
    bundleId,
    batchRegistry,
    store,
    hasIndex,
    useBatching,
    invalidate,
  ]);

  return <primitive object={gltf.scene} />;
}
