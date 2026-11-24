import { describe, expect, it } from 'vitest';
import type { Bounds } from '../../scene/camera';
import { isClipped, presetForSection, sectionPlane } from './sectionPlane';

const b: Bounds = { min: [-0.3, -0.9, -0.15], max: [0.3, 0.9, 0.15] };

describe('sectionPlane', () => {
  it.each([
    [
      { axis: 'axial', t: 0.25, flip: false },
      { normal: [0, -1, 0], constant: -0.45 },
    ],
    [
      { axis: 'axial', t: 0.25, flip: true },
      { normal: [0, 1, 0], constant: 0.45 },
    ],
    [
      { axis: 'sagittal', t: 0.5, flip: false },
      { normal: [-1, 0, 0], constant: 0 },
    ],
    [
      { axis: 'sagittal', t: 0.5, flip: true },
      { normal: [1, 0, 0], constant: 0 },
    ],
    [
      { axis: 'coronal', t: 0.5, flip: false },
      { normal: [0, 0, -1], constant: 0 },
    ],
  ] as const)('sectionPlane(%o)', (s, want) => {
    const p = sectionPlane(s, b);
    expect(p.normal).toEqual(want.normal);
    expect(p.constant).toBeCloseTo(want.constant, 9);
    expect(Object.is(p.constant, -0)).toBe(false);
    for (const n of p.normal) {
      expect(Object.is(n, -0)).toBe(false);
    }
  });

  it('handles the ends of the range', () => {
    expect(
      sectionPlane({ axis: 'axial', t: 0, flip: false }, b).constant,
    ).toBeCloseTo(-0.9, 9);
    expect(
      sectionPlane({ axis: 'axial', t: 1, flip: false }, b).constant,
    ).toBeCloseTo(0.9, 9);
  });

  it('classifies clipped points', () => {
    const p = sectionPlane({ axis: 'axial', t: 0.5, flip: false }, b);
    expect(isClipped([0, 0.1, 0], p)).toBe(true);
    expect(isClipped([0, -0.1, 0], p)).toBe(false);
  });

  it.each([
    ['axial', false, 'superior'],
    ['axial', true, 'inferior'],
    ['sagittal', false, 'left'],
    ['sagittal', true, 'right'],
    ['coronal', false, 'anterior'],
    ['coronal', true, 'posterior'],
  ] as const)('presetForSection(%s, %s) = %s', (axis, flip, preset) => {
    expect(presetForSection(axis, flip)).toBe(preset);
  });
});
