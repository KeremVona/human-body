import { describe, expect, it } from 'vitest';
import { batchingEnabled } from './flag';

describe('batchingEnabled', () => {
  it('returns false only when ?batching=off is set', () => {
    expect(batchingEnabled('?batching=off')).toBe(false);
    expect(batchingEnabled('?debug&batching=off')).toBe(false);
    expect(batchingEnabled('')).toBe(true);
    expect(batchingEnabled('?debug')).toBe(true);
    expect(batchingEnabled('?batching=on')).toBe(true);
  });
});
