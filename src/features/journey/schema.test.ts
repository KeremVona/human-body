import { describe, expect, it } from 'vitest';
import enJourneys from '../../../content/en/journeys.json';
import rawJourneys from '../../../content/journeys.json';
import trJourneys from '../../../content/tr/journeys.json';
import {
  JourneySchema,
  JourneyStageSchema,
  JourneysFileSchema,
  JourneyTextsFileSchema,
} from './schema';

const baseView = {
  c: [0, 0.3, 1.2, 0, 0.3, 0] as [number, number, number, number, number, number],
  s: ['digestive', 'skeletal'] as const,
  o: { skeletal: 0.15 },
  h: [],
  sel: [],
};

const metersDef = [
  {
    id: 'carbs',
    unit: '%' as const,
    max: 100,
    decimals: 0 as const,
    monotonic: true,
    secondary: 'absorbed',
  },
  {
    id: 'absorbed',
    unit: '%' as const,
    max: 100,
    decimals: 0 as const,
    monotonic: true,
  },
];

const stage1 = {
  id: 'mouth',
  durationS: 10,
  realTime: { min: 5, max: 30, unit: 's' as const },
  look: 'bolus' as const,
  radius: 0.007,
  motion: 'none' as const,
  organs: ['tongue'],
  view: baseView,
  path: [{ mesh: 'tongue', anchor: [0.5, 0.95, 0.5] as [number, number, number] }],
  modelled: true,
  events: [
    { at: 0.15, kind: 'secrete' as const, mesh: 'parotid-gland--l', id: 'saliva', via: 'pancreatic-duct--l' },
    { at: 0.25, kind: 'highlight' as const, mesh: 'tongue', id: 'taste' },
  ],
  meters: { carbs: 5, absorbed: 0 },
};

const stage2 = {
  id: 'esophagus',
  durationS: 6,
  look: 'blood-oxy' as const,
  radius: 0.005,
  motion: 'squeeze' as const,
  rhythm: { motion: 'breathing', mode: 'scrub' as const, from: 0, to: 0.4 },
  closeUp: 'alveolus' as const,
  organs: ['esophagus'],
  inside: ['esophagus'],
  view: baseView,
  path: [{ line: 'radial-veins--l', from: 0.04, to: 1, reverse: true }],
  modelled: true,
  meters: { carbs: 10, absorbed: 0 },
};

describe('journey schemas v2', () => {
  it('accepts all shipped journeys and localized text files', () => {
    const parsed = JourneysFileSchema.parse(rawJourneys);
    expect(parsed.journeys.map((j) => j.id)).toEqual([
      'digestion',
      'blood',
      'breath',
    ]);
    const enParsed = JourneyTextsFileSchema.parse(enJourneys);
    const trParsed = JourneyTextsFileSchema.parse(trJourneys);
    for (const id of ['digestion', 'blood', 'breath'] as const) {
      expect(enParsed.journeys[id]).toBeDefined();
      expect(trParsed.journeys[id]).toBeDefined();
    }
  });

  it('accepts valid v2 JourneysFileSchema and JourneyTextsFileSchema fixtures', () => {
    expect(
      JourneysFileSchema.safeParse({
        journeys: [
          {
            id: 'digestion',
            systems: ['digestive'],
            meters: metersDef,
            metersStart: { carbs: 0, absorbed: 0 },
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
            follow: 'Follow the food',
            inspectorLink: 'Watch food pass through here',
            metersTitle: "What's been digested",
            metersNote: 'Rounded teaching values',
            meters: {
              carbs: { label: 'Carbohydrates', value: '{v}% broken down, {s}% absorbed' },
            },
            stages: {
              mouth: { title: 'Chewing', body: 'Teeth chew.' },
            },
            events: { saliva: 'Saliva' },
          },
        },
      }).success,
    ).toBe(true);
  });

  it('rejects invalid looks, highlight with via, scrub from > to, duplicate/bad secondary meters, and out-of-range fields', () => {
    expect(JourneyStageSchema.safeParse({ ...stage1, look: 'plasma' }).success).toBe(false);
    expect(JourneyStageSchema.safeParse({ ...stage1, closeUp: 'liver' }).success).toBe(false);
    expect(
      JourneyStageSchema.safeParse({
        ...stage1,
        events: [{ at: 0.2, kind: 'highlight', mesh: 'tongue', id: 'taste', via: 'esophagus' }],
      }).success,
    ).toBe(false);
    expect(
      JourneyStageSchema.safeParse({
        ...stage2,
        rhythm: { motion: 'breathing', mode: 'scrub', from: 0.6, to: 0.2 },
      }).success,
    ).toBe(false);
    expect(
      JourneySchema.safeParse({
        id: 'digestion',
        systems: ['digestive'],
        meters: [],
        stages: [stage1, stage2],
      }).success,
    ).toBe(false);
    expect(
      JourneySchema.safeParse({
        id: 'digestion',
        systems: ['digestive'],
        meters: [
          { id: 'carbs', unit: '%', max: 100, decimals: 0 },
          { id: 'carbs', unit: '%', max: 100, decimals: 0 },
        ],
        stages: [stage1, stage2],
      }).success,
    ).toBe(false);
    expect(
      JourneySchema.safeParse({
        id: 'digestion',
        systems: ['digestive'],
        meters: [{ id: 'carbs', unit: '%', max: 100, decimals: 0, secondary: 'carbs' }],
        stages: [stage1, stage2],
      }).success,
    ).toBe(false);
    expect(
      JourneySchema.safeParse({
        id: 'digestion',
        systems: ['digestive'],
        meters: [{ id: 'carbs', unit: '%', max: 100, decimals: 0, secondary: 'missing' }],
        stages: [stage1, stage2],
      }).success,
    ).toBe(false);
    expect(JourneyStageSchema.safeParse({ ...stage1, durationS: 1 }).success).toBe(false);
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
