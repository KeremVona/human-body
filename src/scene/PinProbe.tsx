import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Raycaster, Vector3, type Mesh } from 'three';
import { useAppSelector } from '../app/hooks';
import {
  collectProjectedPins,
  isPinRayOccluded,
  pinScreens,
  selectOcclusionBatch,
} from '../features/pins/pinProjection';
import { attachMeshBvh } from './bvh';
import { useMeshRegistry } from './meshRegistry';
import { sectionPlaneStore } from './sectionPlaneStore';

const MAX_OCCLUSION_CHECKS_PER_FRAME = 50;

/** Canvas-internal probe projecting visible pins with round-robin occlusion up to 50 checks/frame. */
export function PinProbe(): null {
  const pins = useAppSelector((s) => s.pins.items);
  const quizActive = useAppSelector((s) => s.quiz.status !== 'off');
  const registry = useMeshRegistry();
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);

  const cursorRef = useRef(0);
  const dimmedCacheRef = useRef(new Map<string, boolean>());
  const raycasterRef = useRef<Raycaster | null>(null);

  useEffect(() => {
    if (quizActive || pins.length === 0) {
      pinScreens.set([]);
      return;
    }
    invalidate();
  }, [quizActive, pins, invalidate]);

  useEffect(() => {
    return () => {
      pinScreens.set([]);
    };
  }, []);

  useFrame(() => {
    if (quizActive || pins.length === 0) {
      pinScreens.set([]);
      return;
    }

    if (!raycasterRef.current) {
      const r = new Raycaster();
      Object.assign(r, { firstHitOnly: true });
      raycasterRef.current = r;
    }
    const raycaster = raycasterRef.current;
    const clip = sectionPlaneStore.get();
    Object.assign(raycaster, { firstHitOnly: !clip });
    const camPos = camera.position.clone();
    const pickables: Mesh[] = [];
    for (const id of registry.ids()) {
      const m = registry.get(id);
      if (
        m &&
        m.userData?.atlasVisible === true &&
        m.userData?.pickable === true
      ) {
        attachMeshBvh(m);
        pickables.push(m);
      }
    }

    const candidates = collectProjectedPins({ pins, registry, camera, size });
    const inViewport = candidates.filter(
      (c) =>
        c.x >= -16 &&
        c.x <= size.width + 16 &&
        c.y >= -16 &&
        c.y <= size.height + 16,
    );
    const { batch: checkSet, nextCursor } = selectOcclusionBatch(
      inViewport,
      cursorRef.current,
      MAX_OCCLUSION_CHECKS_PER_FRAME,
    );
    cursorRef.current = nextCursor;

    const next = candidates.map(({ pin, x, y, world }) => {
      let dimmed = dimmedCacheRef.current.get(pin.id) ?? false;
      if (checkSet.has(pin.id)) {
        const pinMesh = registry.get(pin.meshId);
        const dir = new Vector3().subVectors(world, camPos);
        const dist = dir.length();
        if (dist <= 0.01) {
          dimmed = false;
        } else {
          raycaster.set(camPos, dir.normalize());
          raycaster.far = dist - 0.01;
          const hits = raycaster.intersectObjects(pickables, false);
          dimmed = isPinRayOccluded({
            hits,
            pinMesh,
            maxDistance: dist - 0.01,
            clip,
          });
        }
        dimmedCacheRef.current.set(pin.id, dimmed);
      }
      return { id: pin.id, x, y, dimmed };
    });

    pinScreens.set(next);
  });

  return null;
}
