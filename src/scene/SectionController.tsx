import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Plane } from 'three';
import { useAppSelector } from '../app/hooks';
import { sectionPlane, presetForSection, type SectionAxis } from '../features/section/sectionPlane';
import { bodyBounds, useCameraApi, type Bounds } from './camera';
import { sectionMaterialLibrary, sectionPlaneStore } from './sectionPlaneStore';

const DEFAULT_BODY_BOUNDS: Bounds = {
  min: [-0.3, -0.9, -0.15],
  max: [0.3, 0.9, 0.15],
};

/** Syncs `section` Redux state with the shared Three.js clipping plane, raycaster, and camera preset. */
export function SectionController(): null {
  const { enabled, axis, t, flip } = useAppSelector((s) => s.section);
  const manifest = useAppSelector((s) => s.assets.manifest);
  const gl = useThree((s) => s.gl);
  const raycaster = useThree((s) => s.raycaster);
  const invalidate = useThree((s) => s.invalidate);
  const cameraApi = useCameraApi();

  const sharedPlaneRef = useRef<Plane | null>(null);
  const prevEnabledRef = useRef(false);
  const prevViewRef = useRef<{ axis: SectionAxis; flip: boolean } | null>(null);

  useEffect(() => {
    const syncLibrary = () => {
      const lib = sectionMaterialLibrary.get();
      if (!lib) return;
      lib.setClipPlane(sectionPlaneStore.get());
      invalidate();
    };

    const unsub = sectionMaterialLibrary.subscribe(syncLibrary);
    return () => {
      unsub();
    };
  }, [invalidate]);

  useEffect(() => {
    const wasEnabled = prevEnabledRef.current;

    if (!enabled) {
      if (wasEnabled) {
        prevEnabledRef.current = false;
        prevViewRef.current = null;
        Object.assign(gl, { localClippingEnabled: false });
        Object.assign(raycaster, { firstHitOnly: true });
        sectionPlaneStore.set(null);
        sectionMaterialLibrary.get()?.setClipPlane(null);
        invalidate();
      }
      return;
    }

    if (!sharedPlaneRef.current) {
      sharedPlaneRef.current = new Plane();
    }
    const plane = sharedPlaneRef.current;
    const bounds = manifest ? bodyBounds(manifest) : DEFAULT_BODY_BOUNDS;
    const coeffs = sectionPlane({ axis, t, flip }, bounds);
    plane.normal.set(coeffs.normal[0], coeffs.normal[1], coeffs.normal[2]);
    plane.constant = coeffs.constant;

    Object.assign(gl, { localClippingEnabled: true });
    Object.assign(raycaster, { firstHitOnly: false });

    if (sectionPlaneStore.get() !== plane) {
      sectionPlaneStore.set(plane);
      sectionMaterialLibrary.get()?.setClipPlane(plane);
    }

    const prevView = prevViewRef.current;
    if (!wasEnabled || !prevView || prevView.axis !== axis || prevView.flip !== flip) {
      void cameraApi.goToPreset(presetForSection(axis, flip));
    }
    prevEnabledRef.current = true;
    prevViewRef.current = { axis, flip };
    invalidate();
  }, [enabled, axis, t, flip, manifest, gl, raycaster, cameraApi, invalidate]);

  useEffect(() => {
    return () => {
      if (prevEnabledRef.current) {
        Object.assign(gl, { localClippingEnabled: false });
        Object.assign(raycaster, { firstHitOnly: true });
        sectionPlaneStore.set(null);
        sectionMaterialLibrary.get()?.setClipPlane(null);
      }
    };
  }, [gl, raycaster]);

  return null;
}
