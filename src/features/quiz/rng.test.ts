import { describe, expect, it } from 'vitest';
import type { MeshId } from '../../data/ids';
import { createRng, pickQuestions } from './rng';

describe('rng & pickQuestions', () => {
  it('is deterministic and never repeats', () => {
    const pool = Array.from({ length: 30 }, (_, i) => `m${i}` as MeshId);
    const a = pickQuestions(pool, 10, createRng(42));
    const b = pickQuestions(pool, 10, createRng(42));
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(10);
    expect(pickQuestions(pool.slice(0, 4), 10, createRng(1))).toHaveLength(4);
  });
});
