import { Color, Material, MeshPhysicalMaterial } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  RENDER_ORDER,
  TISSUE_LOOKS,
  createMaterialLibrary,
  materialStateFor,
} from './materials';
import type { MeshState } from './resolveMeshState';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RENDER_ORDER', () => {
  it('assigns exact system render orders from spec §6.2', () => {
    expect(RENDER_ORDER).toEqual({
      skeletal: 0,
      nervous: 1,
      respiratory: 1,
      digestive: 1,
      urinary: 1,
      lymphatic: 1,
      cardiovascular: 2,
      muscular: 3,
      integumentary: 4,
    });
  });
});

describe('TISSUE_LOOKS', () => {
  it('satisfies §5.2 physical look constraints and distinct colours', () => {
    expect(TISSUE_LOOKS.bone.roughness).toBeGreaterThanOrEqual(0.8);
    expect(TISSUE_LOOKS.bone.clearcoat).toBe(0);

    for (const glossy of ['organ', 'artery', 'vein'] as const) {
      expect(TISSUE_LOOKS[glossy].clearcoat).toBeGreaterThanOrEqual(0.3);
    }

    for (const sheeny of ['cartilage', 'tendon', 'ligament'] as const) {
      expect(TISSUE_LOOKS[sheeny].sheen).toBeGreaterThan(0);
    }

    const colours = Object.values(TISSUE_LOOKS).map((t) =>
      t.color.toLowerCase(),
    );
    expect(new Set(colours).size).toBe(colours.length);
  });
});

describe('materialStateFor', () => {
  const base: MeshState = {
    visible: true,
    opacity: 1,
    ghost: false,
    highlight: 'none',
    pickable: true,
  };

  it('orders priority as selected > hovered > ghost > base', () => {
    expect(materialStateFor(base)).toBe('base');
    expect(materialStateFor({ ...base, ghost: true })).toBe('ghost');
    expect(
      materialStateFor({ ...base, ghost: true, highlight: 'hovered' }),
    ).toBe('hovered');
    expect(
      materialStateFor({ ...base, ghost: true, highlight: 'selected' }),
    ).toBe('selected');
  });
});

describe('createMaterialLibrary', () => {
  it('caches instances by system|tissue|color|state', () => {
    const lib = createMaterialLibrary(0.15);
    const a = lib.get({ system: 'skeletal', tissue: 'bone', state: 'base' });
    const b = lib.get({ system: 'skeletal', tissue: 'bone', state: 'base' });
    const hovered = lib.get({
      system: 'skeletal',
      tissue: 'bone',
      state: 'hovered',
    });

    expect(a).toBe(b);
    expect(a).not.toBe(hovered);
  });

  it('configures ghost, hovered, and selected materials properly', () => {
    const lib = createMaterialLibrary(0.15);
    const ghost = lib.get({
      system: 'muscular',
      tissue: 'muscle',
      state: 'ghost',
    }) as MeshPhysicalMaterial;
    const hovered = lib.get({
      system: 'skeletal',
      tissue: 'bone',
      state: 'hovered',
    }) as MeshPhysicalMaterial;
    const selected = lib.get({
      system: 'skeletal',
      tissue: 'bone',
      state: 'selected',
    }) as MeshPhysicalMaterial;

    expect(ghost).toBeInstanceOf(MeshPhysicalMaterial);
    expect(ghost.transparent).toBe(true);
    expect(ghost.depthWrite).toBe(false);
    expect(ghost.opacity).toBe(0.15);

    expect(hovered).toBeInstanceOf(MeshPhysicalMaterial);
    expect(selected).toBeInstanceOf(MeshPhysicalMaterial);
    expect(hovered.emissiveIntensity).toBeLessThan(selected.emissiveIntensity);
    expect(selected.emissive.getHexString()).toBe('6fa8ff');
  });

  it('applies colour override on organ materials', () => {
    const lib = createMaterialLibrary(0.15);
    const mat = lib.get({
      system: 'digestive',
      tissue: 'organ',
      color: '#7a2e2e',
      state: 'base',
    }) as MeshPhysicalMaterial;

    expect(mat.color.getHexString()).toBe(new Color('#7a2e2e').getHexString());
  });

  it('disposes every created material on dispose()', () => {
    const disposeSpy = vi.spyOn(Material.prototype, 'dispose');
    const lib = createMaterialLibrary(0.15);

    lib.get({ system: 'skeletal', tissue: 'bone', state: 'base' });
    lib.get({ system: 'muscular', tissue: 'muscle', state: 'ghost' });
    lib.fallback();

    lib.dispose();
    expect(disposeSpy).toHaveBeenCalledTimes(3);
  });
});
