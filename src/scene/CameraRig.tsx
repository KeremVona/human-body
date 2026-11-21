import { CameraControls, CameraControlsImpl } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useContext, useEffect, useRef, type JSX } from 'react';
import { useStore } from 'react-redux';
import { Box3, PerspectiveCamera, Vector3 } from 'three';
import type { RootState } from '../app/store';
import {
  CameraApiContext,
  bodyBounds,
  distanceLimits,
  fitDistance,
  presetPose,
  unionBounds,
  type CameraApi,
  type Preset,
} from './camera';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Owns drei CameraControls inside Canvas and implements CameraApi transitions and limits. */
export function CameraRig(): JSX.Element {
  const controlsRef = useRef<CameraControlsImpl | null>(null);
  const initializedRef = useRef(false);
  const store = useStore<RootState>();
  const controller = useContext(CameraApiContext);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);

  const sizeRef = useRef(size);
  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const cam = controls.camera;
    cam.near = 0.01;
    cam.far = 100;
    if (cam instanceof PerspectiveCamera) {
      cam.updateProjectionMatrix();
    }

    controls.smoothTime = 0.25;
    controls.dollyToCursor = true;
    controls.mouseButtons.right = CameraControlsImpl.ACTION.TRUCK;
    controls.touches.two = CameraControlsImpl.ACTION.TOUCH_DOLLY_TRUCK;

    const currentFov = cam instanceof PerspectiveCamera ? cam.fov : 35;

    const getAspect = () =>
      sizeRef.current.width / Math.max(1, sizeRef.current.height);

    const applyBodyPose = async (
      preset: Preset,
      animate: boolean,
    ): Promise<void> => {
      const manifest = store.getState().assets.manifest;
      if (!manifest) return;
      const body = bodyBounds(manifest);
      const limits = distanceLimits(null, body);
      controls.minDistance = limits.min;
      controls.maxDistance = limits.max;
      const dist = fitDistance(body, currentFov, getAspect());
      const pose = presetPose(preset, body, dist);
      const promise = controls.setLookAt(
        ...pose.position,
        ...pose.target,
        animate,
      );
      invalidate();
      await promise;
    };

    const impl: CameraApi = {
      async focusMeshes(ids) {
        const manifest = store.getState().assets.manifest;
        if (!manifest) return;
        const focus = unionBounds(ids, manifest.meshes);
        if (!focus) return;
        const body = bodyBounds(manifest);
        const limits = distanceLimits(focus, body);
        controls.minDistance = limits.min;
        controls.maxDistance = limits.max;
        const box = new Box3(
          new Vector3(...focus.min),
          new Vector3(...focus.max),
        );
        const animate = !prefersReducedMotion();
        const promise = controls.fitToBox(box, animate, {
          paddingTop: 0.15,
          paddingBottom: 0.15,
          paddingLeft: 0.15,
          paddingRight: 0.15,
        });
        invalidate();
        await promise;
      },
      async goToPreset(preset) {
        await applyBodyPose(preset, !prefersReducedMotion());
      },
      async resetView() {
        await applyBodyPose('anterior', !prefersReducedMotion());
      },
      zoom(step) {
        const factor = step === 1 ? 0.2 : -0.25;
        void controls.dolly(
          controls.distance * factor,
          !prefersReducedMotion(),
        );
        invalidate();
      },
    };

    const unbind = controller?.bind(impl);

    const maybeInitPose = () => {
      if (initializedRef.current) return;
      if (!store.getState().assets.manifest) return;
      initializedRef.current = true;
      void applyBodyPose('anterior', false);
    };

    maybeInitPose();
    const unsubStore = store.subscribe(maybeInitPose);

    return () => {
      unsubStore();
      unbind?.();
    };
  }, [store, controller, invalidate]);

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      smoothTime={0.25}
      dollyToCursor
    />
  );
}
