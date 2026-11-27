import { describe, expect, it } from 'vitest';
import { nutrientsAt } from './nutrients';
import type { Journey } from './schema';

const view = {
  c: [0, 0, 2, 0, 0, 0] as [number, number, number, number, number, number],
  s: ['digestive'] as ['digestive'],
  h: [],
  sel: [],
};

const journey: Journey = {
  id: 'digestion',
  systems: ['digestive'],
  stages: [
    {
      id: 'mouth',
      durationS: 10,
      food: 'bolus',
      radius: 0.007,
      motion: 'none',
      organs: ['tongue'],
      view,
      path: [{ line: 'a' }],
      modelled: true,
      nutrients: { carbs: 10, protein: 0, fat: 0, water: 0, absorbed: 0 },
    },
    {
      id: 'stomach',
      durationS: 14,
      food: 'chyme',
      radius: 0.011,
      motion: 'churn',
      organs: ['stomach'],
      view,
      path: [{ line: 'a' }],
      modelled: true,
      nutrients: { carbs: 30, protein: 20, fat: 10, water: 0, absorbed: 0 },
    },
  ],
};

describe('nutrientsAt', () => {
  it('interpolates stage 0 from zero and clamps out-of-range progress', () => {
    expect(nutrientsAt(journey, 0, 0)).toEqual({
      carbs: 0,
      protein: 0,
      fat: 0,
      water: 0,
      absorbed: 0,
    });
    expect(nutrientsAt(journey, 0, -0.5).carbs).toBe(0);
    expect(nutrientsAt(journey, 0, 0.5).carbs).toBe(5);
    expect(nutrientsAt(journey, 0, 1.5).carbs).toBe(10);
  });

  it('interpolates subsequent stages linearly from the prior stage end values', () => {
    expect(nutrientsAt(journey, 1, 0)).toEqual({
      carbs: 10,
      protein: 0,
      fat: 0,
      water: 0,
      absorbed: 0,
    });
    expect(nutrientsAt(journey, 1, 0.5)).toEqual({
      carbs: 20,
      protein: 10,
      fat: 5,
      water: 0,
      absorbed: 0,
    });
    expect(nutrientsAt(journey, 1, 1)).toEqual(journey.stages[1].nutrients);
  });
});
