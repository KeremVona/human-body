import { Color } from 'three';
import type { FoodState } from '../../features/journey/schema';

export type BiteLook = {
  color: Color;
  roughness: number;
  transmission: number;
};

export const BITE_LOOKS: Record<FoodState, BiteLook> = {
  bolus: {
    color: new Color('#e8dac2'),
    roughness: 0.34,
    transmission: 0.08,
  },
  chyme: {
    color: new Color('#ebd999'),
    roughness: 0.2,
    transmission: 0.3,
  },
  stool: {
    color: new Color('#7d5438'),
    roughness: 0.78,
    transmission: 0,
  },
};

/** Clones a `BiteLook` preset into an independent mutable instance. */
export function cloneLook(look: BiteLook): BiteLook {
  return {
    color: look.color.clone(),
    roughness: look.roughness,
    transmission: look.transmission,
  };
}

/** Smoothly interpolates `a` toward `b` at factor `t` in `[0, 1]`, writing in-place into `out`. */
export function lerpLook(
  a: BiteLook,
  b: BiteLook,
  t: number,
  out: BiteLook,
): BiteLook {
  const k = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  out.color.copy(a.color).lerp(b.color, k);
  out.roughness = a.roughness + (b.roughness - a.roughness) * k;
  out.transmission = a.transmission + (b.transmission - a.transmission) * k;
  return out;
}
