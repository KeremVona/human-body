import { describe, expect, it } from 'vitest';
import {
  JourneysFileSchema,
  JourneyStageSchema,
  JourneyTextsFileSchema,
} from './schema';

const baseView = {
  c: [0, 0.3, 1.2, 0, 0.3, 0] as [number, number, number, number, number, number],
  s: ['digestive', 'skeletal'] as const,
  o: { skeletal: 0.15 },
  h: [],
  sel: [],
};

const stage1 = {
  id: 'mouth',
  durationS: 10,
  realTime: { min: 5, max: 30, unit: 's' as const },
  food: 'bolus' as const,
  radius: 0.007,
  motion: 'none' as const,
  organs: ['tongue'],
  view: baseView,
  path: [{ mesh: 'tongue', anchor: [0.5, 0.95, 0.5] as [number, number, number] }],
  modelled: true,
  events: [
    { at: 0.15, kind: 'secrete' as const, mesh: 'parotid-gland--l', id: 'saliva' },
    { at: 0.15, kind: 'secrete' as const, mesh: 'parotid-gland--r', id: 'saliva' },
  ],
  nutrients: { carbs: 5, protein: 0, fat: 0, water: 0, absorbed: 0 },
};

const stage2 = {
  id: 'esophagus',
  durationS: 6,
  food: 'bolus' as const,
  radius: 0.005,
  motion: 'squeeze' as const,
  organs: ['esophagus'],
  inside: ['esophagus'],
  view: baseView,
  path: [{ line: 'esophagus', from: 0.04, to: 1 }],
  modelled: true,
  nutrients: { carbs: 10, protein: 0, fat: 0, water: 0, absorbed: 0 },
};

describe('journey schemas', () => {
  it('accepts valid JourneysFileSchema and JourneyTextsFileSchema fixtures', () => {
    expect(
      JourneysFileSchema.safeParse({
        journeys: [
          {
            id: 'digestion',
            systems: ['digestive'],
            stages: [stage1, stage2],
          },
        ],
      }).success,
    ).toBe(true);

    expect(
      JourneyTextsFileSchema.safeParse({
        journeys: {
          digestion: {
            title: 'Follow a bite of food',
            summary: 'Watch one bite travel the digestive tract.',
            stages: {
              mouth: { title: 'Chewing', body: 'Teeth chew.' },
            },
            events: { saliva: 'Saliva' },
          },
        },
      }).success,
    ).toBe(true);
  });

  it('rejects out-of-range durationS, radius, from >= to, min > max, and pins in view', () => {
    expect(JourneyStageSchema.safeParse({ ...stage1, durationS: 1 }).success).toBe(false);
    expect(JourneyStageSchema.safeParse({ ...stage1, durationS: 31 }).success).toBe(false);
    expect(JourneyStageSchema.safeParse({ ...stage1, radius: 0 }).success).toBe(false);
    expect(JourneyStageSchema.safeParse({ ...stage1, radius: 0.031 }).success).toBe(false);
    expect(
      JourneyStageSchema.safeParse({
        ...stage2,
        path: [{ line: 'esophagus', from: 0.8, to: 0.2 }],
      }).success,
    ).toBe(false);
    expect(
      JourneyStageSchema.safeParse({
        ...stage1,
        realTime: { min: 30, max: 5, unit: 's' },
      }).success,
    ).toBe(false);
    expect(
      JourneyStageSchema.safeParse({
        ...stage1,
        view: { ...baseView, p: [{ m: 'tongue', l: [0, 0, 0], t: 'Pin' }] },
      }).success,
    ).toBe(false);
  });
});
