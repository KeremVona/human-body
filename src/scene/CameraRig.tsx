import { useFrame, useThree } from '@react-three/fiber';
import CameraControlsImpl from 'camera-controls';
import { useContext, useEffect, useRef } from 'react';
import { useStore } from 'react-redux';
import {
  Box3,
  MathUtils,
  Matrix4,
  OrthographicCamera,
  PerspectiveCamera,
  Quaternion,
  Raycaster,
  Sphere,
  Spherical,
  Vector2,
  Vector3,
  Vector4,
} from 'three';
import type { RootState } from '../app/store';
import {
  CameraApiContext,
  bodyBounds,
  distanceLimits,
  fitDistance,
  presetPose,
  unionBounds,
  type CameraApi,
  type CameraDebugProbe,
  type Preset,
} from './camera';
import { useMeshRegistry } from './meshRegistry';

CameraControlsImpl.install({
  THREE: {
    Box3,
    MathUtils: { clamp: MathUtils.clamp },
    Matrix4,
    Quaternion,
    Raycaster,
    Sphere,
    Spherical,
    Vector2,
    Vector3,
    Vector4,
  },
});

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Owns CameraControls inside Canvas and implements CameraApi transitions and limits. */
export function CameraRig(): null {
  const controlsRef = useRef<CameraControlsImpl | null>(null);
  const initializedRef = useRef(false);
  const store = useStore<RootState>();
  const registry = useMeshRegistry();
  const controller = useContext(CameraApiContext);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);

  const sizeRef = useRef(size);
  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  useFrame((_, delta) => {
    if (controlsRef.current?.update(delta)) {
      invalidate();
    }
  }, -1);

  useEffect(() => {
    if (
      !(camera instanceof PerspectiveCamera) &&
      !(camera instanceof OrthographicCamera)
    ) {
      return;
    }

    const controls = new CameraControlsImpl(camera, gl.domElement);
    controlsRef.current = controls;
    controls.smoothTime = 0.25;
    controls.dollyToCursor = true;
    controls.mouseButtons.right = CameraControlsImpl.ACTION.TRUCK;
    controls.touches.two = CameraControlsImpl.ACTION.TOUCH_DOLLY_TRUCK;

    const triggerInvalidate = () => invalidate();
    controls.addEventListener('controlstart', triggerInvalidate);
    controls.addEventListener('control', triggerInvalidate);
    controls.addEventListener('transitionstart', triggerInvalidate);
    controls.addEventListener('update', triggerInvalidate);
    controls.addEventListener('wake', triggerInvalidate);

    const currentFov = camera instanceof PerspectiveCamera ? camera.fov : 35;

    const getAspect = () =>
      Math.max(1, sizeRef.current.width) / Math.max(1, sizeRef.current.height);

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
      getPose() {
        const pos = controls.getPosition(new Vector3());
        const tgt = controls.getTarget(new Vector3());
        return {
          position: [pos.x, pos.y, pos.z],
          target: [tgt.x, tgt.y, tgt.z],
        };
      },
      async setPose(pose, animate) {
        const manifest = store.getState().assets.manifest;
        if (manifest) {
          const body = bodyBounds(manifest);
          const limits = distanceLimits(null, body);
          controls.minDistance = Math.min(limits.min, 0.05);
          controls.maxDistance = limits.max;
        }
        const promise = controls.setLookAt(
          ...pose.position,
          ...pose.target,
          animate && !prefersReducedMotion(),
        );
        invalidate();
        await promise;
      },
      async lookAtPoint(world, distance = 0.4) {
        const manifest = store.getState().assets.manifest;
        if (manifest) {
          const body = bodyBounds(manifest);
          const limits = distanceLimits(null, body);
          controls.minDistance = Math.min(limits.min, 0.05);
          controls.maxDistance = limits.max;
        }
        const curPos = controls.getPosition(new Vector3());
        const curTgt = controls.getTarget(new Vector3());
        const dir = curPos.sub(curTgt);
        if (dir.lengthSq() < 1e-8) {
          dir.set(0, 0, 1);
        } else {
          dir.normalize();
        }
        const tx = world[0];
        const ty = world[1];
        const tz = world[2];
        const promise = controls.setLookAt(
          tx + dir.x * distance,
          ty + dir.y * distance,
          tz + dir.z * distance,
          tx,
          ty,
          tz,
          !prefersReducedMotion(),
        );
        invalidate();
        await promise;
      },
    };

    const probe: CameraDebugProbe = {
      screenPointOf(id) {
        const mesh = registry.get(id);
        if (!mesh) return null;
        camera.updateMatrixWorld();
        mesh.updateWorldMatrix(true, false);
        const box = new Box3().setFromObject(mesh);
        if (box.isEmpty()) return null;
        const center = box.getCenter(new Vector3()).project(camera);
        const rect = gl.domElement.getBoundingClientRect();
        return {
          x: rect.left + ((center.x + 1) / 2) * rect.width,
          y: rect.top + ((-center.y + 1) / 2) * rect.height,
        };
      },
      waitIdle() {
        return new Promise((resolve) => {
          if (!controls.active) {
            requestAnimationFrame(() => resolve());
            return;
          }
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            controls.removeEventListener('sleep', finish);
            window.clearTimeout(timer);
            requestAnimationFrame(() => resolve());
          };
          const timer = window.setTimeout(finish, 2000);
          controls.addEventListener('sleep', finish);
          invalidate();
        });
      },
    };

    const unbind = controller?.bind(impl, probe);

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
      controls.removeEventListener('controlstart', triggerInvalidate);
      controls.removeEventListener('control', triggerInvalidate);
      controls.removeEventListener('transitionstart', triggerInvalidate);
      controls.removeEventListener('update', triggerInvalidate);
      controls.removeEventListener('wake', triggerInvalidate);
      controls.dispose();
      controlsRef.current = null;
    };
  }, [store, registry, camera, gl, controller, invalidate]);

  return null;
}
