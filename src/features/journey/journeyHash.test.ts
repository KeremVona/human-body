import { describe, expect, it } from 'vitest';
import { journeyHash, parseJourneyHash } from './journeyHash';

describe('journeyHash', () => {
  it('formats with optional 1-based stage and parses both short and staged links', () => {
    expect(journeyHash('digestion')).toBe('#journey/digestion');
    expect(journeyHash('digestion', 0)).toBe('#journey/digestion/1');
    expect(journeyHash('digestion', 3)).toBe('#journey/digestion/4');

    expect(parseJourneyHash('#journey/digestion')).toEqual({
      id: 'digestion',
      stage: 0,
    });
    expect(parseJourneyHash('#journey/digestion/4')).toEqual({
      id: 'digestion',
      stage: 3,
    });
  });

  it('rejects malformed or out-of-range hashes cleanly', () => {
    expect(parseJourneyHash('#journey/')).toBeNull();
    expect(parseJourneyHash('#journey/digestion/0')).toBeNull();
    expect(parseJourneyHash('#journey/Bad_Id/2')).toBeNull();
    expect(parseJourneyHash('#journey/digestion/1/extra')).toBeNull();
    expect(parseJourneyHash('#tour/arm/1')).toBeNull();
  });
});
