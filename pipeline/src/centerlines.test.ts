import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CenterlinesFileSchema } from '../../src/data/centerlines';
import { ManifestSchema } from '../../src/data/schema';
import {
  anchorPoint,
  polarCenterline,
  resample,
  round4,
  sliceCenterline,
  smooth,
  type Vec3,
} from './centerlines';

describe('centerlines geometry helpers', () => {
  it('computes the axis of a synthetic cylinder within 0.5 mm via sliceCenterline', () => {
    const verts: number[] = [];
    const axisX = 0.025;
    const axisZ = -0.015;
    const r = 0.02;
    for (let ring = 0; ring <= 40; ring += 1) {
      const y = -0.1 + (0.2 * ring) / 40;
      for (let k = 0; k < 24; k += 1) {
        const theta = (2 * Math.PI * k) / 24;
        verts.push(
          axisX + r * Math.cos(theta),
          y,
          axisZ + r * Math.sin(theta),
        );
      }
    }
    const pts = sliceCenterline(new Float32Array(verts), 'y', 20, 1);
    expect(pts.length).toBe(20);
    expect(pts[0][1]).toBeLessThan(pts[pts.length - 1][1]);
    for (const p of pts) {
      expect(Math.hypot(p[0] - axisX, p[2] - axisZ)).toBeLessThan(0.0005);
    }

    const rev = sliceCenterline(new Float32Array(verts), 'y', 20, -1);
    expect(rev[0][1]).toBeGreaterThan(rev[rev.length - 1][1]);
  });

  it('follows a C-shaped torus arc in angular order via polarCenterline', () => {
    const verts: number[] = [];
    const cx = 0.1;
    const cy = 0.2;
    const cz = -0.05;
    const R = 0.06;
    const r = 0.008;
    // Sweep from 120 deg to 330 deg counter-clockwise (sweep: +1)
    for (let u = 0; u <= 60; u += 1) {
      const phi = ((120 + (210 * u) / 60) * Math.PI) / 180;
      for (let v = 0; v < 12; v += 1) {
        const theta = (2 * Math.PI * v) / 12;
        const radial = R + r * Math.cos(theta);
        verts.push(
          cx + radial * Math.cos(phi),
          cy + radial * Math.sin(phi),
          cz + r * Math.sin(theta),
        );
      }
    }
    const pts = polarCenterline(new Float32Array(verts), {
      center: [cx, cy, cz],
      plane: 'xy',
      bins: 24,
      startDeg: 120,
      sweep: 1,
    });
    expect(pts.length).toBeGreaterThanOrEqual(12);
    // Start point should be around 120 deg (-x, +y), end near 330 deg (+x, -y)
    expect(pts[0][0]).toBeLessThan(cx);
    expect(pts[0][1]).toBeGreaterThan(cy);
    expect(pts[pts.length - 1][0]).toBeGreaterThan(cx);
    expect(pts[pts.length - 1][1]).toBeLessThan(cy);

    // Every sample should stay close to torus circle radius R in xy
    for (const p of pts) {
      const dist = Math.hypot(p[0] - cx, p[1] - cy);
      expect(Math.abs(dist - R)).toBeLessThan(r);
    }
  });

  it('smooth preserves endpoints, resample preserves endpoints and obeys maxPoints, round4 rounds', () => {
    const line: Vec3[] = Array.from({ length: 50 }, (_, i) => [
      i * 0.01,
      Math.sin(i * 0.2) * 0.02,
      0.00123456,
    ]);
    const smoothed = smooth(line, 5);
    expect(smoothed[0]).toEqual(line[0]);
    expect(smoothed[smoothed.length - 1]).toEqual(line[line.length - 1]);

    const resampled = resample(smoothed, 20);
    expect(resampled.length).toBe(20);
    expect(resampled[0]).toEqual(smoothed[0]);
    expect(resampled[resampled.length - 1]).toEqual(
      smoothed[smoothed.length - 1],
    );

    const rounded = resampled.map(round4);
    expect(rounded[0][2]).toBe(0.0012);
  });

  it('CenterlinesFileSchema validates valid centerlines JSON and rejects invalid ids or short lines', () => {
    expect(
      CenterlinesFileSchema.safeParse({
        version: 1,
        lines: {
          esophagus: [
            [0, 0.6, 0],
            [0, 0.3, 0],
          ],
        },
      }).success,
    ).toBe(true);

    expect(
      CenterlinesFileSchema.safeParse({
        version: 1,
        lines: {
          'radial-veins--l': [
            [0, 0.6, 0],
            [0, 0.3, 0],
          ],
        },
      }).success,
    ).toBe(true);

    expect(
      CenterlinesFileSchema.safeParse({
        version: 1,
        lines: {
          BadId: [
            [0, 0, 0],
            [0, 1, 0],
          ],
        },
      }).success,
    ).toBe(false);

    expect(
      CenterlinesFileSchema.safeParse({
        version: 1,
        lines: {
          esophagus: [[0, 0, 0]],
        },
      }).success,
    ).toBe(false);
  });

  it('validates the generated centerlines file referenced by manifest.json', () => {
    const modelsDir = path.resolve(import.meta.dirname, '..', '..', 'public', 'models');
    const manifest = ManifestSchema.parse(
      JSON.parse(readFileSync(path.join(modelsDir, 'manifest.json'), 'utf8')),
    );
    expect(manifest.centerlines).toBeDefined();
    const raw = JSON.parse(
      readFileSync(path.join(modelsDir, manifest.centerlines!.file), 'utf8'),
    );
    const parsed = CenterlinesFileSchema.parse(raw);
    expect(Object.keys(parsed.lines).length).toBe(30);
    for (const pts of Object.values(parsed.lines)) {
      expect(pts.length).toBeLessThanOrEqual(200);
      expect(pts.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('anchorPoint maps normalised [0, 1]^3 anchors into bounding-box coordinates', () => {
    expect(
      anchorPoint([0.25, 0.5, 1], { min: [-2, 0, 1], max: [2, 4, 5] }),
    ).toEqual([-1, 2, 5]);
  });
});
