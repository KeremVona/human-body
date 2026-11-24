import { describe, expect, it, vi } from 'vitest';
import type { Manifest } from '../data/schema';
import {
  bodyBounds,
  createCameraController,
  distanceLimits,
  fitDistance,
  presetPose,
  unionBounds,
  type Bounds,
  type CameraApi,
  type Pose,
} from './camera';

const body: Bounds = { min: [-0.3, -0.9, -0.15], max: [0.3, 0.9, 0.15] };

function m(
  min: [number, number, number],
  max: [number, number, number],
): Manifest['meshes'][string] {
  return {
    bundle: 'skeletal',
    triangles: 100,
    bounds: { min, max },
    sizeClass: 'large',
  };
}

describe('fitDistance', () => {
  it('fits the body for landscape and portrait viewports', () => {
    expect(fitDistance(body, 35, 16 / 9)).toBeCloseTo(3.673, 2);
    expect(fitDistance(body, 35, 0.5)).toBeCloseTo(7.09, 1);
  });
});

describe('presetPose', () => {
  it.each([
    ['anterior', [0, 0, 3]],
    ['posterior', [0, 0, -3]],
    ['left', [3, 0, 0]],
    ['right', [-3, 0, 0]],
    ['superior', [0, 3, 0.01]],
    ['inferior', [0, -3, 0.01]],
  ] as const)('presetPose(%s)', (p, pos) => {
    expect(presetPose(p, body, 3)).toEqual({
      position: pos,
      target: [0, 0, 0],
    });
  });
});

describe('unionBounds & bodyBounds', () => {
  it('unions mesh bounds and returns null for unknown ids', () => {
    const meshes: Manifest['meshes'] = {
      a: m([0, 0, 0], [1, 1, 1]),
      b: m([-1, 0, 0], [0, 2, 1]),
    };
    expect(unionBounds(['a', 'b'], meshes)).toEqual({
      min: [-1, 0, 0],
      max: [1, 2, 1],
    });
    expect(unionBounds(['zz'], meshes)).toBeNull();
  });

  it('derives bodyBounds from the skeletal bundle meshes', () => {
    const manifest: Manifest = {
      version: 1,
      generatedAt: '2026-11-21T00:00:00Z',
      source: { name: 'Z-Anatomy', version: '1', license: 'CC-BY-SA-4.0' },
      bundles: [
        {
          id: 'skeletal',
          file: 'skeletal.glb',
          bytes: 100,
          sha256: 'abc',
          meshIds: ['femur--l', 'skull'],
        },
        {
          id: 'muscular',
          file: 'muscular.glb',
          bytes: 100,
          sha256: 'def',
          meshIds: ['deltoid--l'],
        },
      ],
      meshes: {
        'femur--l': m([-0.2, -0.9, -0.1], [0.2, 0, 0.1]),
        skull: m([-0.15, 0.5, -0.12], [0.15, 0.9, 0.12]),
        'deltoid--l': m([-0.8, 0.2, -0.2], [0.8, 0.6, 0.2]),
      },
    };
    expect(bodyBounds(manifest)).toEqual({
      min: [-0.2, -0.9, -0.12],
      max: [0.2, 0.9, 0.12],
    });
  });
});

describe('distanceLimits', () => {
  it('derives zoom limits', () => {
    const femur: Bounds = { min: [0, 0, 0], max: [0.2, 0.3, 0] };
    expect(distanceLimits(femur, body)).toEqual({
      min: expect.closeTo(0.1983, 3),
      max: expect.closeTo(7.2, 6),
    });
    expect(distanceLimits(null, body).min).toBeCloseTo(1.0565, 3);
  });
});

describe('createCameraController pose methods', () => {
  it('returns null unbound and forwards getPose and setPose when bound', async () => {
    const controller = createCameraController();
    expect(controller.api.getPose()).toBeNull();
    await expect(
      controller.api.setPose({ position: [0, 0, 3], target: [0, 0, 0] }, false),
    ).resolves.toBeUndefined();

    const pose: Pose = { position: [1, 2, 3], target: [0, 1, 0] };
    const impl: CameraApi = {
      focusMeshes: vi.fn(async () => {}),
      goToPreset: vi.fn(async () => {}),
      resetView: vi.fn(async () => {}),
      zoom: vi.fn(),
      getPose: vi.fn(() => pose),
      setPose: vi.fn(async () => {}),
      lookAtPoint: vi.fn(async () => {}),
    };

    const unbind = controller.bind(impl);
    expect(controller.api.getPose()).toEqual(pose);
    await controller.api.setPose(pose, true);
    expect(impl.setPose).toHaveBeenCalledWith(pose, true);
    await controller.api.lookAtPoint([0, 0.5, 0], 0.4);
    expect(impl.lookAtPoint).toHaveBeenCalledWith([0, 0.5, 0], 0.4);

    unbind();
    expect(controller.api.getPose()).toBeNull();
    await expect(
      controller.api.lookAtPoint([0, 0.5, 0]),
    ).resolves.toBeUndefined();
  });
});
