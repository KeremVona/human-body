import { Matrix4, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  anchorPoint,
  heartbeatScale,
  hingeAngleDeg,
  hingeDirection,
  rotateAboutPivot,
  scaleAboutPoint,
} from './math';

describe('motion math', () => {
  it('maps anchors into bounds', () => {
    expect(
      anchorPoint([0.5, 0, 1], { min: [0, 0, 0], max: [2, 4, 6] }),
    ).toEqual([1, 0, 6]);
  });

  it('eases the hinge angle and direction over a cycle', () => {
    expect(hingeAngleDeg(0, [0, 145])).toBeCloseTo(0, 9);
    expect(hingeAngleDeg(0.25, [0, 145])).toBeCloseTo(72.5, 9);
    expect(hingeAngleDeg(0.5, [0, 145])).toBeCloseTo(145, 9);
    expect(hingeAngleDeg(1.25, [0, 145])).toBeCloseTo(72.5, 9);
    expect([0.1, 0.49, 0.5, 0.9, 1.1].map(hingeDirection)).toEqual([
      'flex',
      'flex',
      'extend',
      'extend',
      'flex',
    ]);
  });

  it('rotates about a pivot, leaving the pivot fixed', () => {
    const { position, quaternion } = rotateAboutPivot([0, 1, 0], [0, 0, 2], 90);
    const m = new Matrix4().compose(
      new Vector3(...position),
      new Quaternion(...quaternion),
      new Vector3(1, 1, 1),
    );
    expect(
      new Vector3(0, 1, 0)
        .applyMatrix4(m)
        .toArray()
        .map((n) => +n.toFixed(9)),
    ).toEqual([0, 1, 0]);
    expect(
      new Vector3(0, 0, 0)
        .applyMatrix4(m)
        .toArray()
        .map((n) => +n.toFixed(9)),
    ).toEqual([1, 1, 0]);
  });

  it('beats lub-dub', () => {
    expect(heartbeatScale(0.1, 0.04)).toBeCloseTo(1.04, 3);
    expect(heartbeatScale(0.35, 0.04)).toBeCloseTo(1.024, 3);
    expect(heartbeatScale(0.7, 0.04)).toBeCloseTo(1, 4);
  });

  it('scales about a fixed centre', () => {
    expect(scaleAboutPoint([1, 2, 3], 1.1).map((n) => +n.toFixed(9))).toEqual([
      -0.1, -0.2, -0.3,
    ]);
  });
});
