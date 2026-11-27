import { describe, expect, it } from 'vitest';
import { rhythmPhase, rhythmPlan } from './rhythm';
import type { JourneyStage } from './schema';

const baseStage: JourneyStage = {
  id: 'a',
  durationS: 6,
  look: 'blood-oxy',
  radius: 0.004,
  motion: 'none',
  organs: [],
  view: { c: [0, 0, 2, 0, 0, 0], s: ['cardiovascular'], h: [], sel: [] },
  path: [{ line: 'a' }],
  modelled: true,
  meters: { oxygen: 98 },
};

describe('rhythmPlan and rhythmPhase', () => {
  it('plans none, start-play, keep, stop, start-scrub, and different-motion transitions', () => {
    const playHeart: JourneyStage = {
      ...baseStage,
      rhythm: { motion: 'heartbeat', mode: 'play' },
    };
    const scrubIn: JourneyStage = {
      ...baseStage,
      rhythm: { motion: 'breathing', mode: 'scrub', from: 0, to: 0.4 },
    };
    const scrubOut: JourneyStage = {
      ...baseStage,
      rhythm: { motion: 'breathing', mode: 'scrub', from: 0.4, to: 1 },
    };

    expect(rhythmPlan(undefined, baseStage)).toBe('none');
    expect(rhythmPlan(baseStage, baseStage)).toBe('none');
    expect(rhythmPlan(undefined, playHeart)).toBe('start-play');
    expect(rhythmPlan(baseStage, playHeart)).toBe('start-play');
    expect(rhythmPlan(playHeart, playHeart)).toBe('keep');
    expect(rhythmPlan(playHeart, baseStage)).toBe('stop');

    expect(rhythmPlan(baseStage, scrubIn)).toBe('start-scrub');
    expect(rhythmPlan(scrubIn, scrubOut)).toBe('keep');
    expect(rhythmPlan(playHeart, scrubIn)).toBe('start-scrub');
    expect(rhythmPlan(scrubOut, playHeart)).toBe('start-play');
    expect(rhythmPlan(scrubOut, baseStage)).toBe('stop');
  });

  it('interpolates clamped scrub phase and returns 0 when stage has no scrub rhythm', () => {
    const scrubStage: JourneyStage = {
      ...baseStage,
      rhythm: { motion: 'breathing', mode: 'scrub', from: 0.2, to: 0.6 },
    };
    expect(rhythmPhase(scrubStage, -0.5)).toBeCloseTo(0.2, 6);
    expect(rhythmPhase(scrubStage, 0.5)).toBeCloseTo(0.4, 6);
    expect(rhythmPhase(scrubStage, 1.5)).toBeCloseTo(0.6, 6);
    expect(rhythmPhase(baseStage, 0.5)).toBe(0);
  });
});
