import { createHash } from 'node:crypto';
import {
  existsSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import {
  CenterlinesFileSchema,
  type CenterlinesFile,
} from '../../src/data/centerlines';
import type { Manifest } from '../../src/data/schema';
import type { PipelineConfig } from './config';

export type Vec3 = [number, number, number];
export type Bounds = { min: Vec3; max: Vec3 };

/** Maps a `[0, 1]^3` normalised anchor inside `b` into model coordinates. */
export function anchorPoint(
  anchor: readonly [number, number, number],
  b: Bounds,
): Vec3 {
  return [
    b.min[0] + anchor[0] * (b.max[0] - b.min[0]),
    b.min[1] + anchor[1] * (b.max[1] - b.min[1]),
    b.min[2] + anchor[2] * (b.max[2] - b.min[2]),
  ];
}

const AXIS_INDEX: Record<'x' | 'y' | 'z', 0 | 1 | 2> = {
  x: 0,
  y: 1,
  z: 2,
};

const PLANE_AXES: Record<'xy' | 'xz' | 'yz', [0 | 1 | 2, 0 | 1 | 2]> = {
  xy: [0, 1],
  xz: [0, 2],
  yz: [1, 2],
};

function roundTo4(n: number): number {
  const r = Math.round(n * 10_000) / 10_000;
  return Object.is(r, -0) ? 0 : r;
}

/** Rounds a 3D point to 4 decimal places without `-0`. */
export function round4(p: readonly [number, number, number]): Vec3 {
  return [roundTo4(p[0]), roundTo4(p[1]), roundTo4(p[2])];
}

/** Bins vertices along `axis` and returns each non-empty bin's 3D centroid ordered by `direction`. */
export function sliceCenterline(
  positions: Float32Array,
  axis: 'x' | 'y' | 'z',
  bins: number,
  direction: 1 | -1,
): Vec3[] {
  const count = Math.floor(positions.length / 3);
  if (count === 0 || bins <= 0) return [];

  const idx = AXIS_INDEX[axis];
  let minVal = Infinity;
  let maxVal = -Infinity;
  for (let i = 0; i < count; i += 1) {
    const v = positions[i * 3 + idx];
    if (v < minVal) minVal = v;
    if (v > maxVal) maxVal = v;
  }
  const span = maxVal - minVal;
  if (span <= 0) {
    return [[positions[0], positions[1], positions[2]]];
  }

  const sumX = new Float64Array(bins);
  const sumY = new Float64Array(bins);
  const sumZ = new Float64Array(bins);
  const counts = new Uint32Array(bins);

  for (let i = 0; i < count; i += 1) {
    const o = i * 3;
    const t = (positions[o + idx] - minVal) / span;
    const bin = Math.min(bins - 1, Math.max(0, Math.floor(t * bins)));
    sumX[bin] += positions[o];
    sumY[bin] += positions[o + 1];
    sumZ[bin] += positions[o + 2];
    counts[bin] += 1;
  }

  const pts: Vec3[] = [];
  for (let b = 0; b < bins; b += 1) {
    const k = direction === 1 ? b : bins - 1 - b;
    const n = counts[k];
    if (n > 0) {
      pts.push([sumX[k] / n, sumY[k] / n, sumZ[k] / n]);
    }
  }
  return pts;
}

/** Bins vertices by polar angle around `center` in `plane` starting at `startDeg` along `sweep`. */
export function polarCenterline(
  positions: Float32Array,
  opts: {
    center: Vec3;
    plane: 'xy' | 'xz' | 'yz';
    bins: number;
    startDeg: number;
    sweep: 1 | -1;
  },
): Vec3[] {
  const count = Math.floor(positions.length / 3);
  if (count === 0 || opts.bins <= 0) return [];

  const [axA, axB] = PLANE_AXES[opts.plane];
  const bins = opts.bins;
  const sumX = new Float64Array(bins);
  const sumY = new Float64Array(bins);
  const sumZ = new Float64Array(bins);
  const counts = new Uint32Array(bins);

  for (let i = 0; i < count; i += 1) {
    const o = i * 3;
    const da = positions[o + axA] - opts.center[axA];
    const db = positions[o + axB] - opts.center[axB];
    const deg = (Math.atan2(db, da) * 180) / Math.PI;
    const rawOffset =
      opts.sweep === 1 ? deg - opts.startDeg : opts.startDeg - deg;
    let offset = ((rawOffset % 360) + 360) % 360;
    if (offset >= 360 - 0.01) offset = 0;
    const bin = Math.min(bins - 1, Math.max(0, Math.floor((offset / 360) * bins)));
    sumX[bin] += positions[o];
    sumY[bin] += positions[o + 1];
    sumZ[bin] += positions[o + 2];
    counts[bin] += 1;
  }

  const pts: Vec3[] = [];
  for (let b = 0; b < bins; b += 1) {
    const n = counts[b];
    if (n > 0) {
      pts.push([sumX[b] / n, sumY[b] / n, sumZ[b] / n]);
    }
  }
  return pts;
}

/** Applies a centered moving-average filter while keeping the original endpoints fixed. */
export function smooth(points: readonly Vec3[], window = 5): Vec3[] {
  if (points.length <= 2 || window <= 1) {
    return points.map((p) => [p[0], p[1], p[2]]);
  }
  const half = Math.floor(window / 2);
  return points.map((pt, idx) => {
    if (idx === 0 || idx === points.length - 1) {
      return [pt[0], pt[1], pt[2]];
    }
    const lo = Math.max(0, idx - half);
    const hi = Math.min(points.length - 1, idx + half);
    let sx = 0;
    let sy = 0;
    let sz = 0;
    const n = hi - lo + 1;
    for (let j = lo; j <= hi; j += 1) {
      sx += points[j][0];
      sy += points[j][1];
      sz += points[j][2];
    }
    return [sx / n, sy / n, sz / n];
  });
}

/** Uniformly resamples a polyline by arc length to at most `maxPoints` while preserving endpoints. */
export function resample(points: readonly Vec3[], maxPoints = 200): Vec3[] {
  if (points.length <= maxPoints || points.length <= 2) {
    return points.map((p) => [p[0], p[1], p[2]]);
  }
  const targetCount = Math.max(2, maxPoints);
  const cum = new Float64Array(points.length);
  for (let i = 1; i < points.length; i += 1) {
    const dx = points[i][0] - points[i - 1][0];
    const dy = points[i][1] - points[i - 1][1];
    const dz = points[i][2] - points[i - 1][2];
    cum[i] = cum[i - 1] + Math.hypot(dx, dy, dz);
  }
  const total = cum[cum.length - 1];
  if (total === 0) {
    return [
      [points[0][0], points[0][1], points[0][2]],
      [points[points.length - 1][0], points[points.length - 1][1], points[points.length - 1][2]],
    ];
  }

  const out: Vec3[] = [[points[0][0], points[0][1], points[0][2]]];
  let seg = 0;
  for (let i = 1; i < targetCount - 1; i += 1) {
    const targetLen = (total * i) / (targetCount - 1);
    while (seg < cum.length - 2 && cum[seg + 1] < targetLen) {
      seg += 1;
    }
    const segLen = cum[seg + 1] - cum[seg];
    const t = segLen > 0 ? (targetLen - cum[seg]) / segLen : 0;
    const a = points[seg];
    const b = points[seg + 1];
    out.push([
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ]);
  }
  const last = points[points.length - 1];
  out.push([last[0], last[1], last[2]]);
  return out;
}

/** Extracts world-space vertex positions for each requested mesh name from an unquantized raw GLB. */
export async function extractMeshPositions(
  glbBytes: Uint8Array,
  targetIds: ReadonlySet<string>,
): Promise<Map<string, Float32Array>> {
  const io = new NodeIO();
  const doc = await io.readBinary(glbBytes);
  const found = new Map<string, Float32Array>();

  for (const node of doc.getRoot().listNodes()) {
    const id = node.getName();
    if (!targetIds.has(id)) continue;
    const mesh = node.getMesh();
    if (!mesh) continue;

    const wm = node.getWorldMatrix();
    const chunks: Float32Array[] = [];
    let totalLen = 0;

    for (const prim of mesh.listPrimitives()) {
      const posAcc = prim.getAttribute('POSITION');
      const arr = posAcc?.getArray();
      if (!posAcc || !(arr instanceof Float32Array)) continue;
      const count = posAcc.getCount();
      const transformed = new Float32Array(count * 3);
      for (let i = 0; i < count; i += 1) {
        const o = i * 3;
        const x = arr[o];
        const y = arr[o + 1];
        const z = arr[o + 2];
        transformed[o] = wm[0] * x + wm[4] * y + wm[8] * z + wm[12];
        transformed[o + 1] = wm[1] * x + wm[5] * y + wm[9] * z + wm[13];
        transformed[o + 2] = wm[2] * x + wm[6] * y + wm[10] * z + wm[14];
      }
      chunks.push(transformed);
      totalLen += transformed.length;
    }

    const merged = new Float32Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    found.set(id, merged);
  }
  return found;
}

function boundsFromPositions(positions: Float32Array): Bounds {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    if (x < min[0]) min[0] = x;
    if (y < min[1]) min[1] = y;
    if (z < min[2]) min[2] = z;
    if (x > max[0]) max[0] = x;
    if (y > max[1]) max[1] = y;
    if (z > max[2]) max[2] = z;
  }
  return { min, max };
}

