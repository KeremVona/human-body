import { describe, expect, it } from 'vitest';
import { parseTourHash, tourHash } from './tourHash';

describe('tourHash', () => {
  it('parses valid 1-based #tour/<id>/<step> hashes into 0-based indices', () => {
    expect(parseTourHash('#tour/how-the-heart-beats/3')).toEqual({
      id: 'how-the-heart-beats',
      step: 2,
    });
    expect(parseTourHash('#tour/lymph-nodes/1')).toEqual({
      id: 'lymph-nodes',
      step: 0,
    });
  });

  it('rejects step 0, uppercase ids, missing steps, and #v1 share hashes', () => {
    expect(parseTourHash('#tour/x/0')).toBeNull();
    expect(parseTourHash('#tour/X/1')).toBeNull();
    expect(parseTourHash('#tour/x')).toBeNull();
    expect(parseTourHash('#v1.abc')).toBeNull();
    expect(parseTourHash('')).toBeNull();
  });

  it('builds 1-based tour hashes from tour id and step index', () => {
    expect(tourHash('lymph-nodes', 0)).toBe('#tour/lymph-nodes/1');
    expect(tourHash('how-the-heart-beats', 2)).toBe('#tour/how-the-heart-beats/3');
  });
});
