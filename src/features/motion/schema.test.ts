import { describe, expect, it } from 'vitest';
import rawMotions from '../../../content/motions.json';
import {
  MotionsFileSchema,
  type BreathDef,
  type HingeDef,
  type PulseDef,
} from './schema';

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

const baseBreath: BreathDef = {
  id: 'breathing',
  kind: 'breath',
  label: 'Breathing',
  view: 'anterior',
  systems: ['respiratory', 'muscular'],
  expand: [
    {
      meshes: ['inferior-lobe-of-left-lung'],
      center: { mesh: 'inferior-lobe-of-left-lung', anchor: [0.5, 0.9, 0.5] },
      amount: 0.05,
    },
  ],
  shift: [{ meshes: ['diaphragm'], offset: [0, -0.015, 0] }],
  breathsPerMin: 12,
  inhaleShare: 0.4,
};

describe('MotionsFileSchema', () => {
  it('accepts valid hinge, pulse, breath definitions and real content/motions.json', () => {
    const parsed = MotionsFileSchema.parse({
      motions: [baseHinge, basePulse, baseBreath],
    });
    expect(parsed.motions).toHaveLength(3);
    expect(parsed.motions[0].kind).toBe('hinge');
    expect(parsed.motions[1].kind).toBe('pulse');
    expect(parsed.motions[2].kind).toBe('breath');

    const prod = MotionsFileSchema.parse(rawMotions);
    expect(prod.motions.some((m) => m.id === 'breathing' && m.kind === 'breath')).toBe(
      true,
    );
  });

  it('rejects invalid breath ranges and out-of-range offsets alongside hinge/pulse checks', () => {
    expect(
      MotionsFileSchema.safeParse({
        motions: [
          {
            ...baseBreath,
            expand: [
              {
                meshes: ['inferior-lobe-of-left-lung'],
                center: { mesh: 'inferior-lobe-of-left-lung', anchor: [0.5, 0.9, 0.5] },
                amount: 0.11,
              },
            ],
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      MotionsFileSchema.safeParse({
        motions: [{ ...baseBreath, shift: [{ meshes: ['diaphragm'], offset: [0, -0.04, 0] }] }],
      }).success,
    ).toBe(false);
    expect(
      MotionsFileSchema.safeParse({
        motions: [{ ...baseBreath, breathsPerMin: 5 }],
      }).success,
    ).toBe(false);
    expect(
      MotionsFileSchema.safeParse({
        motions: [{ ...baseBreath, inhaleShare: 0.7 }],
      }).success,
    ).toBe(false);
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
