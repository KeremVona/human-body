import { describe, expect, it } from 'vitest';
import { MotionsFileSchema, type HingeDef, type PulseDef } from './schema';

const baseHinge: HingeDef = {
  id: 'elbow-flexion',
  kind: 'hinge',
  label: 'Elbow flexion and extension',
  view: 'left',
  systems: ['skeletal', 'muscular'],
  moving: ['radius--l', 'ulna--l'],
  ghost: ['long-head-of-biceps-brachii--l'],
  agonists: {
    flex: ['long-head-of-biceps-brachii--l'],
    extend: ['long-head-of-triceps-brachii--l'],
  },
  pivot: { mesh: 'humerus--l', anchor: [0.5, 0.03, 0.5] },
  axis: [-1, 0, 0],
  range: [0, 145],
  periodS: 4,
};

const basePulse: PulseDef = {
  id: 'heartbeat',
  kind: 'pulse',
  label: 'Heartbeat',
  view: 'anterior',
  systems: ['cardiovascular'],
  groups: [
    { meshes: ['left-atrium', 'right-atrium'], phase: 0 },
    { meshes: ['left-ventricle', 'right-ventricle'], phase: 0.15 },
  ],
  bpm: 72,
  amplitude: 0.04,
};

describe('MotionsFileSchema', () => {
  it('accepts one valid hinge and one valid pulse definition', () => {
    const parsed = MotionsFileSchema.parse({
      motions: [baseHinge, basePulse],
    });
    expect(parsed.motions).toHaveLength(2);
    expect(parsed.motions[0].kind).toBe('hinge');
    expect(parsed.motions[1].kind).toBe('pulse');
  });

  it('rejects zero axis, inverted range, out-of-range anchor, excessive bpm, and duplicate ids', () => {
    expect(
      MotionsFileSchema.safeParse({
        motions: [{ ...baseHinge, axis: [0, 0, 0] }],
      }).success,
    ).toBe(false);

    expect(
      MotionsFileSchema.safeParse({
        motions: [{ ...baseHinge, range: [90, 10] }],
      }).success,
    ).toBe(false);

    expect(
      MotionsFileSchema.safeParse({
        motions: [
          {
            ...baseHinge,
            pivot: { mesh: 'humerus--l', anchor: [0.5, 1.2, 0.5] },
          },
        ],
      }).success,
    ).toBe(false);

    expect(
      MotionsFileSchema.safeParse({
        motions: [{ ...basePulse, bpm: 300 }],
      }).success,
    ).toBe(false);

    expect(
      MotionsFileSchema.safeParse({
        motions: [baseHinge, { ...baseHinge }],
      }).success,
    ).toBe(false);
  });
});
