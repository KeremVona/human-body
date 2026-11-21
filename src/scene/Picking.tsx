import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useRef, type JSX, type ReactNode } from 'react';
import { useStore } from 'react-redux';
import { useAppDispatch } from '../app/hooks';
import type { RootState } from '../app/store';
import type { MeshId } from '../data/ids';
import {
  hovered,
  selected,
  selectionCleared,
} from '../features/selection/selectionSlice';
import { useCameraApi } from './camera';
import {
  LONG_PRESS_MS,
  STATIONARY_PX,
  classifyRelease,
  createTapTracker,
  pickMeshId,
  type PointerKind,
} from './gestures';
import { pointerPosition } from './pointerPosition';

export type ContextRequest = {
  x: number;
  y: number;
  meshId: MeshId | null;
};

type ActivePress = {
  pointerId: number;
  pointerType: PointerKind;
  button: number;
  startX: number;
  startY: number;
  startT: number;
  meshId: MeshId | null;
  longPressFired: boolean;
  timer: number | null;
};

function toPointerKind(pointerType: string): PointerKind {
  if (pointerType === 'touch') return 'touch';
  if (pointerType === 'pen') return 'pen';
  return 'mouse';
}

/** Handles hover, click/tap selection, double-tap tracking, right-click, and long-press on 3D meshes. */
export function Picking({
  onContextRequest,
  children,
}: {
  onContextRequest: (p: ContextRequest) => void;
  children: ReactNode;
}): JSX.Element {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const cameraApi = useCameraApi();

  const pressRef = useRef<ActivePress | null>(null);
  const tapTrackerRef = useRef<ReturnType<typeof createTapTracker> | null>(
    null,
  );
  const onContextRequestRef = useRef(onContextRequest);

  useEffect(() => {
    onContextRequestRef.current = onContextRequest;
  }, [onContextRequest]);

  useEffect(() => {
    if (!tapTrackerRef.current) {
      tapTrackerRef.current = createTapTracker();
    }
    const clearPress = () => {
      const press = pressRef.current;
      if (press?.timer !== null && press?.timer !== undefined) {
        window.clearTimeout(press.timer);
      }
      pressRef.current = null;
    };

    const handleMove = (ev: PointerEvent) => {
      const press = pressRef.current;
      if (!press || ev.pointerId !== press.pointerId) return;
      if (
        press.timer !== null &&
        Math.hypot(ev.clientX - press.startX, ev.clientY - press.startY) >
          STATIONARY_PX
      ) {
        window.clearTimeout(press.timer);
        press.timer = null;
      }
    };

    const handleCancel = (ev: PointerEvent) => {
      const press = pressRef.current;
      if (press && ev.pointerId === press.pointerId) {
        clearPress();
      }
    };

    const handleUp = (ev: PointerEvent) => {
      const press = pressRef.current;
      if (!press || ev.pointerId !== press.pointerId) return;
      clearPress();
      if (press.longPressFired) return;

      const release = classifyRelease({
        button: press.button,
        pointerType: press.pointerType,
        dx: ev.clientX - press.startX,
        dy: ev.clientY - press.startY,
        ms: performance.now() - press.startT,
      });

      if (release === 'click') {
        if (press.meshId) {
          dispatch(selected([press.meshId]));
          if (
            tapTrackerRef.current?.tap({
              x: ev.clientX,
              y: ev.clientY,
              t: performance.now(),
            }) === 'double'
          ) {
            void cameraApi.focusMeshes([press.meshId]);
          }
        } else {
          dispatch(selectionCleared());
        }
      } else if (release === 'context' || release === 'long-press') {
        onContextRequestRef.current({
          x: ev.clientX,
          y: ev.clientY,
          meshId: press.meshId,
        });
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleCancel);
    return () => {
      clearPress();
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleCancel);
    };
  }, [dispatch, cameraApi]);

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    pointerPosition.set(e.clientX, e.clientY);
    if (toPointerKind(e.pointerType) !== 'mouse') return;

    const id = pickMeshId(e.intersections);
    if (id !== store.getState().selection.hoveredId) {
      dispatch(hovered(id));
    }
  };

  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    if (toPointerKind(e.pointerType) !== 'mouse') return;

    const next = pickMeshId(e.intersections);
    if (next !== store.getState().selection.hoveredId) {
      dispatch(hovered(next));
    }
  };

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (
      pressRef.current?.timer !== null &&
      pressRef.current?.timer !== undefined
    ) {
      window.clearTimeout(pressRef.current.timer);
    }

    const pointerType = toPointerKind(e.pointerType);
    const meshId = pickMeshId(e.intersections);
    const press: ActivePress = {
      pointerId: e.pointerId,
      pointerType,
      button: e.button,
      startX: e.clientX,
      startY: e.clientY,
      startT: performance.now(),
      meshId,
      longPressFired: false,
      timer: null,
    };

    if (pointerType !== 'mouse') {
      press.timer = window.setTimeout(() => {
        if (pressRef.current === press) {
          press.longPressFired = true;
          press.timer = null;
          onContextRequestRef.current({
            x: press.startX,
            y: press.startY,
            meshId: press.meshId,
          });
        }
      }, LONG_PRESS_MS);
    }

    pressRef.current = press;
  };

  return (
    <group
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
      onPointerDown={handlePointerDown}
    >
      {children}
    </group>
  );
}
