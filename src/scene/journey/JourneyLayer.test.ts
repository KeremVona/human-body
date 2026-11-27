import { Matrix4, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { buildRoute } from '../../features/journey/route';
import type { Journey } from '../../features/journey/schema';
import {
  advanceJourneyProgress,
  buildCenterlineTable,
  createJourneyLayer,
  ringTransforms,
  sampleCenterlineTable,
} from './JourneyLayer';

const fixtureJourney: Journey = {
  id: 'digestion',
  systems: ['digestive'],
  meters: [{ id: 'carbs', unit: '%', max: 100, decimals: 0 }],
  stages: [
    {
      id: 'mouth',
      durationS: 4,
      look: 'bolus',
      radius: 0.008,
      motion: 'none',
      organs: ['tongue'],
      view: { c: [0, 0.5, 0.5, 0, 0.5, 0], s: ['digestive'], h: [], sel: [] },
      path: [
        { line: 'a' },
      ],
      modelled: true,
      meters: { carbs: 5 },
    },
    {
      id: 'esophagus',
      durationS: 8,
      look: 'bolus',
      radius: 0.009,
      motion: 'squeeze',
      organs: ['tongue'],
      view: { c: [0, 0.3, 0.5, 0, 0.3, 0], s: ['digestive'], h: [], sel: [] },
      path: [{ line: 'b' }],
      modelled: true,
      meters: { carbs: 10 },
    },
  ],
};

const lines = {
  a: [
    [0, 0.6, 0] as [number, number, number],
    [0, 0.4, 0] as [number, number, number],
  ],
  b: [
    [0, 0.4, 0] as [number, number, number],
    [0, 0.0, 0] as [number, number, number],
  ],
};

describe('JourneyLayer helpers and disposal', () => {
  it('advances each stage in exact durationS / speed seconds', () => {
    const route = buildRoute(fixtureJourney, lines, {});
    const durs = fixtureJourney.stages.map((s) => s.durationS);
    let u = 0;

    // Advance 4 s at 1x in 0.05 s steps -> reaches end of stage 0 cleanly
    for (let i = 0; i < 80; i += 1) {
      u = advanceJourneyProgress(route, durs, u, 0.05, 1);
    }
    expect(u).toBeCloseTo(route.stageEnd[0], 3);

    // Advance 4 s at 2x (4s * 2 = 8s duration of stage 1) -> finishes at 1
    for (let i = 0; i < 80; i += 1) {
      u = advanceJourneyProgress(route, durs, u, 0.05, 2);
    }
    expect(u).toBeCloseTo(1, 4);
  });

  it('computes 3 trailing ring transforms aligned with the tangent and scaled by radius', () => {
    const route = buildRoute(fixtureJourney, lines, {});
    const out = [new Matrix4(), new Matrix4(), new Matrix4()];
    ringTransforms(route, 0.6, 0.01, 0.25, out);

    const pos = new Vector3();
    const scale = new Vector3();
    const expectedPos = new Vector3();
    for (let i = 0; i < 3; i += 1) {
      pos.setFromMatrixPosition(out[i]);
      scale.setFromMatrixScale(out[i]);
      const ringU = 0.6 - ((i + 1) * 1.2 * 0.01) / route.length;
      route.pointAt(ringU, expectedPos);
      expect(pos.distanceTo(expectedPos)).toBeLessThan(1e-4);
      expect(scale.x).toBeGreaterThanOrEqual(0.01 * 0.99);
      expect(scale.x).toBeLessThanOrEqual(0.01 * 1.26);
    }
  });

  it('builds and samples duct centerline tables cleanly', () => {
    const table = buildCenterlineTable([
      [0, 0, 0],
      [0.3, 0, 0],
      [0.3, 0.3, 0],
    ]);
    const p = new Vector3();
    sampleCenterlineTable(table, 0.5, p);
    expect(p.x).toBeCloseTo(0.3, 4);
    expect(p.y).toBeCloseTo(0, 4);
  });

  it('builds <= 4 draw calls and disposes all geometries and materials cleanly', () => {
    const route = buildRoute(fixtureJourney, lines, {});
    const layer = createJourneyLayer(route);
    expect(layer.visibleDrawCalls()).toBe(2);

    layer.updateRings(true, route, 0.5, 0.01, 0);
    expect(layer.visibleDrawCalls()).toBe(3);

    layer.updateDroplets(buildCenterlineTable(lines.a), 0.1);
    expect(layer.visibleDrawCalls()).toBe(4);

    const spies = [
      vi.spyOn(layer.routeMaterial, 'dispose'),
      vi.spyOn(layer.biteMesh.geometry, 'dispose'),
      vi.spyOn(layer.biteMesh.material, 'dispose'),
      vi.spyOn(layer.ringsMesh.geometry, 'dispose'),
      vi.spyOn(layer.ringsMesh.material, 'dispose'),
      vi.spyOn(layer.dropletsMesh.geometry, 'dispose'),
      vi.spyOn(layer.dropletsMesh.material, 'dispose'),
    ];
    layer.dispose();
    for (const spy of spies) {
      expect(spy).toHaveBeenCalledTimes(1);
    }
  });
});
