import { Euler, Mesh, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { createMeshRegistry } from './meshRegistry';
import { createMotionTransforms } from './motionTransforms';

describe('createMotionTransforms', () => {
  it('stop restores exact transforms after 1000 hinge steps', () => {
    const registry = createMeshRegistry();
    const specs: Array<{
      id: string;
      pos: [number, number, number];
      euler: [number, number, number];
      scale: [number, number, number];
    }> = [
      {
        id: 'radius--l',
        pos: [0.2, 0.1, -0.05],
        euler: [0.1, 0.2, -0.3],
        scale: [1, 1, 1],
      },
      {
        id: 'ulna--l',
        pos: [-0.1, 0.3, 0.02],
        euler: [-0.2, 0.4, 0.1],
        scale: [1.1, 0.9, 1.05],
      },
      {
        id: 'capitate-bone--l',
        pos: [0, -0.2, 0.15],
        euler: [0.3, -0.1, 0.2],
        scale: [0.8, 0.8, 0.8],
      },
    ];

    const originals = specs.map((s) => {
      const m = new Mesh();
      m.position.set(...s.pos);
      m.quaternion.setFromEuler(new Euler(...s.euler));
      m.scale.set(...s.scale);
      m.updateMatrixWorld(true);
      registry.register(s.id, m);
      return {
        mesh: m,
        pos: m.position.clone(),
        quat: m.quaternion.clone(),
        scale: m.scale.clone(),
      };
    });

    const transforms = createMotionTransforms(registry);
    transforms.begin(specs.map((s) => s.id));

    for (let i = 0; i < 1000; i++) {
      const angle = (i * 37) % 145;
      transforms.applyHinge({ axis: [-1, 0, 0] }, [0.2, 0.23, -0.04], angle);
    }

    transforms.restore();

    for (const orig of originals) {
      expect(orig.mesh.position.equals(orig.pos)).toBe(true);
      expect(orig.mesh.quaternion.equals(orig.quat)).toBe(true);
      expect(orig.mesh.scale.equals(orig.scale)).toBe(true);
    }
  });

  it('skips missing meshes without throwing', () => {
    const registry = createMeshRegistry();
    const femur = new Mesh();
    registry.register('femur--l', femur);

    const transforms = createMotionTransforms(registry);
    expect(() => transforms.begin(['femur--l', 'gone--l'])).not.toThrow();
    expect(() =>
      transforms.applyHinge({ axis: [1, 0, 0] }, [0, 1, 0], 45),
    ).not.toThrow();
    expect(femur.quaternion.equals(new Quaternion())).toBe(false);
    transforms.restore();
    expect(femur.quaternion.equals(new Quaternion())).toBe(true);
  });

  it('pulse scales about center cleanly', () => {
    const registry = createMeshRegistry();
    const atrium = new Mesh();
    atrium.position.set(0, 0, 0);
    atrium.scale.set(1, 1, 1);
    registry.register('left-atrium', atrium);

    const transforms = createMotionTransforms(registry);
    transforms.begin(['left-atrium']);
    transforms.applyPulse([{ ids: ['left-atrium'], scale: 1.1 }], [1, 0, 0]);

    expect(atrium.position.distanceTo(new Vector3(-0.1, 0, 0))).toBeLessThan(
      1e-6,
    );
    expect(atrium.scale.distanceTo(new Vector3(1.1, 1.1, 1.1))).toBeLessThan(
      1e-6,
    );

    transforms.restore();
    expect(atrium.position.equals(new Vector3(0, 0, 0))).toBe(true);
    expect(atrium.scale.equals(new Vector3(1, 1, 1))).toBe(true);
  });

  it('breath scales groups about their centers, shifts diaphragm, and restores exact originals', () => {
    const registry = createMeshRegistry();
    const lung = new Mesh();
    lung.position.set(0.1, 0.2, 0.3);
    lung.scale.set(1, 1, 1);
    const diaphragm = new Mesh();
    diaphragm.position.set(0, 0.1, 0);
    registry.register('inferior-lobe-of-left-lung', lung);
    registry.register('diaphragm', diaphragm);

    const transforms = createMotionTransforms(registry);
    transforms.begin(['inferior-lobe-of-left-lung', 'diaphragm']);

    // Identity at envelope 0 (scale 1, offset 0)
    transforms.applyBreath(
      [{ ids: ['inferior-lobe-of-left-lung'], center: [0.1, 0.5, 0.3], scale: 1 }],
      [{ ids: ['diaphragm'], offset: [0, 0, 0] }],
    );
    expect(lung.position.distanceTo(new Vector3(0.1, 0.2, 0.3))).toBeLessThan(1e-9);
    expect(lung.scale.distanceTo(new Vector3(1, 1, 1))).toBeLessThan(1e-9);
    expect(diaphragm.position.distanceTo(new Vector3(0, 0.1, 0))).toBeLessThan(1e-9);

    // Peak inhale expand + shift
    transforms.applyBreath(
      [{ ids: ['inferior-lobe-of-left-lung'], center: [0.1, 0.5, 0.3], scale: 1.05 }],
      [{ ids: ['diaphragm'], offset: [0, -0.015, 0] }],
    );
    expect(lung.position.y).toBeCloseTo(0.2 * 1.05 + 0.5 * -0.05, 6);
    expect(lung.scale.x).toBeCloseTo(1.05, 6);
    expect(diaphragm.position.y).toBeCloseTo(0.085, 6);

    transforms.restore();
    expect(lung.position.distanceTo(new Vector3(0.1, 0.2, 0.3))).toBeLessThan(1e-9);
    expect(lung.scale.distanceTo(new Vector3(1, 1, 1))).toBeLessThan(1e-9);
    expect(diaphragm.position.distanceTo(new Vector3(0, 0.1, 0))).toBeLessThan(1e-9);
  });
});
