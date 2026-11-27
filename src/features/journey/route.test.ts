import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { Manifest } from '../../data/schema';
import type { Journey } from './schema';
import { buildRoute, localProgress, stageAt } from './route';

const sampleView = {
  c: [0, 0, 2, 0, 0, 0] as [number, number, number, number, number, number],
  s: ['digestive'] as ['digestive'],
  h: [],
  sel: [],
};

const baseStage = {
  durationS: 5,
  look: 'bolus' as const,
  radius: 0.006,
  motion: 'squeeze' as const,
  organs: ['esophagus'],
  view: sampleView,
  modelled: true,
  meters: { carbs: 0 },
};

const meshes: Manifest['meshes'] = {
  esophagus: {
    bundle: 'organs',
    bounds: { min: [-0.02, 0.3, -0.02], max: [0.02, 0.6, 0.02] },
    triangles: 100,
    sizeClass: 'medium',
  },
  stomach: {
    bundle: 'organs',
    bounds: { min: [0, 0.2, -0.02], max: [0.1, 0.3, 0.02] },
    triangles: 100,
    sizeClass: 'medium',
  },
  'pararectal-nodes': {
    bundle: 'lymphatic',
    bounds: { min: [-0.01, -0.05, -0.07], max: [0.01, -0.03, -0.05] },
    triangles: 10,
    sizeClass: 'tiny',
  },
  'external-anal-sphincter--l': {
    bundle: 'muscular',
    bounds: { min: [0, -0.06, -0.08], max: [0.01, -0.04, -0.06] },
    triangles: 10,
    sizeClass: 'tiny',
  },
};

const lines: Record<string, [number, number, number][]> = {
  'line-a': [
    [0, 0.6, 0],
    [0, 0.4, 0],
    [0, 0.3, 0],
  ],
  'line-b': [
    [0.02, 0.28, 0],
    [0.06, 0.25, 0],
    [0.08, 0.2, 0],
  ],
};

const testJourney: Journey = {
  id: 'digestion',
  systems: ['digestive'],
  meters: [{ id: 'carbs', unit: '%', max: 100, decimals: 0 }],
  stages: [
    {
      ...baseStage,
      id: 'mouth',
      path: [{ line: 'line-a', from: 0, to: 0.5 }],
    },
    {
      ...baseStage,
      id: 'stomach',
      path: [
        { line: 'line-a', from: 0.5, to: 1 },
        { line: 'line-b' },
      ],
    },
    {
      ...baseStage,
      id: 'exit',
      modelled: false,
      path: [
        { mesh: 'pararectal-nodes', anchor: [0.5, 0.5, 0.5] },
        { mesh: 'external-anal-sphincter--l', anchor: [0, 0.2, 0.5] },
      ],
    },
  ],
};

describe('journey route builder', () => {
  it('joins sliced lines and waypoints with monotonic [0, 1] stage boundaries and dashed ranges', () => {
    const route = buildRoute(testJourney, lines, meshes);

    expect(route.length).toBeGreaterThan(0.3);
    expect(route.stageStart).toHaveLength(3);
    expect(route.stageEnd).toHaveLength(3);
    expect(route.stageStart[0]).toBe(0);
    expect(route.stageEnd[2]).toBe(1);

    for (let s = 0; s < 3; s += 1) {
      expect(route.stageEnd[s]).toBeGreaterThan(route.stageStart[s]);
      if (s > 0) {
        expect(route.stageStart[s]).toBeCloseTo(route.stageEnd[s - 1], 6);
      }
    }

    expect(route.dashed).toEqual([[route.stageStart[2], route.stageEnd[2]]]);

    const p0 = new Vector3();
    const pEnd = new Vector3();
    route.pointAt(0, p0);
    route.pointAt(1, pEnd);
    expect(p0.distanceTo(new Vector3(0, 0.6, 0))).toBeLessThan(0.002);
    expect(pEnd.distanceTo(new Vector3(0, -0.056, -0.07))).toBeLessThan(
      0.002,
    );

    const midCut = new Vector3();
    route.pointAt(route.stageStart[1], midCut);
    expect(midCut.distanceTo(new Vector3(0, 0.45, 0))).toBeLessThan(
      0.015,
    );
  });

  it('pointAt and tangentAt write into caller-provided Vector3 instances with unit tangent', () => {
    const route = buildRoute(testJourney, lines, meshes);
    const out = new Vector3();
    const tan = new Vector3();

    expect(route.pointAt(0.37, out)).toBe(out);
    expect(route.tangentAt(0.37, tan)).toBe(tan);
    expect(tan.length()).toBeCloseTo(1, 3);
  });

  it('stageAt and localProgress map arc-length progress u to stages cleanly', () => {
    const route = buildRoute(testJourney, lines, meshes);
    expect(stageAt(route, 0)).toBe(0);
    expect(stageAt(route, (route.stageStart[1] + route.stageEnd[1]) / 2)).toBe(1);
    expect(stageAt(route, 1)).toBe(2);

    const mid1 = (route.stageStart[1] + route.stageEnd[1]) / 2;
    expect(localProgress(route, 1, mid1)).toBeCloseTo(0.5, 4);
    expect(localProgress(route, 1, 0)).toBe(0);
    expect(localProgress(route, 1, 1)).toBe(1);
  });

  it('walks a line slice with reverse: true from end back to start', () => {
    const revJourney: Journey = {
      id: 'breath',
      systems: ['digestive'],
      meters: [{ id: 'carbs', unit: '%', max: 100, decimals: 0 }],
      stages: [
        {
          ...baseStage,
          id: 'inhale',
          path: [{ line: 'line-a', from: 0.1, to: 0.9 }],
        },
        {
          ...baseStage,
          id: 'exhale',
          path: [{ line: 'line-a', from: 0.1, to: 0.9, reverse: true }],
        },
      ],
    };
    const route = buildRoute(revJourney, lines, meshes);
    const pStart0 = new Vector3();
    const pEnd0 = new Vector3();
    const pStart1 = new Vector3();
    const pEnd1 = new Vector3();
    route.pointAt(route.stageStart[0], pStart0);
    route.pointAt(route.stageEnd[0], pEnd0);
    route.pointAt(route.stageStart[1], pStart1);
    route.pointAt(route.stageEnd[1], pEnd1);

    // Exhale begins at the end of inhale and returns to the start of inhale
    expect(pStart1.distanceTo(pEnd0)).toBeLessThan(0.002);
    expect(pEnd1.distanceTo(pStart0)).toBeLessThan(0.002);
  });
});
