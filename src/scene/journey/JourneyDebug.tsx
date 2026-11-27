import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, type JSX } from 'react';
import {
  Color,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Vector3,
} from 'three';
import { useAppSelector } from '../../app/hooks';
import { getRoute, stageAt } from '../../features/journey/route';
import { useMeshRegistry } from '../meshRegistry';

const POS_DIRS = [
  new Vector3(1, 0, 0),
  new Vector3(0, 1, 0),
  new Vector3(0, 0, 1),
] as const;

function isPointInsideBrowserMeshes(
  raycaster: Raycaster,
  origin: Vector3,
  meshes: ReadonlyArray<Mesh>,
): boolean {
  for (const mesh of meshes) {
    let oddVotes = 0;
    for (let axis = 0; axis < 3; axis += 1) {
      raycaster.set(origin, POS_DIRS[axis]);
      raycaster.firstHitOnly = false;
      const hits = raycaster.intersectObject(mesh, false);
      if (hits.length % 2 === 1) oddVotes += 1;
    }
    if (oddVotes >= 2) return true;
  }
  return false;
}

/** Dev-only `?journey-debug` overlay drawing route samples (green/red) and stage boundaries. */
export function JourneyDebug(): JSX.Element | null {
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const registry = useMeshRegistry();
  const defs = useAppSelector((s) => s.journey.defs);
  const centerlines = useAppSelector((s) => s.journey.centerlines);
  const activeId = useAppSelector((s) => s.journey.activeId);
  const manifest = useAppSelector((s) => s.assets.manifest);

  const journey = useMemo(
    () =>
      defs && activeId ? (defs.find((d) => d.id === activeId) ?? null) : null,
    [defs, activeId],
  );

  useEffect(() => {
    if (!journey || !centerlines || !manifest) return undefined;
    const route = getRoute(journey, centerlines.lines, manifest.meshes);
    const stepM = 0.02;
    const sampleCount = Math.max(8, Math.ceil(route.length / stepM));
    const boundaryCount = route.stageStart.length;
    const total = sampleCount + boundaryCount;

    const geom = new IcosahedronGeometry(1, 1);
    const mat = new MeshBasicMaterial();
    const points = new InstancedMesh(geom, mat, total);
    points.name = 'journey-debug-points';
    points.raycast = () => {};
    points.frustumCulled = false;

    const m = new Matrix4();
    const p = new Vector3();
    const raycaster = new Raycaster();
    const green = new Color('#22c55e');
    const red = new Color('#ef4444');
    const yellow = new Color('#eab308');

    for (let i = 0; i < sampleCount; i += 1) {
      const u = i / Math.max(1, sampleCount - 1);
      route.pointAt(u, p);
      const sIdx = stageAt(route, u);
      const st = journey.stages[sIdx];
      const targets = (st?.inside ?? [])
        .map((id) => registry.get(id))
        .filter((obj): obj is Mesh => obj instanceof Mesh);

      const ok =
        targets.length === 0 || isPointInsideBrowserMeshes(raycaster, p, targets);
      m.makeTranslation(p.x, p.y, p.z).scale(new Vector3(0.0022, 0.0022, 0.0022));
      points.setMatrixAt(i, m);
      points.setColorAt(i, ok ? green : red);
    }

    for (let b = 0; b < boundaryCount; b += 1) {
      route.pointAt(route.stageStart[b], p);
      m.makeTranslation(p.x, p.y, p.z).scale(new Vector3(0.004, 0.004, 0.004));
      points.setMatrixAt(sampleCount + b, m);
      points.setColorAt(sampleCount + b, yellow);
    }

    points.instanceMatrix.needsUpdate = true;
    if (points.instanceColor) points.instanceColor.needsUpdate = true;

    const grp = new Group();
    grp.name = 'journey-debug-group';
    grp.add(points);
    scene.add(grp);
    invalidate();

    return () => {
      scene.remove(grp);
      geom.dispose();
      mat.dispose();
      invalidate();
    };
  }, [journey, centerlines, manifest, registry, scene, invalidate]);

  return null;
}
