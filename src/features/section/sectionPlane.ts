import type { Bounds, Preset } from '../../scene/camera';

export type SectionAxis = 'axial' | 'sagittal' | 'coronal';

export type PlaneCoefficients = {
  normal: [number, number, number];
  constant: number;
};

const AXIS_INDEX: Record<SectionAxis, 0 | 1 | 2> = {
  sagittal: 0,
  axial: 1,
  coronal: 2,
};

const SECTION_PRESETS: Record<SectionAxis, { normal: Preset; flipped: Preset }> =
  {
    axial: { normal: 'superior', flipped: 'inferior' },
    sagittal: { normal: 'left', flipped: 'right' },
    coronal: { normal: 'anterior', flipped: 'posterior' },
  };

function normalizeZero(n: number): number {
  return Object.is(n, -0) ? 0 : n;
}

/** Computes Three.js clipping plane coefficients (`dot(n, p) + c >= 0` kept) for the section state. */
export function sectionPlane(
  s: { axis: SectionAxis; t: number; flip: boolean },
  b: Bounds,
): PlaneCoefficients {
  const idx = AXIS_INDEX[s.axis];
  const minVal = b.min[idx];
  const maxVal = b.max[idx];
  const coord = minVal + s.t * (maxVal - minVal);
  const sign = s.flip ? 1 : -1;

  const normal: [number, number, number] = [0, 0, 0];
  normal[idx] = normalizeZero(sign);
  const constant = normalizeZero(s.flip ? -coord : coord);
  return { normal, constant };
}

/** Returns the anatomical camera preset framing the freshly exposed cut face. */
export function presetForSection(axis: SectionAxis, flip: boolean): Preset {
  const pair = SECTION_PRESETS[axis];
  return flip ? pair.flipped : pair.normal;
}

/** Returns true when `point` falls on the removed side (`dot(n, p) + c < 0`) of the plane. */
export function isClipped(
  point: readonly [number, number, number],
  plane: PlaneCoefficients,
): boolean {
  return (
    plane.normal[0] * point[0] +
      plane.normal[1] * point[1] +
      plane.normal[2] * point[2] +
      plane.constant <
    0
  );
}
