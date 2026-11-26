import { describe, expect, it } from 'vitest';
import {
  TourStepSchema,
  TourTextsFileSchema,
  ToursFileSchema,
} from './schema';

const baseView = {
  c: [0, 0, 2, 0, 0, 0] as [number, number, number, number, number, number],
  s: ['skeletal'] as const,
  h: [],
  sel: ['femur--l'],
};

describe('tour schemas', () => {
  it('accepts valid ToursFileSchema and TourTextsFileSchema fixtures', () => {
    const validTours = {
      tours: [
        {
          id: 'arm-bone-to-muscle',
          systems: ['skeletal', 'muscular'],
          steps: [
            { id: 'step-1', view: baseView },
            { id: 'step-2', view: baseView },
            { id: 'step-3', view: { ...baseView, i: ['femur--l'], f: [] } },
            {
              id: 'step-4',
              view: baseView,
              motion: { id: 'elbow-flexion', phase: 0.25, play: false },
            },
          ],
        },
      ],
    };

    const validTexts = {
      tours: {
        'arm-bone-to-muscle': {
          title: 'From bone to muscle',
          summary: 'Explore the arm bones and muscles.',
          steps: {
            'step-1': { title: 'Step 1', body: 'Look at the skeleton.' },
            'step-2': { title: 'Step 2', body: 'Isolate the upper limb.' },
          },
        },
      },
    };

    expect(ToursFileSchema.safeParse(validTours).success).toBe(true);
    expect(TourTextsFileSchema.safeParse(validTexts).success).toBe(true);
  });

  it('rejects pins (p) inside a step view', () => {
    const res = TourStepSchema.safeParse({
      id: 'step-1',
      view: {
        ...baseView,
        p: [{ m: 'femur--l', l: [0, 0, 0], t: 'Pin' }],
      },
    });
    expect(res.success).toBe(false);
  });

  it('rejects out-of-range motion phase', () => {
    const res = TourStepSchema.safeParse({
      id: 'step-1',
      view: baseView,
      motion: { id: 'elbow-flexion', phase: 1.5 },
    });
    expect(res.success).toBe(false);
  });
});
