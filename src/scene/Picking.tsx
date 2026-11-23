import { useThree, type ThreeEvent } from '@react-three/fiber';
import {
  useCallback,
  useEffect,
  useRef,
  type JSX,
  type ReactNode,
} from 'react';
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
  const gl = useThree((s) => s.gl);

  const pressRef = useRef<ActivePress | null>(null);
  const activePointersRef = useRef(new Set<number>());
  const pickTimingRef = useRef({ count: 0, totalMs: 0 });
  const tapTrackerRef = useRef<ReturnType<typeof createTapTracker> | null>(
    null,
  );
  const onContextRequestRef = useRef(onContextRequest);

  useEffect(() => {
    onContextRequestRef.current = onContextRequest;
  }, [onContextRequest]);

  const clearPress = useCallback(() => {
    const press = pressRef.current;
    if (press?.timer !== null && press?.timer !== undefined) {
      window.clearTimeout(press.timer);
    }
    pressRef.current = null;
  }, []);

  const beginPress = useCallback(
    (p: {
      pointerId: number;
      pointerType: PointerKind;
      button: number;
      clientX: number;
      clientY: number;
      meshId: MeshId | null;
    }) => {
      clearPress();
      const press: ActivePress = {
        pointerId: p.pointerId,
        pointerType: p.pointerType,
        button: p.button,
        startX: p.clientX,
        startY: p.clientY,
        startT: performance.now(),
        meshId: p.meshId,
        longPressFired: false,
        timer: null,
      };

      if (p.pointerType !== 'mouse') {
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
    },
    [clearPress],
  );

  useEffect(() => {
    if (!tapTrackerRef.current) {
      tapTrackerRef.current = createTapTracker();
    }

    const handleDown = (ev: PointerEvent) => {
      activePointersRef.current.add(ev.pointerId);
      if (activePointersRef.current.size > 1) {
        clearPress();
        return;
      }
      if (ev.target !== gl.domElement) return;
      if (pressRef.current?.pointerId === ev.pointerId) return;

      const pointerType = toPointerKind(ev.pointerType);
      if (
        (pointerType === 'mouse' && ev.button === 2) ||
        pointerType !== 'mouse'
      ) {
        beginPress({
          pointerId: ev.pointerId,
          pointerType,
          button: ev.button,
          clientX: ev.clientX,
          clientY: ev.clientY,
          meshId: null,
        });
      }
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
      activePointersRef.current.delete(ev.pointerId);
      const press = pressRef.current;
      if (press && ev.pointerId === press.pointerId) {
        clearPress();
      }
    };

    const handleUp = (ev: PointerEvent) => {
      activePointersRef.current.delete(ev.pointerId);
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
        } else if (press.pointerType !== 'mouse' || press.button === 0) {
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

    const pointers = activePointersRef.current;
    window.addEventListener('pointerdown', handleDown);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleCancel);
    return () => {
      clearPress();
      pointers.clear();
      window.removeEventListener('pointerdown', handleDown);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleCancel);
    };
  }, [dispatch, cameraApi, gl, clearPress, beginPress]);

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    pointerPosition.set(e.clientX, e.clientY);
    if (toPointerKind(e.pointerType) !== 'mouse') return;
    if (e.buttons !== 0) {
      if (store.getState().selection.hoveredId !== null) {
        dispatch(hovered(null));
      }
      return;
    }

    let id: MeshId | null;
    if (import.meta.env.DEV && window.location.search.includes('debug')) {
      const t0 = performance.now();
      id = pickMeshId(e.intersections);
      const dt = performance.now() - t0;
      const stat = pickTimingRef.current;
      stat.totalMs += dt;
      stat.count += 1;
      if (stat.count === 100) {
        console.info(
          `[picking] 100 moves: ${stat.totalMs.toFixed(3)} ms total (${(stat.totalMs / 100).toFixed(4)} ms/move)`,
        );
        stat.count = 0;
        stat.totalMs = 0;
      }
    } else {
      id = pickMeshId(e.intersections);
    }

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
    if (activePointersRef.current.size >= 1) {
      clearPress();
      return;
    }
    beginPress({
      pointerId: e.pointerId,
      pointerType: toPointerKind(e.pointerType),
      button: e.button,
      clientX: e.clientX,
      clientY: e.clientY,
      meshId: pickMeshId(e.intersections),
    });
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
