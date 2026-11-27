import { CatmullRomCurve3, Vector3 } from 'three';
import type { Manifest, Vec3 } from '../../data/schema';
import type { Journey, PathItem } from './schema';

const ROUTE_SAMPLES = 2000;
const DEDUP_EPS = 0.0005; // 0.5 mm

export type JourneyRoute = {
  samples: Float32Array;
  tangents: Float32Array;
  length: number;
  stageStart: number[];
  stageEnd: number[];
  dashed: Array<[number, number]>;
  pointAt: (u: number, out: Vector3) => Vector3;
  tangentAt: (u: number, out: Vector3) => Vector3;
};

function anchorToWorld(
  anchor: readonly [number, number, number],
  bounds: { min: Vec3; max: Vec3 },
): Vec3 {
  return [
    bounds.min[0] + anchor[0] * (bounds.max[0] - bounds.min[0]),
    bounds.min[1] + anchor[1] * (bounds.max[1] - bounds.min[1]),
    bounds.min[2] + anchor[2] * (bounds.max[2] - bounds.min[2]),
  ];
}

function interpolateOnSegment(a: Vec3, b: Vec3, t: number): Vec3 {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function sliceLineByArcLength(
  poly: readonly Vec3[],
  from = 0,
  to = 1,
): Vec3[] {
  if (poly.length === 0) return [];
  if (poly.length === 1) return [[poly[0][0], poly[0][1], poly[0][2]]];

  const f = Math.max(0, Math.min(1, from));
  const t = Math.max(0, Math.min(1, to));
  if (f >= t) return [];

  const cum = new Float64Array(poly.length);
  for (let i = 1; i < poly.length; i += 1) {
    cum[i] =
      cum[i - 1] +
      Math.hypot(
        poly[i][0] - poly[i - 1][0],
        poly[i][1] - poly[i - 1][1],
        poly[i][2] - poly[i - 1][2],
      );
  }
  const total = cum[cum.length - 1];
  if (total === 0) return [[poly[0][0], poly[0][1], poly[0][2]]];

  const startDist = f * total;
  const endDist = t * total;

  const evalAtDist = (d: number): { idx: number; pt: Vec3 } => {
    let seg = 0;
    while (seg < cum.length - 2 && cum[seg + 1] < d) {
      seg += 1;
    }
    const segLen = cum[seg + 1] - cum[seg];
    const alpha = segLen > 0 ? (d - cum[seg]) / segLen : 0;
    return {
      idx: seg,
      pt: interpolateOnSegment(poly[seg], poly[seg + 1], alpha),
    };
  };

  const sHit = evalAtDist(startDist);
  const eHit = evalAtDist(endDist);
  const out: Vec3[] = [sHit.pt];
  for (let i = sHit.idx + 1; i <= eHit.idx; i += 1) {
    if (cum[i] > startDist + 1e-8 && cum[i] < endDist - 1e-8) {
      out.push([poly[i][0], poly[i][1], poly[i][2]]);
    }
  }
  out.push(eHit.pt);
  return out;
}

function resolvePathItem(
  item: PathItem,
  lines: Record<string, Vec3[]>,
  meshes: Manifest['meshes'],
): Vec3[] {
  if ('line' in item) {
    const poly = lines[item.line];
    if (!poly) {
      throw new Error(`route: missing centerline "${item.line}"`);
    }
    return sliceLineByArcLength(poly, item.from ?? 0, item.to ?? 1);
  }
  const mesh = meshes[item.mesh];
  if (!mesh) {
    throw new Error(`route: missing mesh "${item.mesh}"`);
  }
  return [anchorToWorld(item.anchor, mesh.bounds)];
}

function clamp01(u: number): number {
  if (!Number.isFinite(u)) return 0;
  return Math.max(0, Math.min(1, u));
}

function distVec3(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Builds a smooth centripetal Catmull-Rom route and arc-length lookup table for a journey. */
export function buildRoute(
  journey: Journey,
  lines: Record<string, Vec3[]>,
  meshes: Manifest['meshes'],
): JourneyRoute {
  const deduped: Vec3[] = [];
  const stageFirstIdx: number[] = [];

  for (const stage of journey.stages) {
    const stagePts: Vec3[] = [];
    for (const item of stage.path) {
      stagePts.push(...resolvePathItem(item, lines, meshes));
    }

    let recordedStart = false;
    for (const pt of stagePts) {
      if (deduped.length === 0) {
        stageFirstIdx.push(0);
        deduped.push(pt);
        recordedStart = true;
        continue;
      }
      const prev = deduped[deduped.length - 1];
      if (distVec3(prev, pt) < DEDUP_EPS) {
        if (!recordedStart) {
          stageFirstIdx.push(deduped.length - 1);
          recordedStart = true;
        }
        continue;
      }
      if (!recordedStart) {
        stageFirstIdx.push(deduped.length);
        recordedStart = true;
      }
      deduped.push(pt);
    }

    if (!recordedStart) {
      stageFirstIdx.push(Math.max(0, deduped.length - 1));
    }
  }

  if (deduped.length < 2) {
    throw new Error(`route: journey "${journey.id}" needs at least 2 distinct points`);
  }

  const curve = new CatmullRomCurve3(
    deduped.map((p) => new Vector3(p[0], p[1], p[2])),
    false,
    'centripetal',
  );
  curve.arcLengthDivisions = ROUTE_SAMPLES;
  curve.updateArcLengths();
  const length = curve.getLength();

  const samples = new Float32Array(ROUTE_SAMPLES * 3);
  const tangents = new Float32Array(ROUTE_SAMPLES * 3);
  const tmpPt = new Vector3();
  const tmpTan = new Vector3();

  for (let i = 0; i < ROUTE_SAMPLES; i += 1) {
    const u = i / (ROUTE_SAMPLES - 1);
    curve.getPointAt(u, tmpPt);
    curve.getTangentAt(u, tmpTan);
    const o = i * 3;
    samples[o] = tmpPt.x;
    samples[o + 1] = tmpPt.y;
    samples[o + 2] = tmpPt.z;
    tangents[o] = tmpTan.x;
    tangents[o + 1] = tmpTan.y;
    tangents[o + 2] = tmpTan.z;
  }

  // Compute exact normalized arc-length fraction u for each stage's first control point.
  const segCount = deduped.length - 1;
  const sub = 8;
  const divLengths = curve.getLengths(segCount * sub);
  const exactTotal = divLengths[divLengths.length - 1] || 1;

  const stageStart: number[] = new Array<number>(journey.stages.length);
  const stageEnd: number[] = new Array<number>(journey.stages.length);
  stageStart[0] = 0;

  for (let s = 1; s < journey.stages.length; s += 1) {
    const cpIdx = stageFirstIdx[s];
    const u = Math.max(
      stageStart[s - 1],
      Math.min(1, divLengths[cpIdx * sub] / exactTotal),
    );
    stageStart[s] = u;
    stageEnd[s - 1] = u;
  }
  stageEnd[journey.stages.length - 1] = 1;

  const dashed: Array<[number, number]> = [];
  for (let s = 0; s < journey.stages.length; s += 1) {
    if (!journey.stages[s].modelled && stageEnd[s] > stageStart[s]) {
      dashed.push([stageStart[s], stageEnd[s]]);
    }
  }

  const pointAt = (u: number, out: Vector3): Vector3 => {
    const scaled = clamp01(u) * (ROUTE_SAMPLES - 1);
    const lo = Math.floor(scaled);
    const hi = Math.min(ROUTE_SAMPLES - 1, lo + 1);
    const alpha = scaled - lo;
    const o0 = lo * 3;
    const o1 = hi * 3;
    return out.set(
      samples[o0] + (samples[o1] - samples[o0]) * alpha,
      samples[o0 + 1] + (samples[o1 + 1] - samples[o0 + 1]) * alpha,
      samples[o0 + 2] + (samples[o1 + 2] - samples[o0 + 2]) * alpha,
    );
  };

  const tangentAt = (u: number, out: Vector3): Vector3 => {
    const scaled = clamp01(u) * (ROUTE_SAMPLES - 1);
    const lo = Math.floor(scaled);
    const hi = Math.min(ROUTE_SAMPLES - 1, lo + 1);
    const alpha = scaled - lo;
    const o0 = lo * 3;
    const o1 = hi * 3;
    out.set(
      tangents[o0] + (tangents[o1] - tangents[o0]) * alpha,
      tangents[o0 + 1] + (tangents[o1 + 1] - tangents[o0 + 1]) * alpha,
      tangents[o0 + 2] + (tangents[o1 + 2] - tangents[o0 + 2]) * alpha,
    );
    if (out.lengthSq() === 0) {
      out.set(tangents[o0], tangents[o0 + 1], tangents[o0 + 2]);
    }
    return out.normalize();
  };

  return {
    samples,
    tangents,
    length,
    stageStart,
    stageEnd,
    dashed,
    pointAt,
    tangentAt,
  };
}

/** Returns the zero-based stage index corresponding to normalized arc-length progress `u`. */
export function stageAt(route: JourneyRoute, u: number): number {
  const clamped = clamp01(u);
  const count = route.stageStart.length;
  for (let s = 0; s < count; s += 1) {
    if (clamped < route.stageEnd[s] || s === count - 1) {
      return s;
    }
  }
  return Math.max(0, count - 1);
}

/** Returns normalized `[0, 1]` progress within `stageIndex` for global progress `u`. */
export function localProgress(
  route: JourneyRoute,
  stageIndex: number,
  u: number,
): number {
  const idx = Math.max(0, Math.min(route.stageStart.length - 1, stageIndex));
  const start = route.stageStart[idx];
  const end = route.stageEnd[idx];
  const span = end - start;
  if (span <= 0) return u >= end ? 1 : 0;
  return clamp01((u - start) / span);
}
