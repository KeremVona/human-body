import { describe, expect, it } from 'vitest';
import { metersAt } from './meters';
import type { Journey } from './schema';

const view = {
  c: [0, 0, 2, 0, 0, 0] as [number, number, number, number, number, number],
  s: ['cardiovascular'] as ['cardiovascular'],
  h: [],
  sel: [],
};

const baseStage = {
  durationS: 6,
  look: 'blood-oxy' as const,
  radius: 0.004,
  motion: 'none' as const,
  organs: [],
  view,
  path: [{ line: 'a' }],
  modelled: true,
};

describe('metersAt', () => {
  it('interpolates monotonic and non-monotonic meters with metersStart and clamps out-of-range progress', () => {
    const journey: Journey = {
      id: 'blood',
      systems: ['cardiovascular'],
      meters: [
        { id: 'oxygen', unit: '%', max: 100, decimals: 0 },
        { id: 'co2', unit: 'relative', max: 100, decimals: 1 },
      ],
      metersStart: { oxygen: 98, co2: 20 },
      stages: [
        { ...baseStage, id: 'hand', meters: { oxygen: 75, co2: 80 } },
        { ...baseStage, id: 'lungs', meters: { oxygen: 98, co2: 20 } },
      ],
    };

    expect(metersAt(journey, 0, -0.5)).toEqual({ oxygen: 98, co2: 20 });
    expect(metersAt(journey, 0, 0.5)).toEqual({ oxygen: 86.5, co2: 50 });
    expect(metersAt(journey, 0, 1.5)).toEqual({ oxygen: 75, co2: 80 });

    expect(metersAt(journey, 1, 0)).toEqual({ oxygen: 75, co2: 80 });
    expect(metersAt(journey, 1, 0.5)).toEqual({ oxygen: 86.5, co2: 50 });
    expect(metersAt(journey, 1, 1)).toEqual({ oxygen: 98, co2: 20 });
  });

  it('defaults stage 0 start to stage 0 own values when metersStart is absent', () => {
    const journey: Journey = {
      id: 'breath',
      systems: ['respiratory'],
      meters: [{ id: 'oxygen', unit: '%', max: 25, decimals: 1 }],
      stages: [
        { ...baseStage, id: 'nose', meters: { oxygen: 21 } },
        { ...baseStage, id: 'alveoli', meters: { oxygen: 14 } },
      ],
    };

    expect(metersAt(journey, 0, 0)).toEqual({ oxygen: 21 });
    expect(metersAt(journey, 0, 0.7)).toEqual({ oxygen: 21 });
    expect(metersAt(journey, 1, 0.5)).toEqual({ oxygen: 17.5 });
  });
});