/** Merges Blender curve centerlines with raw-GLB mesh centerlines and writes `centerlines.<hash>.json`. */
export async function generateCenterlinesFile(opts: {
  config: PipelineConfig;
  rawDir: string;
  modelsDir: string;
  manifest: Manifest;
}): Promise<{
  file: string;
  bytes: number;
  sha256: string;
  lineCount: number;
}> {
  const lines: Record<string, Vec3[]> = {};

  const curvesPath = path.join(opts.rawDir, 'centerlines-curves.json');
  if (existsSync(curvesPath)) {
    const rawCurves = JSON.parse(readFileSync(curvesPath, 'utf8')) as Record<
      string,
      Vec3[]
    >;
    for (const [id, pts] of Object.entries(rawCurves)) {
      lines[id] = resample(smooth(pts), 200).map(round4);
    }
  }

  const meshRules = opts.config.centerlines?.meshes ?? [];
  if (meshRules.length > 0) {
    const targetIds = new Set(meshRules.map((r) => r.id));
    const neededBundles = new Set<string>();
    for (const id of targetIds) {
      const m = opts.manifest.meshes[id];
      if (!m) {
        throw new Error(`centerlines: mesh "${id}" missing from manifest`);
      }
      neededBundles.add(m.bundle);
    }

    const positionsByMesh = new Map<string, Float32Array>();
    for (const bundleId of neededBundles) {
      const glbPath = path.join(opts.rawDir, `${bundleId}.glb`);
      if (!existsSync(glbPath)) {
        throw new Error(`centerlines: missing raw GLB "${glbPath}"`);
      }
      const rawBytes = new Uint8Array(readFileSync(glbPath));
      const extracted = await extractMeshPositions(rawBytes, targetIds);
      for (const [k, v] of extracted) {
        positionsByMesh.set(k, v);
      }
    }

    for (const rule of meshRules) {
      const pos = positionsByMesh.get(rule.id);
      if (!pos || pos.length < 6) {
        throw new Error(
          `centerlines: insufficient geometry for mesh "${rule.id}"`,
        );
      }
      let rawLine: Vec3[];
      if (rule.method === 'slice') {
        rawLine = sliceCenterline(pos, rule.axis, rule.bins, rule.direction);
      } else {
        const bounds =
          opts.manifest.meshes[rule.id]?.bounds ?? boundsFromPositions(pos);
        const center = anchorPoint(rule.center, bounds);
        rawLine = polarCenterline(pos, {
          center,
          plane: rule.plane,
          bins: rule.bins,
          startDeg: rule.startDeg,
          sweep: rule.sweep,
        });
      }
      lines[rule.id] = resample(smooth(rawLine), 200).map(round4);
    }
  }

  const sortedLines: Record<string, Vec3[]> = {};
  for (const key of Object.keys(lines).sort()) {
    sortedLines[key] = lines[key];
  }

  const payload: CenterlinesFile = CenterlinesFileSchema.parse({
    version: 1,
    lines: sortedLines,
  });
  const encoded = Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  if (encoded.byteLength > 120_000) {
    throw new Error(
      `centerlines: output is ${encoded.byteLength} bytes, over 120,000-byte limit`,
    );
  }

  const sha256 = createHash('sha256').update(encoded).digest('hex');
  const file = `centerlines.${sha256.slice(0, 8)}.json`;
  writeFileSync(path.join(opts.modelsDir, file), encoded);

  for (const entry of readdirSync(opts.modelsDir)) {
    if (/^centerlines\.[0-9a-f]{8}\.json$/.test(entry) && entry !== file) {
      unlinkSync(path.join(opts.modelsDir, entry));
    }
  }

  return {
    file,
    bytes: encoded.byteLength,
    sha256,
    lineCount: Object.keys(sortedLines).length,
  };
}
