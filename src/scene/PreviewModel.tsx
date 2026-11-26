import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, type JSX } from 'react';
import { Mesh, MeshPhysicalMaterial, type Group } from 'three';
import { useOptionalGltf } from './gltf';
import { RENDER_ORDER, TISSUE_LOOKS } from './materials';
import { nextPreviewState, previewState } from './previewState';

const FADE_SECONDS = 0.3;

function noopRaycast(): void {
  // Preview silhouette is non-pickable until the full skeletal bundle loads.
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Renders the simplified `skeletal-preview` mesh outside `<Picking>` with bone styling
 * and fades it out over 300 ms once the full interactive skeletal bundle becomes ready.
 */
export function PreviewModel({
  url,
  skeletalReady,
}: {
  url: string;
  skeletalReady: boolean;
}): JSX.Element | null {
  const gltf = useOptionalGltf(url);
  const invalidate = useThree((s) => s.invalidate);
  const groupRef = useRef<Group>(null);
  const materialRef = useRef<MeshPhysicalMaterial | null>(null);
  const fadeElapsedRef = useRef(0);
  const markedRef = useRef(false);

  useEffect(() => {
    const group = groupRef.current;
    if (!group || !gltf) return;

    const cloned = gltf.scene.clone();
    const material = new MeshPhysicalMaterial({
      color: TISSUE_LOOKS.bone.color,
      roughness: TISSUE_LOOKS.bone.roughness,
      clearcoat: TISSUE_LOOKS.bone.clearcoat,
      sheen: TISSUE_LOOKS.bone.sheen,
      transparent: true,
      opacity: 1,
      depthWrite: true,
    });
    cloned.traverse((obj) => {
      if (obj instanceof Mesh) {
        obj.material = material;
        obj.renderOrder = RENDER_ORDER.skeletal;
        obj.raycast = noopRaycast;
      }
    });

    fadeElapsedRef.current = 0;
    materialRef.current = material;
    group.add(cloned);
    invalidate();

    return () => {
      group.remove(cloned);
      materialRef.current = null;
      material.dispose();
    };
  }, [gltf, invalidate]);

  useEffect(() => {
    const reduced = prefersReducedMotion();
    if (!gltf) {
      previewState.set(
        nextPreviewState(previewState.get(), 'failed', reduced),
      );
      return;
    }
    if (skeletalReady) {
      previewState.set(
        nextPreviewState(previewState.get(), 'skeletal-ready', reduced),
      );
      invalidate();
      return;
    }
    const next = nextPreviewState(previewState.get(), 'loaded', reduced);
    if (next !== previewState.get()) {
      previewState.set(next);
      invalidate();
    }
  }, [gltf, skeletalReady, invalidate]);

  useFrame((_, delta) => {
    if (!gltf) return;
    if (
      !markedRef.current &&
      typeof performance !== 'undefined' &&
      performance.getEntriesByName('atlas:first-view', 'mark').length === 0
    ) {
      markedRef.current = true;
      performance.mark('atlas:first-view');
    }

    const material = materialRef.current;
    if (material && previewState.get() === 'fading') {
      fadeElapsedRef.current += Math.min(delta, 0.1);
      const t = Math.min(1, fadeElapsedRef.current / FADE_SECONDS);
      material.opacity = 1 - t;
      invalidate();
      if (fadeElapsedRef.current >= FADE_SECONDS) {
        previewState.set(
          nextPreviewState('fading', 'fade-done', prefersReducedMotion()),
        );
      }
    }
  });

  if (!gltf) return null;
  return <group ref={groupRef} />;
}
