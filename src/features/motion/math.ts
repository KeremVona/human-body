import { Quaternion, Vector3 } from 'three';
import type { Bounds } from '../../scene/camera';

function wrapPhase(phase: number): number {
  return phase - Math.floor(phase);
}

/** Maps a `[0, 1]^3` normalised anchor inside `b` into world coordinates. */
export function anchorPoint(
  anchor: readonly [number, number, number],
  b: Bounds,
): [number, number, number] {
  return [
    b.min[0] + anchor[0] * (b.max[0] - b.min[0]),
    b.min[1] + anchor[1] * (b.max[1] - b.min[1]),
    b.min[2] + anchor[2] * (b.max[2] - b.min[2]),
  ];
}

/** Evaluates cosine-eased hinge rotation angle in degrees for wrapped `phase in [0, 1)`. */
export function hingeAngleDeg(
  phase: number,
  range: readonly [number, number],
): number {
  const p = wrapPhase(phase);
  const weight = (1 - Math.cos(2 * Math.PI * p)) / 2;
  return range[0] + (range[1] - range[0]) * weight;
}

/** Returns `'flex'` during the first half of the cycle (`[0, 0.5)`) and `'extend'` otherwise. */
export function hingeDirection(phase: number): 'flex' | 'extend' {
  return wrapPhase(phase) < 0.5 ? 'flex' : 'extend';
}

const _axisVec = new Vector3();
const _q = new Quaternion();
const _rotatedPivot = new Vector3();

/** Computes rigid position + quaternion rotation about `pivot` by `angleDeg` around `axis`. */
export function rotateAboutPivot(
  pivot: readonly [number, number, number],
  axis: readonly [number, number, number],
  angleDeg: number,
): {
  position: [number, number, number];
  quaternion: [number, number, number, number];
} {
  _axisVec.set(axis[0], axis[1], axis[2]);
  if (_axisVec.lengthSq() === 0) {
    return {
      position: [0, 0, 0],
      quaternion: [0, 0, 0, 1],
    };
  }
  _axisVec.normalize();
  _q.setFromAxisAngle(_axisVec, (angleDeg * Math.PI) / 180);
  _rotatedPivot.set(pivot[0], pivot[1], pivot[2]).applyQuaternion(_q);
  return {
    position: [
      pivot[0] - _rotatedPivot.x,
      pivot[1] - _rotatedPivot.y,
      pivot[2] - _rotatedPivot.z,
    ],
    quaternion: [_q.x, _q.y, _q.z, _q.w],
  };
}

function bump(p: number, center: number): number {
  const d = (p - center) / 0.06;
  return Math.exp(-(d * d));
}

/** Computes lub-dub double-peaked cardiac expansion factor at wrapped `phase` and `amplitude`. */
export function heartbeatScale(phase: number, amplitude: number): number {
  const p = wrapPhase(phase);
  return 1 + amplitude * (bump(p, 0.1) + 0.6 * bump(p, 0.35));
}

/** Returns the translation offset keeping `center` fixed under uniform scaling `s`. */
export function scaleAboutPoint(
  center: readonly [number, number, number],
  s: number,
): [number, number, number] {
  const k = 1 - s;
  return [center[0] * k, center[1] * k, center[2] * k];
}
