import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Raycaster, Vector3, type Mesh } from 'three';
import { useAppSelector } from '../app/hooks';
import { pinScreens, projectPins } from '../features/pins/pinProjection';
import { useMeshRegistry } from './meshRegistry';

const MAX_OCCLUSION_CHECKS_PER_FRAME = 50;

/** Canvas-internal probe projecting active pins to viewport coordinates with round-robin occlusion. */
export function PinProbe(): null {
  const pins = useAppSelector((s) => s.pins.items);
  const quizActive = useAppSelector((s) => s.quiz.status !== 'off');
  const registry = useMeshRegistry();
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const cursorRef = useRef(0);
  const dimmedCacheRef = useRef(new Map<string, boolean>());
  const raycasterRef = useRef<Raycaster | null>(null);

  useEffect(() => {
    if (quizActive || pins.length === 0) {
      pinScreens.set([]);
    }
  }, [quizActive, pins.length]);

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
    const camPos = camera.position.clone();
    const pickables: Mesh[] = [];
    for (const id of registry.ids()) {
      const m = registry.get(id);
      if (m && m.visible && m.userData?.pickable === true) {
        pickables.push(m);
      }
    }

    let checksLeft = MAX_OCCLUSION_CHECKS_PER_FRAME;
    const total = pins.length;
    const startIdx = total > 0 ? cursorRef.current % total : 0;
    const checkSet = new Set<string>();
    const countToCheck = Math.min(total, MAX_OCCLUSION_CHECKS_PER_FRAME);
    for (let i = 0; i < countToCheck; i++) {
      checkSet.add(pins[(startIdx + i) % total].id);
    }
    if (total > 0) {
      cursorRef.current = (startIdx + countToCheck) % total;
    }

    const next = projectPins({
      pins,
      registry,
      camera,
      size,
      occlusion: (pin, world) => {
        if (!checkSet.has(pin.id) || checksLeft <= 0) {
          return dimmedCacheRef.current.get(pin.id) ?? false;
        }
        checksLeft -= 1;
        const pinMesh = registry.get(pin.meshId);
        const dir = new Vector3().subVectors(world, camPos);
        const dist = dir.length();
        if (dist <= 0.01) {
          dimmedCacheRef.current.set(pin.id, false);
          return false;
        }
        raycaster.set(camPos, dir.normalize());
        raycaster.far = dist - 0.01;
        const hits = raycaster.intersectObjects(pickables, false);
        const occluded =
          hits.length > 0 &&
          hits[0].object !== pinMesh &&
          hits[0].distance < dist - 0.01;
        dimmedCacheRef.current.set(pin.id, occluded);
        return occluded;
      },
    });

    pinScreens.set(next);
  });

  return null;
}
