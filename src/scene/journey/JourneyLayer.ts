import {
  Curve,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Quaternion,
  ShaderMaterial,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import type { Vec3 } from '../../data/schema';
import type { JourneyRoute } from '../../features/journey/route';
import { stageAt } from '../../features/journey/route';
import { BITE_LOOKS, cloneLook, type BiteLook } from './biteLook';
import { createRouteMaterial } from './routeMaterial';

export const RING_COUNT = 3;
export const DROPLET_COUNT = 40;

const noopRaycast = () => {};
const Z_AXIS = new Vector3(0, 0, 1);
const Y_AXIS = new Vector3(0, 1, 0);
const _pos = new Vector3();
const _tan = new Vector3();
const _quat = new Quaternion();
const _scale = new Vector3();
const _tmpMat = new Matrix4();

function clamp01(u: number): number {
  if (!Number.isFinite(u)) return 0;
  return Math.min(1, Math.max(0, u));
}

class RouteSampleCurve extends Curve<Vector3> {
  private readonly route: JourneyRoute;
  constructor(route: JourneyRoute) {
    super();
    this.route = route;
  }
  override getPoint(t: number, optionalTarget = new Vector3()): Vector3 {
    return this.route.pointAt(t, optionalTarget);
  }
  override getTangent(t: number, optionalTarget = new Vector3()): Vector3 {
    return this.route.tangentAt(t, optionalTarget);
  }
}

export type CenterlineTable = {
  cumLengths: Float64Array;
  points: Float32Array;
  totalLength: number;
};

/** Pre-builds an arc-length table for streaming droplets along a duct centerline. */
export function buildCenterlineTable(poly: readonly Vec3[]): CenterlineTable {
  const n = poly.length;
  const points = new Float32Array(n * 3);
  const cumLengths = new Float64Array(n);
  let total = 0;

  for (let i = 0; i < n; i += 1) {
    points[i * 3] = poly[i][0];
    points[i * 3 + 1] = poly[i][1];
    points[i * 3 + 2] = poly[i][2];
    if (i > 0) {
      total += Math.hypot(
        poly[i][0] - poly[i - 1][0],
        poly[i][1] - poly[i - 1][1],
        poly[i][2] - poly[i - 1][2],
      );
      cumLengths[i] = total;
    }
  }
  return { cumLengths, points, totalLength: total };
}

/** Zero-allocation sample of `table` at normalized arc fraction `u` into `out`. */
export function sampleCenterlineTable(
  table: CenterlineTable,
  u: number,
  out: Vector3,
): Vector3 {
  const count = table.cumLengths.length;
  if (count === 0) return out.set(0, 0, 0);
  if (count === 1 || table.totalLength <= 0) {
    return out.set(table.points[0], table.points[1], table.points[2]);
  }
  const target = clamp01(u) * table.totalLength;
  let seg = 0;
  while (seg < count - 2 && table.cumLengths[seg + 1] < target) {
    seg += 1;
  }
  const segLen = table.cumLengths[seg + 1] - table.cumLengths[seg];
  const alpha = segLen > 0 ? (target - table.cumLengths[seg]) / segLen : 0;
  const o0 = seg * 3;
  const o1 = (seg + 1) * 3;
  return out.set(
    table.points[o0] + (table.points[o1] - table.points[o0]) * alpha,
    table.points[o0 + 1] + (table.points[o1 + 1] - table.points[o0 + 1]) * alpha,
    table.points[o0 + 2] + (table.points[o1 + 2] - table.points[o0 + 2]) * alpha,
  );
}

/** Advances journey progress `u` by `delta` seconds so each stage spans its `durationS / speed`. */
export function advanceJourneyProgress(
  route: JourneyRoute,
  durationsS: readonly number[],
  u: number,
  delta: number,
  speed: number,
): number {
  let remDt = Math.min(Math.max(0, delta), 0.1) * speed;
  let curU = clamp01(u);
  const stageCount = route.stageStart.length;

  while (remDt > 1e-7 && curU < 1) {
    const s = stageAt(route, curU);
    const spanU = route.stageEnd[s] - route.stageStart[s];
    const durS = Math.max(0.01, durationsS[s] ?? 1);
    if (spanU <= 0) {
      if (s + 1 >= stageCount) {
        curU = 1;
        break;
      }
      curU = route.stageEnd[s];
      continue;
    }
    const rate = spanU / durS;
    const stepU = remDt * rate;
    const endU = s === stageCount - 1 ? 1 : route.stageEnd[s];
    if (curU + stepU <= endU) {
      curU += stepU;
      remDt = 0;
    } else {
      const usedU = Math.max(0, endU - curU);
      remDt -= usedU / rate;
      curU = endU;
    }
  }
  return clamp01(curU);
}

/** Orient a vector along `+Z` to unit tangent `tan` with antiparallel fallback. */
function orientToTangent(tan: Vector3, quat: Quaternion): void {
  if (tan.z < -0.9999) {
    quat.setFromAxisAngle(Y_AXIS, Math.PI);
  } else {
    quat.setFromUnitVectors(Z_AXIS, tan);
  }
}

/** Computes world matrices for the 3 peristaltic squeeze rings behind the bite without allocations. */
export function ringTransforms(
  route: JourneyRoute,
  u: number,
  radius: number,
  timeS: number,
  out: Matrix4[],
): void {
  const safeLen = Math.max(route.length, 1e-4);
  const count = Math.min(RING_COUNT, out.length);
  for (let i = 0; i < count; i += 1) {
    const ringU = Math.max(0, clamp01(u) - ((i + 1) * 1.2 * radius) / safeLen);
    route.pointAt(ringU, _pos);
    route.tangentAt(ringU, _tan);
    orientToTangent(_tan, _quat);
    const squeeze = 0.5 + 0.5 * Math.sin(timeS * 5 - i * 1.15);
    const rScale = radius * (1.25 - 0.25 * squeeze);
    _scale.set(rScale, rScale, rScale);
    out[i].compose(_pos, _quat, _scale);
  }
}

export type JourneyLayer = {
  group: Group;
  routeMaterial: ShaderMaterial;
  biteMesh: Mesh<IcosahedronGeometry, MeshPhysicalMaterial>;
  ringsMesh: InstancedMesh<TorusGeometry, MeshStandardMaterial>;
  dropletsMesh: InstancedMesh<IcosahedronGeometry, MeshPhysicalMaterial>;
  visibleDrawCalls: () => number;
  updateProgress: (u: number) => void;
  updateBite: (pos: Vector3, radius: number, look: BiteLook) => void;
  updateRings: (
    active: boolean,
    route: JourneyRoute,
    u: number,
    radius: number,
    timeS: number,
  ) => void;
  updateDroplets: (table: CenterlineTable | null, phase: number) => void;
  dispose: () => void;
};

/** Constructs the imperative 3D objects for a journey (<= 4 draw calls, non-pickable). */
export function createJourneyLayer(route: JourneyRoute): JourneyLayer {
  const group = new Group();
  group.name = 'journey-layer';

  const curve = new RouteSampleCurve(route);
  const routeGeometry = new TubeGeometry(curve, 1000, 0.0012, 6, false);
  const routeMaterial = createRouteMaterial(route.length, route.dashed);
  const routeMesh = new Mesh(routeGeometry, routeMaterial);
  routeMesh.name = 'journey-route';
  routeMesh.raycast = noopRaycast;
  routeMesh.renderOrder = 15;
  group.add(routeMesh);

  const initLook = cloneLook(BITE_LOOKS.bolus);
  const biteGeometry = new IcosahedronGeometry(1, 3);
  const biteMaterial = new MeshPhysicalMaterial({
    color: initLook.color.clone(),
    roughness: initLook.roughness,
    metalness: 0,
    clearcoat: 0.45,
    clearcoatRoughness: 0.2,
    transmission: initLook.transmission,
    thickness: 0.012,
  });
  const biteMesh = new Mesh(biteGeometry, biteMaterial);
  biteMesh.name = 'journey-bite';
  biteMesh.raycast = noopRaycast;
  biteMesh.renderOrder = 16;
  group.add(biteMesh);

  const ringsGeometry = new TorusGeometry(1, 0.18, 8, 24);
  const ringsMaterial = new MeshStandardMaterial({
    color: '#6FA8FF',
    emissive: '#6FA8FF',
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.72,
    roughness: 0.35,
    depthWrite: false,
  });
  const ringsMesh = new InstancedMesh(ringsGeometry, ringsMaterial, RING_COUNT);
  ringsMesh.name = 'journey-rings';
  ringsMesh.frustumCulled = false;
  ringsMesh.raycast = noopRaycast;
  ringsMesh.renderOrder = 17;
  ringsMesh.count = 0;
  ringsMesh.visible = false;
  group.add(ringsMesh);

  const dropletsGeometry = new IcosahedronGeometry(1, 1);
  const dropletsMaterial = new MeshPhysicalMaterial({
    color: '#9fe6a0',
    emissive: '#4fa85a',
    emissiveIntensity: 0.4,
    roughness: 0.2,
    transmission: 0.35,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const dropletsMesh = new InstancedMesh(
    dropletsGeometry,
    dropletsMaterial,
    DROPLET_COUNT,
  );
  dropletsMesh.name = 'journey-droplets';
  dropletsMesh.frustumCulled = false;
  dropletsMesh.raycast = noopRaycast;
  dropletsMesh.renderOrder = 17;
  dropletsMesh.count = 0;
  dropletsMesh.visible = false;
  group.add(dropletsMesh);

  const ringMatrices = Array.from({ length: RING_COUNT }, () => new Matrix4());
  const dropletQuat = new Quaternion();
  const dropletScale = new Vector3(0.0015, 0.0015, 0.0015);

  return {
    group,
    routeMaterial,
    biteMesh,
    ringsMesh,
    dropletsMesh,
    visibleDrawCalls() {
      return (
        2 + (ringsMesh.visible && ringsMesh.count > 0 ? 1 : 0) +
        (dropletsMesh.visible && dropletsMesh.count > 0 ? 1 : 0)
      );
    },
    updateProgress(u) {
      routeMaterial.uniforms.uProgress.value = clamp01(u);
    },
    updateBite(pos, radius, look) {
      biteMesh.position.copy(pos);
      biteMesh.scale.setScalar(radius);
      biteMaterial.color.copy(look.color);
      biteMaterial.roughness = look.roughness;
      biteMaterial.transmission = look.transmission;
    },
    updateRings(active, targetRoute, u, radius, timeS) {
      if (!active) {
        ringsMesh.count = 0;
        ringsMesh.visible = false;
        return;
      }
      ringsMesh.visible = true;
      ringsMesh.count = RING_COUNT;
      ringTransforms(targetRoute, u, radius, timeS, ringMatrices);
      for (let i = 0; i < RING_COUNT; i += 1) {
        ringsMesh.setMatrixAt(i, ringMatrices[i]);
      }
      ringsMesh.instanceMatrix.needsUpdate = true;
    },
    updateDroplets(table, phase) {
      if (!table || table.cumLengths.length < 2) {
        dropletsMesh.count = 0;
        dropletsMesh.visible = false;
        return;
      }
      dropletsMesh.visible = true;
      dropletsMesh.count = DROPLET_COUNT;
      for (let i = 0; i < DROPLET_COUNT; i += 1) {
        const frac = (phase * 0.3 + i / DROPLET_COUNT) % 1;
        sampleCenterlineTable(table, frac, _pos);
        _tmpMat.compose(_pos, dropletQuat, dropletScale);
        dropletsMesh.setMatrixAt(i, _tmpMat);
      }
      dropletsMesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      routeGeometry.dispose();
      routeMaterial.dispose();
      biteGeometry.dispose();
      biteMaterial.dispose();
      ringsGeometry.dispose();
      ringsMaterial.dispose();
      dropletsGeometry.dispose();
      dropletsMaterial.dispose();
    },
  };
}
